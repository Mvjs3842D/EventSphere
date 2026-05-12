// ============================================================
// DASHBOARD JAVASCRIPT (dashboard.js)
// Handles the user dashboard page functionality
//
// What this file does:
// 1. Verify user is logged in (protect the page)
// 2. Load user profile from Firestore
// 3. Load user's registered events
// 4. Handle tab switching (Overview, My Events, Profile)
// 5. Profile editing (phone, bio)
// 6. Stats counting (total events, upcoming, etc.)
// ============================================================

// ============================================================
// SECTION 1: PAGE INITIALIZATION
// Runs when dashboard page loads
// ============================================================

document.addEventListener('DOMContentLoaded', async function () {

    // Wait for Firebase Auth to tell us who is logged in
    // This might take a moment - so we wait properly
    const user = await waitForAuthState();

    // If no user logged in, redirect to login
    if (!user) {
        console.log("🔒 Not logged in - redirecting to login");
        window.location.href = 'login.html';
        return;
    }

    console.log("✅ Dashboard loaded for:", user.email);

    // Hide the loading overlay
    hidePageLoader();

    // Load all dashboard data
    loadUserProfile(user);
    loadUserStats(user);
    loadUpcomingEvents(user);
    loadMyEvents(user);
    loadRecentActivity(user);

    // Setup tab navigation
    setupTabNavigation();

    // Setup profile form submission
    setupProfileForm(user);

    // Setup logout buttons
    setupLogoutButtons();
});


// ============================================================
// SECTION 2: HIDE PAGE LOADER
// Remove loading screen after data is ready
// ============================================================

function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}


// ============================================================
// SECTION 3: LOAD USER PROFILE
// Fetch user data from Firestore and display it
// ============================================================

/**
 * Load and display user profile information
 * Fills sidebar, header, and profile tab with user data
 *
 * @param {Object} user - Firebase auth user object
 */
async function loadUserProfile(user) {
    try {
        // Fetch user document from Firestore
        const userDoc = await db
            .collection(COLLECTIONS.users)
            .doc(user.uid)
            .get();

        // Get user data from Firestore
        // If no Firestore data, fall back to Firebase Auth data
        const userData = userDoc.exists ? userDoc.data() : {};

        const name = userData.name || user.displayName || 'User';
        const email = userData.email || user.email || '';
        const photo = userData.profileImage || user.photoURL || 'assets/icons/default-avatar.png';
        const phone = userData.phone || '';
        const bio = userData.bio || '';

        // ---- Update Sidebar ----
        setElementText('sidebar-name', name);
        setElementSrc('sidebar-avatar', photo);

        // ---- Update Header ----
        setElementSrc('header-avatar', photo);

        // ---- Update Welcome Banner ----
        // Show first name only in greeting
        const firstName = name.split(' ')[0];
        setElementText('welcome-name', firstName);

        // ---- Update Profile Tab ----
        setElementSrc('profile-avatar', photo);
        setElementText('profile-name', name);
        setElementText('profile-email', email);

        // Fill profile form fields
        setInputValue('profile-name-input', name);
        setInputValue('profile-email-input', email);
        setInputValue('profile-phone', phone);
        setInputValue('profile-bio', bio);

        // Calculate profile completion %
        updateProfileCompletion(userData, user);

        console.log("✅ User profile loaded");

    } catch (error) {
        console.error("❌ Error loading user profile:", error);
    }
}

/**
 * Calculate and show profile completion percentage
 * Based on which fields the user has filled
 */
function updateProfileCompletion(userData, user) {
    // Define which fields contribute to completion
    const fields = [
        userData.name || user.displayName,   // 25%
        userData.email || user.email,         // 25%
        userData.phone,                       // 25%
        userData.bio                          // 25%
    ];

    // Count filled fields
    const filledCount = fields.filter(field => field && field.trim()).length;
    const percentage = Math.round((filledCount / fields.length) * 100);

    // Update the stat display
    setElementText('profile-complete', `${percentage}%`);
}


// ============================================================
// SECTION 4: LOAD USER STATS
// Count registered events, upcoming events, etc.
// ============================================================

/**
 * Load and display user statistics cards
 * Counts events from Firestore registrations collection
 *
 * @param {Object} user - Firebase auth user
 */
