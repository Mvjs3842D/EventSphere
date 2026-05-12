// ============================================================
// FIREBASE CONFIGURATION FILE (firebase.js)
// Your actual Firebase project credentials
// Using CDN compat version - no imports needed
// ============================================================

// ============================================================
// YOUR FIREBASE CONFIG - Already filled with your project
// ============================================================
var firebaseConfig = {
    apiKey: "AIzaSyDiVgkoaT45EbmbKlOaPLyTQRUMmF6AcRQ",
    authDomain: "event-manager-f866f.firebaseapp.com",
    databaseURL: "https://event-manager-f866f-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "event-manager-f866f",
    storageBucket: "event-manager-f866f.firebasestorage.app",
    messagingSenderId: "350206507181",
    appId: "1:350206507181:web:4210eaa1ca2b1d73832e24"
};

// ============================================================
// INITIALIZE FIREBASE
// Check if already initialized to avoid duplicate app error
// ============================================================
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase initialized successfully");
} else {
    firebase.app();
    console.log("✅ Firebase already initialized");
}

// ============================================================
// FIREBASE SERVICES
// Using var so these are globally accessible across all JS files
// ============================================================
var auth = firebase.auth();
var db = firebase.firestore();
var storage = firebase.storage();

// ============================================================
// GOOGLE AUTH PROVIDER
// Used for Google sign-in popup
// ============================================================
var googleProvider = new firebase.auth.GoogleAuthProvider();

googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// ============================================================
// ADMIN EMAIL
// Change this to YOUR Google email address
// Only this email can access admin.html
// ============================================================
var ADMIN_EMAIL = "mmohithvikram@gmail.com"; // ⚠️ CHANGE THIS

// ============================================================
// EMAILJS CONFIG
// For sending confirmation emails after registration
// Get these from https://emailjs.com (free account)
// ============================================================
var EMAILJS_CONFIG = {
    serviceId: "YOUR_EMAILJS_SERVICE_ID",
    templateId: "YOUR_EMAILJS_TEMPLATE_ID",
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY"
};

// Initialize EmailJS if loaded
if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_CONFIG.publicKey);
    console.log("✅ EmailJS initialized");
}

// ============================================================
// COLLECTION NAMES
// Firestore collection names used across all JS files
// ============================================================
var COLLECTIONS = {
    users: "users",
    events: "events",
    registrations: "registrations"
};

// ============================================================
// HELPER FUNCTIONS
// Reusable utilities used across all pages
// ============================================================

/**
 * Generate unique registration ID
 * Format: REG-XXXXXXXX
 */
function generateRegistrationId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return ("REG-" + timestamp + random).substr(0, 12);
}

/**
 * Format Firestore timestamp or date string
 * Returns: "December 25, 2025"
 */
function formatDate(dateValue) {
    try {
        var date;
        if (dateValue && dateValue.toDate) {
            date = dateValue.toDate();
        } else if (typeof dateValue === 'string') {
            date = new Date(dateValue);
        } else {
            date = new Date(dateValue);
        }
        var options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        return "Date not available";
    }
}

/**
 * Format date with time
 * Returns: "December 25, 2025 at 6:00 PM"
 */
function formatDateTime(dateValue, timeValue) {
    var formattedDate = formatDate(dateValue);
    if (timeValue) {
        var parts = timeValue.split(':');
        var hour = parseInt(parts[0]);
        var minutes = parts[1];
        var ampm = hour >= 12 ? 'PM' : 'AM';
        var hour12 = hour % 12 || 12;
        return formattedDate + " at " + hour12 + ":" + minutes + " " + ampm;
    }
    return formattedDate;
}

/**
 * Check if a date is in the past
 */
function isPastDate(dateString) {
    var eventDate = new Date(dateString);
    var today = new Date();
    return eventDate < today;
}

/**
 * Show toast notification
 * type: "success", "error", "info"
 */
function showToast(message, type) {
    type = type || "info";

    var toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    var icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML =
        '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
        '<div class="toast-text"><span>' + message + '</span></div>' +
        '<button class="toast-close" onclick="this.parentElement.remove()">✕</button>';

    toastContainer.appendChild(toast);

    setTimeout(function () {
        if (toast.parentElement) {
            toast.classList.add('removing');
            setTimeout(function () {
                if (toast.parentElement) toast.remove();
            }, 300);
        }
    }, 3000);
}

/**
 * Truncate text with "..."
 */
function truncateText(text, maxLength) {
    maxLength = maxLength || 100;
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

/**
 * Capitalize first letter of each word
 */
function capitalizeWords(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
    });
}

/**
 * Get URL query parameter
 * Used to read ?id=abc123 from URL
 */
function getUrlParam(param) {
    var urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Wait for Firebase auth state to be ready
 * Returns promise with user or null
 */
function waitForAuthState() {
    return new Promise(function (resolve) {
        var unsubscribe = auth.onAuthStateChanged(function (user) {
            unsubscribe();
            resolve(user);
        });
    });
}

/**
 * Check if current user is admin
 */
function isAdmin(user) {
    var currentUser = user || auth.currentUser;
    if (!currentUser) return false;
    return currentUser.email === ADMIN_EMAIL;
}

/**
 * Initialize floating particles background
 */
function initParticles() {
    var container = document.getElementById('particles-container');
    if (!container) return;

    for (var i = 0; i < 20; i++) {
        createParticle(container);
    }
}

function createParticle(container) {
    var particle = document.createElement('div');
    particle.className = 'particle';

    var size = Math.random() * 4 + 2;
    var left = Math.random() * 100;
    var delay = Math.random() * 8;
    var duration = Math.random() * 10 + 8;
    var opacity = Math.random() * 0.4 + 0.1;

    particle.style.cssText =
        'width:' + size + 'px;' +
        'height:' + size + 'px;' +
        'left:' + left + '%;' +
        'bottom:-10px;' +
        'opacity:0;' +
        'animation-delay:' + delay + 's;' +
        'animation-duration:' + duration + 's;' +
        'background:rgba(139,92,246,' + opacity + ');';

    container.appendChild(particle);
}

/**
 * Animate counter from 0 to target number
 */
function initCounterAnimation() {
    var statsSection = document.querySelector('.stats-section');
    if (!statsSection) return;

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                var counters = document.querySelectorAll('.stat-number[data-target]');
                counters.forEach(function (counter) {
                    animateCounter(counter);
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });

    observer.observe(statsSection);
}

function animateCounter(element) {
    var target = parseInt(element.dataset.target);
    var duration = 2000;
    var startTime = performance.now();

    function easeOut(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function update(currentTime) {
        var elapsed = currentTime - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var current = Math.floor(easeOut(progress) * target);
        element.textContent = current.toLocaleString();
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target.toLocaleString();
        }
    }

    requestAnimationFrame(update);
}

/**
 * Setup scroll reveal animations
 */
function setupScrollReveal() {
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-aos]').forEach(function (el) {
        observer.observe(el);
    });
}

console.log("📁 firebase.js loaded - Auth, DB, Storage ready");
