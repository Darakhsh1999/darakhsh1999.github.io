// Chatbox UI and OpenRouter streaming integration (client-side with Referer allowlist)
// Notes:
// - Requires setting your site in OpenRouter Referer Allowlist
// - No API key is used in the browser; the browser will send the Referer header
// - If you choose to use an API key later, add the Authorization header

(function() {
  // === Configuration ======================================================
  // Paste your OpenRouter API key below. It will be embedded in the client. 
  // Since you chose a credit-limited key, this is acceptable for your use case.
  // If you later prefer to hide the key, move the call behind a proxy.
  const KEY_PART_1 = 'sk-or-v1-';
  const KEY_PART_2 = 'b0194551b298efae440eb47be27722';
  const KEY_PART_3 = 'd6619e5da24dc30c648580913764f25a45';
  const OPENROUTER_API_KEY = KEY_PART_1 + KEY_PART_2 + KEY_PART_3; // this is rate-limited to 2$, Good luck abusing it :)

  // Specify the model. Examples:
  // 'openrouter/auto'
  // 'openai/gpt-4o-mini'
  // 'anthropic/claude-3-haiku'
  // 'qwen/qwen2.5-7b-instruct'
  const MODEL = 'deepseek/deepseek-v3.1-terminus';

  // Optional: provide fallback models (first is preferred). If non-empty,
  // the request will send { models: [...] } and OpenRouter will pick the
  // first available in order.
  const MODELS_FALLBACK = [
    MODEL,
    'qwen/qwen3-4b:free',
  ];

  const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  const systemPrompt = `
  You are an AI chatbot assistant and your role is to be Arash Darakhsh\'s AI version, basically you are Arash Darakhsh but in AI form.
  You will answer questions about Arash Darakhsh as you are chatbox embedded on Arash Darakhsh\'s website. Below you will have some information about Arash Darakhsh.


  ### Style
  - You should only answer questions about Arash Darakhsh and not about yourself and do not answer unrelated questions.
  - Answer only in text and do not include any HTML, markup or weird symbols or any other formatting.
  - Keep replies very consise (1-3 sentences) unless the user asks for more detail.
  - For links and navigation, point the user to the relevant sections instead of giving URL links.
  - If you are not sure about something, you can say "I don't know" or "I don't have an answer for that".
  - Keep a friendly and professional tone.

  ### Personal Information
  Name: Arash Darakhsh
  Degree: Master of Science in Theoretical Physics
  University: Chalmers University of Technology
  Country: Sweden
  
  ### Work Experience
  - Research Engineer
  - Computer Vision
  - GKN Aerospace Sweden AB

  ### Questions and Answers (Q&A)
  Q: What is your name?
  A: I am Arash Darakhsh.
  Q: What is your degree?
  A: I have a Master of Science in Theoretical Physics specializing in applied machine learning from Chalmers University of Technology.
  Q: What is your work experience?
  A: I have experience as a Research Engineer at GKN Aerospace Sweden AB. See section "Work Experience" for more details.
  Q: What is your academic background?
  A: I have a Master of Science in Theoretical Physics specializing in applied machine learning from Chalmers University of Technology. See section "Academic Background" for more details.
  Q: What programming languages do you know?
  A: I am proficient in Python, SQL, C++, and know a bit of Java, JavaScript and Matlab.
  Q: What roles are you suitable for?
  A: I am suitable for roles as an AI Engineer, Data Scientist, Data Analyst, Deep Learning Engineer, Machine Learning Engineer, and Research Engineer.
  Q: Where can I see your portfolio?
  A: I have a portfolio on GitHub where I host most of my coding projects. You can find it by clicking the GitHub icon
  Q: Where can I see your resume?
  A: The resume can be found under the "Resume" section.
  Q: Where can I see your academic background?
  A: The academic background can be found under the "Academic Background" section.
  Q: Where can I see your certificates?
  A: The certificates can be found under the "Certificates" section.
  Q: Where can I see your work experience?
  A: The work experience can be found under the "Work Experience" section.

  ### Navigation
  - Work experience: "Work Experience" section
  - Academic background: "Academic Background" section
  - Certificates: "Certificates" section
  - Resume: "Resume" section
  - GitHub: "GitHub" icon
  - LinkedIn: "LinkedIn" icon
  - Email: "Email" icon
  
  `;

  function $(selector, root = document) { return root.querySelector(selector); }

  function createMsgEl(role, text) {
    const el = document.createElement('div');
    el.className = `chat-msg ${role}`;
    el.textContent = text;
    return el;
  }

  async function streamOpenRouter(messages, onToken, onError) {
    if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'PASTE_YOUR_OPENROUTER_API_KEY_HERE') {
      onError(new Error('OpenRouter API key is missing. Edit js/chatbox.js and set OPENROUTER_API_KEY.'));
      return;
    }
    try {
      // Build request body with single model or models fallback
      const body = {
        messages,
        stream: true,
        temperature: 0.7,
      };
      if (Array.isArray(MODELS_FALLBACK) && MODELS_FALLBACK.length > 0) {
        body.models = MODELS_FALLBACK;
      } else {
        body.model = MODEL;
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify(body)
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `OpenRouter error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) onToken(delta);
          } catch (e) {
            // ignore JSON parse errors for keep-alives
          }
        }
      }
    } catch (err) {
      onError(err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const chatEl = $('#profile-chatbox');
    if (!chatEl) return;

    const messagesEl = $('.chatbox-messages', chatEl);
    const formEl = $('.chatbox-input', chatEl);
    const inputEl = $('input[name="prompt"]', formEl);
    const sendBtn = $('.chatbox-send', formEl);
    const minimizeBtn = $('.chatbox-minimize', chatEl);
    const headerEl = $('.chatbox-header', chatEl);

    let history = [
      { role: 'system', content: systemPrompt },
    ];

    // State for rate limiting and streaming lock
    let isStreaming = false;
    const submitTimestamps = []; // user submit times (ms)

    function now() { return Date.now(); }
    function pruneRateWindow() {
      const cutoff = now() - 5 * 60 * 1000; // 5 minutes
      while (submitTimestamps.length && submitTimestamps[0] < cutoff) {
        submitTimestamps.shift();
      }
    }

    function showError(message) {
      const errEl = createMsgEl('assistant', `Error: ${message}`);
      messagesEl.appendChild(errEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function wordCount(text) {
      return (text.trim().match(/\b\w+\b/g) || []).length;
    }

    function setSendingState(sending) {
      isStreaming = sending;
      inputEl.disabled = sending;
      if (sendBtn) {
        sendBtn.disabled = sending;
        if (sending) {
          sendBtn.dataset.prevText = sendBtn.textContent;
          sendBtn.textContent = '⏳';
          sendBtn.setAttribute('aria-busy', 'true');
        } else {
          sendBtn.textContent = sendBtn.dataset.prevText || '➤';
          sendBtn.removeAttribute('aria-busy');
        }
      }
    }

    // Expand on focus/submit
    function expand() {
      chatEl.classList.remove('collapsed');
      minimizeBtn.hidden = false;
    }
    function collapse() {
      chatEl.classList.add('collapsed');
      minimizeBtn.hidden = true;
    }

    // Start collapsed; only input visible
    collapse();

    // Minimize handlers (direct + delegated) to ensure reliability
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        collapse();
      });
    }
    headerEl?.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.closest && target.closest('.chatbox-minimize')) {
        e.preventDefault();
        e.stopPropagation();
        collapse();
      }
    });

    // Submit handler
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = (inputEl.value || '').trim();
      if (!content) return;
      if (isStreaming) {
        // Prevent double-submit while streaming
        return;
      }

      // Rate limiting: 5 messages per 5 minutes
      pruneRateWindow();
      if (submitTimestamps.length >= 5) {
        showError('Rate limit reached: please wait a few minutes before sending more messages.');
        return;
      }

      // 200-word limit per message
      if (wordCount(content) > 200) {
        showError('Your message is too long. Please keep it under 200 words.');
        return;
      }

      // Record this attempt
      submitTimestamps.push(now());
      expand();

      // Hide askHint if visible
      const askHint = document.getElementById('askHint');
      if (askHint) askHint.classList.remove('show-bubble');

      // User message
      messagesEl.appendChild(createMsgEl('user', content));
      messagesEl.scrollTop = messagesEl.scrollHeight;

      inputEl.value = '';

      // Assistant placeholder
      const assistantEl = createMsgEl('assistant', '');
      messagesEl.appendChild(assistantEl);

      // Build API history (ephemeral; no persistence across reloads by request)
      const requestMessages = [
        ...history,
        { role: 'user', content },
      ];

      let errored = false;
      setSendingState(true);
      await streamOpenRouter(requestMessages, (token) => {
        assistantEl.textContent += token;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, (err) => {
        errored = true;
        assistantEl.textContent = `Error: ${err.message || err}`;
      });
      setSendingState(false);

      if (!errored) {
        // Update in-memory conversation for follow-ups
        history.push({ role: 'user', content });
        history.push({ role: 'assistant', content: assistantEl.textContent });
      }
    });

    // Expand when focusing the input
    inputEl.addEventListener('focus', expand);

    // Show a welcome prompt on first expansion? Keep minimal per requirements
    // We leave it silent until the user types.

    // Clicking the header should also expand (if collapsed)
    headerEl?.addEventListener('click', expand);
  });
})();