async function loadUserStats(user) {
    try {
        // Query all registrations for this user
        // We filter by userId to get only THIS user's registrations
        const registrationsSnap = await db
            .collection(COLLECTIONS.registrations)
            .where('userId', '==', user.uid)
            .get();

        const totalRegistered = registrationsSnap.size;
        let upcomingCount = 0;
        let attendedCount = 0;

        // Count upcoming vs past events
        const today = new Date();

        // For each registration, check if event is upcoming or past
        for (const doc of registrationsSnap.docs) {
            const reg = doc.data();
            // We need to fetch the event to check its date
            // This is fine for small numbers of events
            try {
                const eventDoc = await db
                    .collection(COLLECTIONS.events)
                    .doc(reg.eventId)
                    .get();

                if (eventDoc.exists) {
                    const eventDate = new Date(eventDoc.data().date);
                    if (eventDate > today) {
                        upcomingCount++;
                    } else {
                        attendedCount++;
                    }
                }
            } catch (e) {
                // Event might have been deleted - skip it
            }
        }

        // Update DOM elements with counts
        setElementText('total-registered', totalRegistered);
        setElementText('upcoming-count', upcomingCount);
        setElementText('attended-count', attendedCount);
        setElementText('p-events-count', totalRegistered);

        // Update sidebar badge
        setElementText('event-count-badge', totalRegistered);

        console.log(`✅ Stats: ${totalRegistered} registered, ${upcomingCount} upcoming`);

    } catch (error) {
        console.error("❌ Error loading stats:", error);
        // Show zeros if error
        ['total-registered', 'upcoming-count', 'attended-count'].forEach(id => {
            setElementText(id, '0');
        });
    }
}


// ============================================================
// SECTION 5: LOAD UPCOMING EVENTS (Overview Tab)
// Shows the next few upcoming events in the overview
// ============================================================

/**
 * Load upcoming events for the overview tab list
 * Shows user's registered events sorted by date
 *
 * @param {Object} user - Firebase auth user
 */
async function loadUpcomingEvents(user) {
    const listContainer = document.getElementById('upcoming-events-list');
    if (!listContainer) return;

    try {
        // Fetch user's registrations
        const registrationsSnap = await db
            .collection(COLLECTIONS.registrations)
            .where('userId', '==', user.uid)
            .get();

        if (registrationsSnap.empty) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:24px; color:rgba(255,255,255,0.4); font-size:0.85rem;">
                    <p>📅 No upcoming events yet</p>
                    <a href="events.html" style="color:#8b5cf6; text-decoration:underline;">Browse Events</a>
                </div>
            `;
            return;
        }

        // Fetch event details for each registration
        const eventPromises = registrationsSnap.docs.map(async (doc) => {
            const reg = doc.data();
            try {
                const eventDoc = await db
                    .collection(COLLECTIONS.events)
                    .doc(reg.eventId)
                    .get();
                if (eventDoc.exists) {
                    return {
                        ...eventDoc.data(),
                        id: eventDoc.id,
                        registrationId: reg.registrationId
                    };
                }
            } catch (e) {
                return null;
            }
        });

        // Wait for all event fetches
        let events = await Promise.all(eventPromises);

        // Remove null values (deleted events)
        events = events.filter(e => e !== null);

        // Filter only upcoming events
        const today = new Date();
        const upcomingEvents = events
            .filter(e => new Date(e.date) > today)
            .sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort by date
            .slice(0, 4); // Show max 4

        if (upcomingEvents.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:24px; color:rgba(255,255,255,0.4); font-size:0.85rem;">
                    <p>No upcoming events</p>
                    <a href="events.html" style="color:#8b5cf6;">Find Events →</a>
                </div>
            `;
            return;
        }

        // Build HTML for each event
        listContainer.innerHTML = upcomingEvents.map(event => {
            const eventDate = new Date(event.date);
            const day = eventDate.getDate();
            const month = eventDate.toLocaleDateString('en-US', { month: 'short' });

            return `
                <a href="event-details.html?id=${event.id}" class="upcoming-event-item">
                    <div class="upcoming-event-date">
                        <span class="day">${day}</span>
                        <span class="month">${month}</span>
                    </div>
                    <div class="upcoming-event-info">
                        <div class="upcoming-event-title">${event.title}</div>
                        <div class="upcoming-event-venue">
                            <i class="fas fa-map-marker-alt"></i>
                            ${truncateText(event.venue, 30)}
                        </div>
                    </div>
                    <i class="fas fa-chevron-right upcoming-event-arrow"></i>
                </a>
            `;
        }).join('');

    } catch (error) {
        console.error("❌ Error loading upcoming events:", error);
        listContainer.innerHTML = '<p style="color:rgba(255,255,255,0.3); padding:16px; font-size:0.85rem;">Could not load events</p>';
    }
}


// ============================================================
// SECTION 6: LOAD MY EVENTS (My Events Tab)
// Shows all registered events in a card grid
// ============================================================

/**
 * Load all registered events for the My Events tab
 * Shows cards with event details and registration ID
 *
 * @param {Object} user - Firebase auth user
 */
