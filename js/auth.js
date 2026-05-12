// ============================================================
// AUTHENTICATION FILE (auth.js)
// Handles all login/logout/user management functionality
//
// This file runs on EVERY page to:
// 1. Check if user is logged in (auth state)
// 2. Update navbar buttons (Login vs Dashboard)
// 3. Protect pages that require login
// 4. Handle Google sign-in
// 5. Store user data in Firestore
//
// FLOW:
// User clicks Login → Google popup → Firebase Auth →
// Save to Firestore → Redirect to dashboard
// ============================================================

// ============================================================
// SECTION 1: AUTH STATE LISTENER
// Firebase automatically calls this function whenever
// the user's login status changes (login or logout)
// This runs on every page when the page loads
// ============================================================

// Listen for authentication state changes
// Firebase calls this callback with:
// - user object if logged in
// - null if not logged in
auth.onAuthStateChanged(function(user) {
    
    if (user) {
        // ---- USER IS LOGGED IN ----
        console.log("👤 User is logged in:", user.email);
        
        // Update navbar to show Dashboard button, hide Login button
        updateNavbarForLoggedInUser(user);
        
        // Store/update user data in Firestore
        saveUserToDatabase(user);
        
    } else {
        // ---- USER IS NOT LOGGED IN ----
        console.log("👤 No user logged in");
        
        // Update navbar to show Login button
        updateNavbarForLoggedOutUser();
        
        // Check if current page requires login
        // If yes, redirect to login page
        protectPage();
    }
});


// ============================================================
// SECTION 2: UPDATE NAVBAR BUTTONS
// Shows correct button based on login state
// ============================================================

/**
 * Update navbar when user IS logged in
 * - Hide "Login" button
 * - Show "Dashboard" button
 * 
 * @param {Object} user - Firebase user object
 */
function updateNavbarForLoggedInUser(user) {
    // Find navbar buttons by their IDs
    const loginBtn = document.getElementById('btn-login-nav');
    const dashboardBtn = document.getElementById('btn-dashboard-nav');
    
    // Hide login button
    if (loginBtn) {
        loginBtn.classList.add('hidden');
    }
    
    // Show dashboard button
    if (dashboardBtn) {
        dashboardBtn.classList.remove('hidden');
    }
}

/**
 * Update navbar when user is NOT logged in
 * - Show "Login" button
 * - Hide "Dashboard" button
 */
function updateNavbarForLoggedOutUser() {
    const loginBtn = document.getElementById('btn-login-nav');
    const dashboardBtn = document.getElementById('btn-dashboard-nav');
    
    // Show login button
    if (loginBtn) {
        loginBtn.classList.remove('hidden');
    }
    
    // Hide dashboard button
    if (dashboardBtn) {
        dashboardBtn.classList.add('hidden');
    }
}


// ============================================================
// SECTION 3: PAGE PROTECTION
// Redirects to login if user tries to access protected pages
// without being logged in
// ============================================================

/**
 * Pages that REQUIRE login to access
 * If user is not logged in and tries to visit these,
 * they get redirected to login.html
 */
const PROTECTED_PAGES = [
    'dashboard.html',
    'admin.html'
];

/**
 * Check if current page needs login
 * If yes and user is not logged in, redirect to login
 */
function protectPage() {
    // Get the current page filename from URL
    // Example: "http://localhost/dashboard.html" → "dashboard.html"
    const currentPage = window.location.pathname.split('/').pop();
    
    // Check if current page is in the protected list
    if (PROTECTED_PAGES.includes(currentPage)) {
        console.log("🔒 Protected page - redirecting to login");
        
        // Save where user was trying to go (for redirect after login)
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        
        // Redirect to login page
        window.location.href = 'login.html';
    }
}


// ============================================================
// SECTION 4: SAVE USER TO FIRESTORE
// After login, we save user info to our Firestore database
// This creates/updates user profile in "users" collection
// ============================================================

