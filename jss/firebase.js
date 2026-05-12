// ============================================================
// FIREBASE CONFIGURATION FILE
// This file connects our website to Firebase services
// 
// Firebase services we use:
// 1. Firebase Authentication - Login with Google
// 2. Firebase Firestore - Store all data (events, users, registrations)
// 3. Firebase Storage - Store event images
//
// HOW TO SETUP:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project called "EventSphere"
// 3. Click "Web App" icon to add web app
// 4. Copy the config object Firebase gives you
// 5. Replace the firebaseConfig below with your config
// 6. Enable Authentication > Google provider
// 7. Create Firestore Database
// 8. Enable Storage
// ============================================================

// ============================================================
// STEP 1: YOUR FIREBASE CONFIG
// Replace these values with your actual Firebase project config
// You get this from Firebase Console > Project Settings > Your Apps
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyDiVgkoaT45EbmbKlOaPLyTQRUMmF6AcRQ",
    authDomain: "event-manager-f866f.firebaseapp.com",
    projectId: "event-manager-f866f",
    storageBucket: "event-manager-f866f.firebasestorage.app",
    messagingSenderId: "350206507181",
    appId: "1:350206507181:web:4210eaa1ca2b1d73832e24"
};

// ============================================================
// STEP 2: INITIALIZE FIREBASE APP
// firebase.initializeApp() starts Firebase with our config
// We check if app is already initialized to avoid errors
// (This can happen if firebase.js is loaded multiple times)
// ============================================================

// Check if Firebase is already initialized
// If not, initialize it with our config
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("✅ Firebase initialized successfully");
} else {
    // Firebase already running - use existing instance
    firebase.app();
    console.log("✅ Firebase already initialized, using existing instance");
}

// ============================================================
// STEP 3: CREATE SERVICE INSTANCES
// These variables give us access to different Firebase services
// We export them so other JS files can use them
// ============================================================

// Firebase Authentication - handles login/logout
// Used in: auth.js, login.js
const auth = firebase.auth();

// Firebase Firestore - our database
// Used in: events.js, dashboard.js, admin.js, event-details.js
const db = firebase.firestore();

// Firebase Storage - stores uploaded images
// Used in: admin.js (for uploading event images)
const storage = firebase.storage();

// ============================================================
// STEP 4: GOOGLE AUTH PROVIDER SETUP
// This configures how Google sign-in works
// ============================================================

// Create Google authentication provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Optional: Force Google to show account picker every time
// This lets users choose which Google account to use
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// ============================================================
// STEP 5: ADMIN EMAIL CONFIGURATION
// Change this to your admin email address
// Only this email will have admin panel access
// IMPORTANT: Keep this secret in real projects (use Firestore rules)
// ============================================================
const ADMIN_EMAIL = "mmohithvikram@gmail.com"; // Change this to your email!

// ============================================================
// STEP 6: EMAILJS CONFIGURATION
// EmailJS sends confirmation emails to users after registration
// Setup: Go to https://emailjs.com and create free account
// 1. Create email service (Gmail)
// 2. Create email template
// 3. Get your keys
// ============================================================
const EMAILJS_CONFIG = {
    serviceId: "YOUR_EMAILJS_SERVICE_ID",      // From EmailJS dashboard
    templateId: "YOUR_EMAILJS_TEMPLATE_ID",    // Email template ID
    publicKey: "YOUR_EMAILJS_PUBLIC_KEY"       // EmailJS public key
};

// Initialize EmailJS if the library is loaded
if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_CONFIG.publicKey);
    console.log("✅ EmailJS initialized");
}

// ============================================================
// STEP 7: DATABASE COLLECTION NAMES
// Centralize collection names to avoid typos
// These match the Firestore database structure
// ============================================================
const COLLECTIONS = {
    users: "users",                 // Stores user profiles
    events: "events",               // Stores all events
    registrations: "registrations"  // Stores event registrations
};

// ============================================================
// STEP 8: HELPER FUNCTIONS
// Reusable functions used across multiple files
// ============================================================

/**
 * Generate a unique registration ID
 * Format: REG-XXXXXXXX (8 random characters)
 * Example: REG-A1B2C3D4
 * 
 * @returns {string} Unique registration ID
 */
function generateRegistrationId() {
    // Create random string using timestamp + random number
    const timestamp = Date.now().toString(36).toUpperCase(); // Convert to base36
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `REG-${timestamp}${random}`.substr(0, 12); // Limit length
}

/**
 * Format a Firestore timestamp or date string to readable format
 * 
 * @param {*} dateValue - Firestore timestamp or date string
 * @returns {string} Formatted date string like "December 25, 2025"
 */
function formatDate(dateValue) {
    try {
        let date;
        
        // Check if it's a Firestore Timestamp object
        if (dateValue && dateValue.toDate) {
            date = dateValue.toDate(); // Convert Firestore timestamp to JS Date
        } else if (typeof dateValue === 'string') {
            date = new Date(dateValue); // Parse date string
        } else {
            date = new Date(dateValue);
        }
        
        // Format options
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        return "Date not available";
    }
}

/**
 * Format date with time
 * 
 * @param {*} dateValue - Date value
 * @param {string} timeValue - Time string like "14:30"
 * @returns {string} Formatted date + time string
 */
function formatDateTime(dateValue, timeValue) {
    const formattedDate = formatDate(dateValue);
    
    if (timeValue) {
        // Convert 24hr to 12hr format
        const [hours, minutes] = timeValue.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${formattedDate} at ${hour12}:${minutes} ${ampm}`;
    }
    
    return formattedDate;
}

/**
 * Check if a date is in the past
 * Used to mark events as "past" or "upcoming"
 * 
 * @param {string} dateString - Date string
 * @returns {boolean} True if date is in past
 */
function isPastDate(dateString) {
    const eventDate = new Date(dateString);
    const today = new Date();
    return eventDate < today;
}

/**
 * Show a toast notification message
 * Creates a floating message that auto-disappears
 * Used for success/error/info messages
 * 
 * @param {string} message - Message to show
 * @param {string} type - "success", "error", or "info"
 * @param {number} duration - How long to show in ms (default: 3000)
 */
function showToast(message, type = "info", duration = 3000) {
    // Check if toast container exists, create if not
    let toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Choose icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-text">
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('removing');
            // Wait for animation to finish before removing
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, duration);
}

/**
 * Truncate long text with "..." at the end
 * 
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum characters
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

/**
 * Capitalize first letter of each word
 * Used for category names display
 * 
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalizeWords(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, letter => letter.toUpperCase());
}

/**
 * Get URL query parameter value
 * Used in event-details.html to get event ID from URL
 * Example: event-details.html?id=abc123
 * 
 * @param {string} param - Parameter name to get
 * @returns {string|null} Parameter value or null
 */
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Log that firebase.js loaded successfully
console.log("📁 firebase.js loaded - Services ready:", { auth, db, storage });