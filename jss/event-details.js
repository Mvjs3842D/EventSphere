// ============================================================
// EVENT DETAILS PAGE JAVASCRIPT (event-details.js)
// Loads a single event's full details from Firestore
//
// How it works:
// 1. Read event ID from URL: event-details.html?id=abc123
// 2. Fetch that specific event from Firestore
// 3. Fill all HTML elements with event data
// 4. Check if current user is registered
// 5. Handle event registration
// 6. Send confirmation email via EmailJS
// 7. Run countdown timer
// ============================================================

// Store event data globally so registration function can access it
let currentEvent = null;
let currentEventId = null;
let countdownInterval = null;


// ============================================================
// SECTION 1: INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async function () {

    // Step 1: Get event ID from URL
    // URL looks like: event-details.html?id=SOME_ID
    currentEventId = getUrlParam('id');

    // If no ID in URL, show error
    if (!currentEventId) {
        showEventError();
        return;
    }

    // Step 2: Fetch the event from Firestore
    await loadEventDetails(currentEventId);

    // Step 3: Check login status to set correct button state
    const user = await waitForAuthState();
    if (user && currentEvent) {
        await checkUserRegistrationStatus(user, currentEventId);
    }

    // Step 4: Setup close modal button
    setupModalClose();
});


// ============================================================
// SECTION 2: LOAD EVENT FROM FIRESTORE
// ============================================================

/**
 * Fetch event data from Firestore and populate the page
 *
 * @param {string} eventId - The event document ID
 */
async function loadEventDetails(eventId) {
    try {
        console.log("📅 Loading event:", eventId);

        // Fetch specific document from Firestore "events" collection
        const eventDoc = await db.collection(COLLECTIONS.events).doc(eventId).get();

        // Event not found
        if (!eventDoc.exists) {
            console.log("❌ Event not found");
            showEventError();
            return;
        }

        // Store event data globally
        currentEvent = { id: eventDoc.id, ...eventDoc.data() };
        console.log("✅ Event loaded:", currentEvent.title);

        // Populate all page elements
        populateEventPage(currentEvent);

        // Start countdown timer
        startCountdown(currentEvent.date, currentEvent.time);

        // Update registration availability bar
        await updateAvailabilityBar(eventId, currentEvent.ticketLimit);

    } catch (error) {
        console.error("❌ Error loading event:", error);
        showEventError();
    }
}

/**
 * Fill all HTML elements with event data
 * This function connects database fields to HTML element IDs
 *
 * @param {Object} event - Event data from Firestore
 */
function populateEventPage(event) {

    // ---- Update page title in browser tab ----
    document.title = `${event.title} - EventSphere`;

    // ---- Show the content (was hidden during loading) ----
    document.getElementById('event-loading')?.classList.add('hidden');
    document.getElementById('event-details-container')?.classList.remove('hidden');

    // ---- BANNER ----
    // Set background image from Firebase Storage URL
    const bannerBg = document.getElementById('event-banner-bg');
    if (bannerBg && event.imageURL) {
        bannerBg.style.backgroundImage = `url('${event.imageURL}')`;
        bannerBg.style.backgroundSize = 'cover';
        bannerBg.style.backgroundPosition = 'center';
    }

    // Fill banner text
    document.getElementById('event-title').textContent = event.title || 'Event Title';
    document.getElementById('breadcrumb-event-name').textContent = truncateText(event.title, 30);
    document.getElementById('event-category').textContent = capitalizeWords(event.category) || 'Event';
    document.getElementById('event-date-banner').textContent = formatDateTime(event.date, event.time);
    document.getElementById('event-venue-banner').textContent = event.venue || 'Venue TBA';
    document.getElementById('event-organizer-banner').textContent = event.organizer || 'EventSphere';

    // Add category color class to badge
    const categoryBadge = document.getElementById('event-category');
    if (categoryBadge && event.category) {
        categoryBadge.className = `event-category-badge large ${event.category.toLowerCase()}`;
    }

    // ---- MAIN IMAGE ----
    const mainImg = document.getElementById('event-main-image');
    if (mainImg) {
        if (event.imageURL) {
            mainImg.src = event.imageURL;
            mainImg.alt = event.title;
        } else {
            mainImg.src = 'assets/icons/event-placeholder.png';
        }
    }

    // ---- DESCRIPTION ----
    const descEl = document.getElementById('event-description');
    if (descEl) {
        descEl.textContent = event.description || 'No description available.';
    }

    // ---- DETAIL ITEMS ----
    document.getElementById('event-date-detail').textContent = formatDateTime(event.date, event.time);
    document.getElementById('event-venue-detail').textContent = event.venue || 'TBA';
    document.getElementById('event-organizer-detail').textContent = event.organizer || 'EventSphere';
    document.getElementById('event-category-detail').textContent = capitalizeWords(event.category) || 'General';
    document.getElementById('event-ticket-limit').textContent = event.ticketLimit ? `${event.ticketLimit} seats` : 'Unlimited';

    // ---- ORGANIZER CARD ----
    document.getElementById('organizer-name-card').textContent = event.organizer || 'EventSphere';
}