/**
 * Save user data to Firestore "users" collection
 * Uses "merge: true" so we don't overwrite existing data
 * (Like phone/bio that user added themselves)
 * 
 * @param {Object} firebaseUser - Firebase user object from auth
 */
// ✅ FIXED - uses .then() instead
function saveUserToDatabase(firebaseUser) {
    var userRef = firebase.firestore()
        .collection(COLLECTIONS.users)
        .doc(firebaseUser.uid);

    var userData = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || "Anonymous User",
        email: firebaseUser.email,
        profileImage: firebaseUser.photoURL || "",
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    userRef.set(userData, { merge: true })
        .then(function () {
            console.log("✅ User saved to Firestore:", firebaseUser.email);
        })
        .catch(function (error) {
            console.error("❌ Error saving user:", error);
        });
}


// ============================================================
// SECTION 5: GOOGLE SIGN IN FUNCTION
// Called when user clicks "Continue with Google" button
// ============================================================

/**
 * Sign in with Google using Firebase Auth popup
 * This opens a Google sign-in popup window
 * After success, onAuthStateChanged fires automatically
 */
// ✅ FIXED CODE
function signInWithGoogle() {

    // Show loading state on button
    setLoginButtonLoading(true);

    // Create a fresh provider instance each time
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // Use firebase.auth() directly instead of the var
    firebase.auth().signInWithPopup(provider)
        .then(function (result) {

            var user = result.user;
            console.log("✅ Google sign-in successful:", user.email);

            // Save user to Firestore
            saveUserToDatabase(user);

            // Show success message
            showAuthSuccess("Login successful! Redirecting...");

            // Redirect after short delay
            setTimeout(function () {
                var redirectUrl = sessionStorage.getItem('redirectAfterLogin');
                if (redirectUrl) {
                    sessionStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl;
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 1500);

        })
        .catch(function (error) {
            console.error("❌ Google sign-in error:", error);
            setLoginButtonLoading(false);
            handleAuthError(error);
        });
}


// ============================================================
// SECTION 6: SIGN OUT FUNCTION
// Called when user clicks "Logout"
// ============================================================

/**
 * Sign out the current user
 * Firebase clears the auth token
 * onAuthStateChanged fires with null user
 */
async function signOut() {
    try {
        // Confirm before logging out
        const confirmed = confirm("Are you sure you want to logout?");
        
        if (!confirmed) return;
        
        // Firebase sign out
        await auth.signOut();
        console.log("✅ User signed out successfully");
        
        // Redirect to home page
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error("❌ Error signing out:", error);
        showToast("Error signing out. Please try again.", "error");
    }
}


// ============================================================
// SECTION 7: GET CURRENT USER
// Helper function to get the currently logged in user
// ============================================================

/**
 * Get the currently logged in user
 * Returns null if no user is logged in
 * 
 * @returns {Object|null} Firebase user object or null
 */
function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Wait for auth state to be ready
 * Useful when you need user info immediately on page load
 * (auth.currentUser might be null for a moment while Firebase checks)
 * 
 * @returns {Promise<Object|null>} Resolves with user or null
 */
function waitForAuthState() {
    return new Promise((resolve) => {
        // onAuthStateChanged fires once immediately with current state
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe(); // Stop listening after first call
            resolve(user);
        });
    });
}


// ============================================================
// SECTION 8: CHECK ADMIN STATUS
// Checks if currently logged in user is the admin
// ============================================================

/**
 * Check if current user is admin
 * Simple email comparison - admin email set in firebase.js
 * 
 * @param {Object} user - Firebase user object (optional)
 * @returns {boolean} True if user is admin
 */
function isAdmin(user) {
    const currentUser = user || auth.currentUser;
    
    if (!currentUser) return false;
    
    // Compare user's email with the admin email
    return currentUser.email === ADMIN_EMAIL;
}


// ============================================================
// SECTION 9: UI HELPER FUNCTIONS FOR LOGIN PAGE
// Functions that update the login page UI
// ============================================================

