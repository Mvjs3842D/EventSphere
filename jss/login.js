// ============================================================
// LOGIN PAGE JAVASCRIPT (login.js)
// Handles only the login page button interactions
//
// Note: The actual Google sign-in logic is in auth.js
// This file just connects the button to that function
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

    // Check if user is already logged in
    // If yes, redirect directly to dashboard
    auth.onAuthStateChanged(function (user) {
        if (user) {
            console.log("✅ Already logged in - redirecting to dashboard");
            window.location.href = 'dashboard.html';
        }
    });

    // Attach click handler to Google login button
    const googleBtn = document.getElementById('btn-google-login');
    if (googleBtn) {
        googleBtn.addEventListener('click', function () {
            signInWithGoogle(); // Defined in auth.js
        });
    }

    // Initialize particles
    initParticles();
});