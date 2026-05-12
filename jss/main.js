// ============================================================
// MAIN JAVASCRIPT (main.js)
// Runs on the landing page (index.html)
// Handles animations and interactions specific to home page
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // Start floating particle animation
    initParticles();

    // Animate stat counters when visible
    initCounterAnimation();

    // Scroll reveal for elements
    setupScrollReveal();

    // Smooth scroll for anchor links
    setupSmoothScroll();
});

/**
 * Setup smooth scrolling for navigation anchor links
 * Example: clicking "Features" in nav scrolls to #features
 */
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}