/**
 * Show/hide loading state on login button
 * 
 * @param {boolean} isLoading - True to show loading, false to reset
 */
function setLoginButtonLoading(isLoading) {
    const loginBtn = document.getElementById('btn-google-login');
    const loginLoader = document.getElementById('login-loader');
    const loginText = document.getElementById('login-btn-text');
    
    if (!loginBtn) return; // Not on login page
    
    if (isLoading) {
        // Disable button and show spinner
        loginBtn.disabled = true;
        loginBtn.style.opacity = '0.7';
        if (loginLoader) loginLoader.classList.remove('hidden');
        if (loginText) loginText.textContent = 'Signing in...';
    } else {
        // Re-enable button and hide spinner
        loginBtn.disabled = false;
        loginBtn.style.opacity = '1';
        if (loginLoader) loginLoader.classList.add('hidden');
        if (loginText) loginText.textContent = 'Continue with Google';
    }
}

/**
 * Show success message on auth pages
 * 
 * @param {string} message - Success message to display
 */
function showAuthSuccess(message) {
    const successBox = document.getElementById('auth-success');
    if (successBox) {
        successBox.classList.remove('hidden');
        successBox.querySelector('span').textContent = message;
    }
}

/**
 * Show error message on auth pages
 * 
 * @param {string} message - Error message to display
 */
function showAuthError(message) {
    const errorBox = document.getElementById('auth-error');
    const errorMsg = document.getElementById('error-message');
    
    if (errorBox) {
        errorBox.classList.remove('hidden');
        if (errorMsg) errorMsg.textContent = message;
    }
}

/**
 * Handle different Firebase auth error codes
 * Shows user-friendly messages instead of technical errors
 * 
 * @param {Error} error - Firebase auth error object
 */
function handleAuthError(error) {
    // Firebase gives specific error codes we can handle
    let userMessage = "Something went wrong. Please try again.";
    
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            userMessage = "Sign-in was cancelled. Please try again.";
            break;
        case 'auth/popup-blocked':
            userMessage = "Pop-up was blocked! Please allow pop-ups for this site.";
            break;
        case 'auth/network-request-failed':
            userMessage = "Network error. Please check your internet connection.";
            break;
        case 'auth/too-many-requests':
            userMessage = "Too many attempts. Please wait and try again.";
            break;
        case 'auth/account-exists-with-different-credential':
            userMessage = "Account already exists with different sign-in method.";
            break;
        default:
            userMessage = `Login failed: ${error.message}`;
    }
    
    showAuthError(userMessage);
}


// ============================================================
// SECTION 10: NAVBAR INTERACTIONS
// Handle hamburger menu and scroll effects
// ============================================================

// Wait for DOM to be ready before accessing elements
document.addEventListener('DOMContentLoaded', function() {
    
    // ---- HAMBURGER MENU ----
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            // Toggle active class on hamburger (creates X shape)
            hamburger.classList.toggle('active');
            // Toggle mobile menu open/closed
            navLinks.classList.toggle('mobile-open');
        });
        
        // Close mobile menu when a link is clicked
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navLinks.classList.remove('mobile-open');
            });
        });
    }
    
    // ---- NAVBAR SCROLL EFFECT ----
    const navbar = document.getElementById('navbar');
    
    if (navbar) {
        window.addEventListener('scroll', function() {
            // Add 'scrolled' class when user scrolls down 50px
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }
    
    // ---- BACK TO TOP BUTTON ----
    const backToTopBtn = document.getElementById('back-to-top');
    
    if (backToTopBtn) {
        // Show button when scrolled down 300px
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        
        // Scroll to top when clicked
        backToTopBtn.addEventListener('click', function() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    // ---- LOGOUT BUTTONS ----
    // Find any logout button on the page and attach handler
    const logoutBtns = document.querySelectorAll('#btn-logout, .admin-logout');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            signOut();
        });
    });
    
});
