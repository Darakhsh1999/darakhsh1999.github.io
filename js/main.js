// Smooth scrolling for back to top and coin flip animation
document.addEventListener('DOMContentLoaded', function() {
    // Show speech bubble hint after a short delay
    const clickHint = document.getElementById('clickHint');
    if (clickHint && !sessionStorage.getItem('profileClicked')) {
        setTimeout(() => {
            clickHint.classList.add('show-bubble');
        }, 1000);
    }

    // Back to top button
    const backToTopButton = document.querySelector('.back-to-top');
    if (backToTopButton) {
        backToTopButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Coin flip animation
    const coin = document.getElementById('coin');
    if (coin) {
        const coinInner = coin.querySelector('.coin-inner');
        let isFlipped = false;

        // Set initial state
        coinInner.style.transform = 'rotateY(0deg)';
        
        // Hide initial hint on first click, then show "Ask me anything" bubble briefly
        coinInner.addEventListener('click', function(e) {
            e.stopPropagation();
            if (clickHint && !sessionStorage.getItem('profileClicked')) {
                clickHint.classList.remove('show-bubble');
                sessionStorage.setItem('profileClicked', 'true');
                const askHint = document.getElementById('askHint');
                if (askHint) {
                    // Delay showing by 2 seconds
                    setTimeout(() => {
                        askHint.setAttribute('aria-hidden', 'false');
                        askHint.classList.add('show-bubble');
                        setTimeout(() => {
                            askHint.classList.remove('show-bubble');
                            askHint.setAttribute('aria-hidden', 'true');
                        }, 2500);
                    }, 2000);
                }
            }
        }, { once: true });
        
        coinInner.addEventListener('click', function(e) {
            e.stopPropagation();
            // Get current rotation from the element's style
            const currentTransform = window.getComputedStyle(coinInner).transform;
            let currentRotation = 0;
            
            // Extract current rotation from matrix if it exists
            if (currentTransform !== 'none') {
                const values = currentTransform.split('(')[1].split(')')[0].split(',');
                const a = values[0];
                const b = values[1];
                currentRotation = Math.round(Math.atan2(b, a) * (180/Math.PI));
                currentRotation = currentRotation < 0 ? currentRotation + 360 : currentRotation;
            }
            
            // Calculate target rotation (always add 180 degrees)
            const targetRotation = currentRotation + 180;
            
            // Create keyframes for the flip
            const keyframes = [
                { transform: `rotateY(${currentRotation}deg)` },
                { transform: `rotateY(${currentRotation + 90}deg)` },
                { transform: `rotateY(${currentRotation + 90}deg)` },
                { transform: `rotateY(${targetRotation}deg)` }
            ];
            
            // Cancel any ongoing animations
            const currentAnimations = coinInner.getAnimations();
            currentAnimations.forEach(anim => anim.cancel());
            
            // Create and play the animation
            const animation = coinInner.animate(keyframes, {
                duration: 1600,
                easing: 'ease-in-out',
                fill: 'forwards'
            });
            
            // Update the final state after animation
            animation.onfinish = () => {
                coinInner.style.transform = `rotateY(${targetRotation % 360}deg)`;
            };
            
            // Toggle the flipped state
            isFlipped = !isFlipped;
        });
    }
});