// ============================================================
// SECTION 3: COUNTDOWN TIMER
// Updates every second until event date/time
// ============================================================

/**
 * Start a real-time countdown to the event
 *
 * @param {string} dateStr - Date string like "2025-12-25"
 * @param {string} timeStr - Time string like "18:00"
 */
function startCountdown(dateStr, timeStr) {

    // Combine date and time into a full datetime
    const eventDateTimeStr = timeStr
        ? `${dateStr}T${timeStr}:00`
        : `${dateStr}T00:00:00`;

    const eventDateTime = new Date(eventDateTimeStr);

    // If event is in the past, show "Event has ended"
    if (eventDateTime < new Date()) {
        const timerEl = document.getElementById('countdown-timer');
        if (timerEl) {
            timerEl.innerHTML = `
                <p style="text-align:center; color:#f87171; font-weight:600; padding:16px;">
                    ⏰ This event has already taken place
                </p>
            `;
        }
        return;
    }

    // Clear any existing countdown
    if (countdownInterval) clearInterval(countdownInterval);

    // Update countdown every second
    function updateCountdown() {
        const now = new Date();
        const diff = eventDateTime - now; // Milliseconds remaining

        if (diff <= 0) {
            // Event has started!
            clearInterval(countdownInterval);
            document.getElementById('days').textContent = '00';
            document.getElementById('hours').textContent = '00';
            document.getElementById('minutes').textContent = '00';
            document.getElementById('seconds').textContent = '00';
            return;
        }

        // Convert milliseconds to days, hours, minutes, seconds
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Update DOM with padded numbers (01, 09, etc.)
        document.getElementById('days').textContent = String(days).padStart(2, '0');
        document.getElementById('hours').textContent = String(hours).padStart(2, '0');
        document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
    }

    // Run immediately and then every second
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}


// ============================================================
// SECTION 4: AVAILABILITY BAR
// Shows how many tickets are left
// ============================================================

/**
 * Fetch registration count and update the availability bar
 *
 * @param {string} eventId - Event ID
 * @param {number} ticketLimit - Max tickets
 */
async function updateAvailabilityBar(eventId, ticketLimit) {
    try {
        // Count existing registrations for this event
        const regsSnap = await db
            .collection(COLLECTIONS.registrations)
            .where('eventId', '==', eventId)
            .get();

        const registeredCount = regsSnap.size;

        // Update registered count display
        document.getElementById('event-registered-count').textContent =
            `${registeredCount} registered`;

        if (!ticketLimit) {
            document.getElementById('avail-percentage').textContent = 'Unlimited';
            document.getElementById('avail-note').textContent = 'Open registration';
            document.getElementById('avail-fill').style.width = '0%';
            return;
        }

        const remainingTickets = ticketLimit - registeredCount;
        const percentageFilled = Math.min((registeredCount / ticketLimit) * 100, 100);

        // Update the fill bar width
        const fillBar = document.getElementById('avail-fill');
        if (fillBar) {
            fillBar.style.width = `${percentageFilled}%`;
            // Turn red when almost full (>80%)
            if (percentageFilled > 80) {
                fillBar.classList.add('almost-full');
            }
        }

        // Update text
        document.getElementById('avail-percentage').textContent =
            `${Math.round(percentageFilled)}% filled`;

        document.getElementById('avail-note').textContent =
            remainingTickets <= 0
                ? '🔴 No tickets remaining'
                : remainingTickets <= 10
                    ? `⚠️ Only ${remainingTickets} tickets left!`
                    : `✅ ${remainingTickets} tickets available`;

        // If event is full, show the full button
        if (remainingTickets <= 0) {
            showButtonState('full');
        }

        // Store in global event object for registration check
        if (currentEvent) {
            currentEvent._registeredCount = registeredCount;
        }

    } catch (error) {
        console.error("❌ Error updating availability:", error);
    }
}