async function loadMyEvents(user) {
    const grid = document.getElementById('my-events-grid');
    const loadingEl = document.getElementById('events-loading');
    const emptyEl = document.getElementById('events-empty');

    if (!grid) return;

    try {
        // Fetch all registrations for this user
        const registrationsSnap = await db
            .collection(COLLECTIONS.registrations)
            .where('userId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .get();

        // Hide loading state
        if (loadingEl) loadingEl.classList.add('hidden');

        if (registrationsSnap.empty) {
            // Show empty state
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        // Fetch complete event details for each registration
        const eventCards = [];

        for (const doc of registrationsSnap.docs) {
            const reg = doc.data();

            try {
                const eventDoc = await db
                    .collection(COLLECTIONS.events)
                    .doc(reg.eventId)
                    .get();

                if (eventDoc.exists) {
                    const event = eventDoc.data();
                    const isPast = isPastDate(event.date);

                    // Create the event card HTML
                    const cardHTML = `
                        <div class="my-event-card" data-status="${isPast ? 'past' : 'upcoming'}">
                            <div class="my-event-image">
                                ${event.imageURL
                            ? `<img src="${event.imageURL}" alt="${event.title}" loading="lazy">`
                            : `<div style="height:100%; display:flex; align-items:center; justify-content:center; font-size:2.5rem; background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(99,102,241,0.1))">🎉</div>`
                        }
                                <span class="my-event-category">${capitalizeWords(event.category)}</span>
                                <span class="my-event-status ${isPast ? 'past' : 'upcoming'}">
                                    ${isPast ? 'Past' : 'Upcoming'}
                                </span>
                            </div>
                            <div class="my-event-body">
                                <h3 class="my-event-title">${event.title}</h3>
                                <div class="my-event-meta">
                                    <div class="my-event-meta-item">
                                        <i class="fas fa-calendar-alt"></i>
                                        <span>${formatDate(event.date)}</span>
                                    </div>
                                    <div class="my-event-meta-item">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <span>${truncateText(event.venue, 35)}</span>
                                    </div>
                                </div>
                                <div class="my-event-reg-id">
                                    <span>Registration ID:</span>
                                    <code>${reg.registrationId || 'N/A'}</code>
                                </div>
                                <a href="event-details.html?id=${eventDoc.id}" class="my-event-action">
                                    <i class="fas fa-eye"></i>
                                    View Event
                                </a>
                            </div>
                        </div>
                    `;
                    eventCards.push(cardHTML);
                }
            } catch (e) {
                console.log("Skipping deleted event:", reg.eventId);
            }
        }

        if (eventCards.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        // Add cards to grid (after removing loading state)
        grid.innerHTML = eventCards.join('');

        // Setup filter pills for My Events tab
        setupEventFilterPills();

        console.log(`✅ Loaded ${eventCards.length} registered events`);

    } catch (error) {
        console.error("❌ Error loading my events:", error);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:40px; color:rgba(255,255,255,0.4)">
                    <p>Error loading events. Please refresh.</p>
                </div>
            `;
        }
    }
}

/**
 * Setup filter pills (All, Upcoming, Past) in My Events tab
 */
function setupEventFilterPills() {
    const pills = document.querySelectorAll('.filter-pill');
    const cards = document.querySelectorAll('.my-event-card');

    pills.forEach(pill => {
        pill.addEventListener('click', function () {
            // Update active pill style
            pills.forEach(p => p.classList.remove('active'));
            this.classList.add('active');

            const filter = this.dataset.filter;

            // Show/hide cards based on filter
            cards.forEach(card => {
                const status = card.dataset.status; // 'upcoming' or 'past'
                if (filter === 'all' || status === filter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}


// ============================================================
// SECTION 7: RECENT ACTIVITY
// Shows latest actions in the activity feed
// ============================================================

/**
 * Load recent activity for the overview tab
 *
 * @param {Object} user - Firebase auth user
 */
async function loadRecentActivity(user) {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    try {
        // Get last 5 registrations as activity
        const regsSnap = await db
            .collection(COLLECTIONS.registrations)
            .where('userId', '==', user.uid)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        if (regsSnap.empty) {
            activityList.innerHTML = `
                <div class="activity-item">
                    <div class="activity-dot"></div>
                    <div class="activity-text">
                        <p>No activity yet - register for an event!</p>
                        <span>Just now</span>
                    </div>
                </div>
            `;
            return;
        }

        const activities = [];

        for (const doc of regsSnap.docs) {
            const reg = doc.data();
            // Format timestamp
            let timeAgo = 'Recently';
            if (reg.timestamp) {
                timeAgo = getTimeAgo(reg.timestamp.toDate());
            }

            activities.push(`
                <div class="activity-item">
                    <div class="activity-dot"></div>
                    <div class="activity-text">
                        <p>Registered for event</p>
                        <span>${timeAgo} · ID: ${reg.registrationId || 'N/A'}</span>
                    </div>
                </div>
            `);
        }

        activityList.innerHTML = activities.join('');

    } catch (error) {
        console.error("❌ Error loading activity:", error);
    }
}

/**
 * Convert a date to "X time ago" format
 * Example: "2 hours ago", "3 days ago"
 *
 * @param {Date} date - Date to convert
 * @returns {string} Relative time string
 */
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
    return formatDate(date);
}


// ============================================================
// SECTION 8: TAB NAVIGATION
// Handle switching between Overview, My Events, Profile tabs
// ============================================================

/**
 * Setup sidebar tab navigation
 * Clicking a menu item shows that tab's content
 */
function setupTabNavigation() {
    // Get all sidebar links with data-tab attribute
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            const targetTab = this.dataset.tab;

            // Update active link style
            sidebarLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Show the correct tab content, hide others
            tabContents.forEach(tab => {
                if (tab.id === `tab-${targetTab}`) {
                    tab.classList.remove('hidden');
                    tab.classList.add('active');
                } else {
                    tab.classList.add('hidden');
                    tab.classList.remove('active');
                }
            });

            // Update page title in header
            updatePageTitle(targetTab);

            // Close mobile sidebar after selection
            const sidebar = document.getElementById('sidebar');
            if (sidebar && window.innerWidth < 900) {
                sidebar.classList.remove('sidebar-open');
            }
        });
    });

    // Handle "View All" links that switch tabs
    document.querySelectorAll('[data-tab-link]').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetTab = this.dataset.tabLink;
            // Find and click the corresponding sidebar link
            const sidebarLink = document.querySelector(`.sidebar-link[data-tab="${targetTab}"]`);
            if (sidebarLink) sidebarLink.click();
        });
    });

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function () {
            sidebar.classList.toggle('sidebar-open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', function (e) {
            if (window.innerWidth < 900 &&
                sidebar.classList.contains('sidebar-open') &&
                !sidebar.contains(e.target) &&
                !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('sidebar-open');
            }
        });
    }
}

/**
 * Update the header title based on active tab
 *
 * @param {string} tab - Tab name
 */
function updatePageTitle(tab) {
    const titles = {
        'overview': { title: 'Overview', subtitle: "Welcome back! Here's what's happening." },
        'my-events': { title: 'My Events', subtitle: 'All your registered events' },
        'profile': { title: 'My Profile', subtitle: 'Manage your personal information' }
    };

    const info = titles[tab] || titles['overview'];
    setElementText('page-title', info.title);
    setElementText('page-subtitle', info.subtitle);
}


// ============================================================
// SECTION 9: PROFILE FORM
// Handle profile editing (phone, bio)
// ============================================================

/**
 * Setup profile edit form submission
 * Saves phone and bio to Firestore
 *
 * @param {Object} user - Firebase auth user
 */
function setupProfileForm(user) {
    const form = document.getElementById('profile-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault(); // Stop form from refreshing page

        const phone = document.getElementById('profile-phone')?.value?.trim() || '';
        const bio = document.getElementById('profile-bio')?.value?.trim() || '';

        const submitBtn = form.querySelector('.form-submit');
        const successMsg = document.getElementById('profile-save-success');

        // Show loading on button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="mini-spinner"></div> Saving...';
        }

        try {
            // Update user document in Firestore
            // Only update phone and bio - don't touch name/email
            await db.collection(COLLECTIONS.users).doc(user.uid).update({
                phone: phone,
                bio: bio,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Profile updated successfully");

            // Show success message
            if (successMsg) {
                successMsg.classList.remove('hidden');
                // Hide after 3 seconds
                setTimeout(() => {
                    successMsg.classList.add('hidden');
                }, 3000);
            }

        } catch (error) {
            console.error("❌ Error updating profile:", error);
            showToast("Error saving profile. Please try again.", "error");
        } finally {
            // Reset button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
            }
        }
    });
}


// ============================================================
// SECTION 10: LOGOUT
// Handle logout button clicks
// ============================================================

function setupLogoutButtons() {
    const logoutBtns = document.querySelectorAll('#btn-logout');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            signOut();
        });
    });
}


// ============================================================
// SECTION 11: DOM HELPER FUNCTIONS
// Small reusable functions to update DOM elements
// ============================================================

/**
 * Set text content of an element by ID
 */
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

/**
 * Set src attribute of an image by ID
 */
function setElementSrc(id, src) {
    const el = document.getElementById(id);
    if (el && src) {
        el.src = src;
        // Fallback if image fails
        el.onerror = () => { el.src = 'assets/icons/default-avatar.png'; };
    }
}

/**
 * Set value of an input/textarea by ID
 */
function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
}

// Log dashboard.js loaded
console.log("📁 dashboard.js loaded");