// ============================================================
// SECTION 5: REGISTRATION STATUS CHECK
// Check if current user is already registered
// ============================================================

/**
 * Check if logged-in user is already registered for this event
 * Sets the correct button state based on result
 *
 * @param {Object} user - Firebase auth user
 * @param {string} eventId - Event ID
 */
async function checkUserRegistrationStatus(user, eventId) {
    try {
        // Check if event is full first
        if (currentEvent && currentEvent.ticketLimit &&
            currentEvent._registeredCount >= currentEvent.ticketLimit) {
            showButtonState('full');
            return;
        }

        // Query registrations for this specific user + event combination
        const existingReg = await db
            .collection(COLLECTIONS.registrations)
            .where('userId', '==', user.uid)
            .where('eventId', '==', eventId)
            .get();

        if (!existingReg.empty) {
            // User IS already registered
            const regData = existingReg.docs[0].data();
            showButtonState('registered', regData.registrationId);
        } else {
            // User is NOT registered - show register button
            showButtonState('can-register');

            // Attach click handler to register button
            const registerBtn = document.getElementById('btn-register-event');
            if (registerBtn) {
                registerBtn.addEventListener('click', () => registerForEvent(user));
            }
        }

    } catch (error) {
        console.error("❌ Error checking registration:", error);
        showButtonState('can-register');
    }
}

/**
 * Show the correct button based on registration state
 *
 * States:
 * 'not-logged-in' = Show login button
 * 'can-register'  = Show register button
 * 'registered'    = Show "already registered" message
 * 'full'          = Show "event full" disabled button
 *
 * @param {string} state - Button state to show
 * @param {string} regId - Registration ID (for 'registered' state)
 */
function showButtonState(state, regId = '') {
    // Hide all button elements first
    const allButtons = [
        'btn-login-to-register',
        'btn-register-event',
        'already-registered',
        'btn-event-full'
    ];

    allButtons.forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });

    // Show the correct one
    switch (state) {
        case 'not-logged-in':
            document.getElementById('btn-login-to-register')?.classList.remove('hidden');
            break;

        case 'can-register':
            const registerBtn = document.getElementById('btn-register-event');
            registerBtn?.classList.remove('hidden');
            break;

        case 'registered':
            const alreadyReg = document.getElementById('already-registered');
            alreadyReg?.classList.remove('hidden');
            const regIdEl = document.getElementById('user-reg-id');
            if (regIdEl) regIdEl.textContent = regId;
            break;

        case 'full':
            document.getElementById('btn-event-full')?.classList.remove('hidden');
            break;
    }
}


// ============================================================
// SECTION 6: EVENT REGISTRATION
// Save registration to Firestore + send email
// ============================================================

/**
 * Register the current user for the event
 * Steps:
 * 1. Generate unique registration ID
 * 2. Save to Firestore "registrations" collection
 * 3. Send confirmation email via EmailJS
 * 4. Show success popup
 *
 * @param {Object} user - Firebase auth user
 */
async function registerForEvent(user) {
    const registerBtn = document.getElementById('btn-register-event');
    const btnText = document.getElementById('register-btn-text');

    // Show loading state
    if (registerBtn) registerBtn.disabled = true;
    if (btnText) btnText.textContent = 'Registering...';

    try {
        // Generate unique registration ID
        const registrationId = generateRegistrationId();

        // Create registration document
        const registrationData = {
            registrationId: registrationId,
            eventId: currentEventId,
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName || 'Anonymous',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Save to Firestore "registrations" collection
        await db.collection(COLLECTIONS.registrations).add(registrationData);
        console.log("✅ Registration saved:", registrationId);

        // Send confirmation email via EmailJS
        await sendConfirmationEmail(user, registrationId);

        // Update button to "registered" state
        showButtonState('registered', registrationId);

        // Show success modal popup
        showSuccessModal(registrationId);

        // Refresh availability bar
        await updateAvailabilityBar(currentEventId, currentEvent?.ticketLimit);

    } catch (error) {
        console.error("❌ Registration error:", error);

        // Reset button
        if (registerBtn) registerBtn.disabled = false;
        if (btnText) btnText.textContent = 'Register Now';

        showToast("Registration failed. Please try again.", "error");
    }
}


// ============================================================
// SECTION 7: SEND CONFIRMATION EMAIL
// Uses EmailJS to send a confirmation email
// ============================================================

/**
 * Send registration confirmation email to user
 * Uses EmailJS service - no backend needed!
 *
 * @param {Object} user - Firebase auth user
 * @param {string} registrationId - Generated registration ID
 */
async function sendConfirmationEmail(user, registrationId) {
    // Check if EmailJS is loaded and configured
    if (typeof emailjs === 'undefined') {
        console.log("📧 EmailJS not loaded - skipping email");
        return;
    }

    try {
        // Template parameters that match your EmailJS template variables
        // Make sure your EmailJS template uses these variable names!
        const emailParams = {
            to_email: user.email,          // User's email address
            to_name: user.displayName || 'Attendee', // User's name
            event_name: currentEvent?.title || 'Event',
            event_date: formatDateTime(currentEvent?.date, currentEvent?.time),
            event_venue: currentEvent?.venue || 'TBA',
            registration_id: registrationId,
            organizer_name: currentEvent?.organizer || 'EventSphere'
        };

        await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            emailParams
        );

        console.log("✅ Confirmation email sent to:", user.email);

    } catch (error) {
        // Email failure is NOT critical - registration still saved
        console.log("⚠️ Email send failed (non-critical):", error);
    }
}


// ============================================================
// SECTION 8: SUCCESS MODAL
// Show animated popup after successful registration
// ============================================================

/**
 * Show the registration success popup/modal
 *
 * @param {string} registrationId - The registration ID to display
 */
function showSuccessModal(registrationId) {
    const modal = document.getElementById('success-modal');
    if (!modal) return;

    // Fill event name in modal
    const eventNameEl = document.getElementById('success-event-name');
    if (eventNameEl) eventNameEl.textContent = currentEvent?.title || 'Event';

    // Fill registration ID
    const regIdEl = document.getElementById('success-reg-id');
    if (regIdEl) regIdEl.textContent = registrationId;

    // Show the modal
    modal.classList.remove('hidden');

    // Create confetti effect
    createConfetti();
}

/**
 * Create colorful confetti animation in the success modal
 */
function createConfetti() {
    const container = document.getElementById('confetti');
    if (!container) return;

    const colors = ['#8b5cf6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

    // Create 20 confetti pieces
    for (let i = 0; i < 20; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';

        // Random position and style
        piece.style.cssText = `
            left: ${Math.random() * 100}%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            width: ${Math.random() * 8 + 4}px;
            height: ${Math.random() * 8 + 4}px;
            animation-duration: ${Math.random() * 1.5 + 0.5}s;
            animation-delay: ${Math.random() * 0.5}s;
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        `;

        container.appendChild(piece);

        // Remove after animation
        setTimeout(() => piece.remove(), 2000);
    }
}

/**
 * Setup modal close button
 */
function setupModalClose() {
    const closeBtn = document.getElementById('close-success-modal');
    const overlay = document.getElementById('modal-overlay');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('success-modal')?.classList.add('hidden');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            document.getElementById('success-modal')?.classList.add('hidden');
        });
    }
}


// ============================================================
// SECTION 9: SHARE EVENT
// Share event on social media or copy link
// ============================================================

/**
 * Share event on social media
 *
 * @param {string} platform - "twitter" or "facebook"
 */
function shareEvent(platform) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Check out this event: ${currentEvent?.title || 'Amazing Event'} on EventSphere!`);

    let shareUrl;

    switch (platform) {
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
    }

    if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400');
}

/**
 * Copy event link to clipboard
 */
function copyEventLink() {
    navigator.clipboard.writeText(window.location.href)
        .then(() => showToast("Link copied to clipboard!", "success"))
        .catch(() => showToast("Could not copy link", "error"));
}

/**
 * Copy registration ID to clipboard
 */
function copyRegId() {
    const regId = document.getElementById('success-reg-id')?.textContent;
    if (regId) {
        navigator.clipboard.writeText(regId)
            .then(() => showToast("Registration ID copied!", "success"))
            .catch(() => { });
    }
}


// ============================================================
// SECTION 10: ERROR STATES
// ============================================================

function showEventError() {
    document.getElementById('event-loading')?.classList.add('hidden');
    document.getElementById('event-error')?.classList.remove('hidden');
}

// Make share functions globally accessible (called from onclick in HTML)
window.shareEvent = shareEvent;
window.copyEventLink = copyEventLink;
window.copyRegId = copyRegId;

console.log("📁 event-details.js loaded");