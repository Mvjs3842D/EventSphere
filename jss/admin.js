// ============================================================
// ADMIN PANEL JAVASCRIPT (admin.js)
// Controls the entire admin panel functionality
//
// What this file does:
// 1. Verify admin access (check email)
// 2. Load dashboard analytics from Firestore
// 3. Create events (upload image + save to Firestore)
// 4. Read events (list all events in table)
// 5. Update events (edit form + save changes)
// 6. Delete events (remove from Firestore)
// 7. View registrations table
// 8. View users table
// 9. Draw analytics charts using Chart.js
// 10. Real-time clock
// ============================================================

// Store event being edited (for the edit modal)
let currentEditEventId = null;

// Store event being deleted (for confirm modal)
let currentDeleteEventId = null;

// Store all events for admin table
let adminAllEvents = [];

// Chart instances (we need to track these to destroy before redrawing)
let registrationsChart = null;
let categoryChart = null;


// ============================================================
// SECTION 1: INITIALIZATION
// First thing that runs on admin page load
// ============================================================

document.addEventListener('DOMContentLoaded', async function () {
    console.log("🔐 Admin panel loading - checking access...");

    // Wait for Firebase Auth to initialize
    const user = await waitForAuthState();

    // Step 1: Check if someone is logged in
    if (!user) {
        showAccessDenied("Please login first");
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    // Step 2: Check if this user is the admin
    if (!isAdmin(user)) {
        console.log("❌ Access denied for:", user.email);
        showAccessDenied(`Access denied. Admin email: ${ADMIN_EMAIL}`);
        return;
    }

    console.log("✅ Admin access granted for:", user.email);

    // Step 3: Show admin panel
    showAdminPanel(user);

    // Step 4: Load all data
    loadAdminDashboard();
    loadEventsTable();
    loadRegistrationsTable();
    loadUsersTable();

    // Step 5: Setup all admin interactions
    setupAdminTabNavigation();
    setupAddEventForm();
    setupEditEventModal();
    setupDeleteModal();
    setupAdminSearch();
    setupExportButton();
    startAdminClock();
});


// ============================================================
// SECTION 2: ACCESS CONTROL
// Show/hide admin panel based on auth status
// ============================================================

/**
 * Show access denied screen
 * Displayed to non-admin users
 */
function showAccessDenied(message) {
    document.getElementById('admin-auth-check')?.classList.add('hidden');
    document.getElementById('access-denied')?.classList.remove('hidden');
    console.log("🔒 Access denied:", message);
}

/**
 * Show the admin panel and populate admin info
 *
 * @param {Object} user - Firebase auth user
 */
function showAdminPanel(user) {
    // Hide auth check overlay
    document.getElementById('admin-auth-check')?.classList.add('hidden');
    // Hide access denied
    document.getElementById('access-denied')?.classList.add('hidden');
    // Show admin panel
    document.getElementById('admin-panel')?.classList.remove('hidden');

    // Set admin profile info
    setAdminProfileInfo(user);
}

/**
 * Fill admin name/avatar in sidebar and welcome
 */
function setAdminProfileInfo(user) {
    const name = user.displayName || 'Admin';
    const photo = user.photoURL || 'assets/icons/default-avatar.png';

    const adminAvatar = document.getElementById('admin-avatar');
    const adminName = document.getElementById('admin-name');
    const adminWelcomeName = document.getElementById('admin-welcome-name');

    if (adminAvatar) {
        adminAvatar.src = photo;
        adminAvatar.onerror = () => adminAvatar.src = 'assets/icons/default-avatar.png';
    }
    if (adminName) adminName.textContent = name;
    if (adminWelcomeName) adminWelcomeName.textContent = name.split(' ')[0];

    // Set today's date
    const dateEl = document.getElementById('admin-welcome-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}


// ============================================================
// SECTION 3: ADMIN DASHBOARD (Analytics + Charts)
// Load numbers and draw charts on dashboard tab
// ============================================================

/**
 * Load all analytics data for the admin dashboard
 */
async function loadAdminDashboard() {
    try {
        // Fetch counts in parallel for speed
        const [eventsSnap, usersSnap, regsSnap] = await Promise.all([
            db.collection(COLLECTIONS.events).get(),
            db.collection(COLLECTIONS.users).get(),
            db.collection(COLLECTIONS.registrations).get()
        ]);

        const totalEvents = eventsSnap.size;
        const totalUsers = usersSnap.size;
        const totalRegistrations = regsSnap.size;

        // Update metric cards
        animateNumber('metric-events', totalEvents);
        animateNumber('metric-users', totalUsers);
        animateNumber('metric-registrations', totalRegistrations);

        // Update nav badges
        document.getElementById('events-nav-count').textContent = totalEvents;
        document.getElementById('reg-nav-count').textContent = totalRegistrations;
        document.getElementById('users-nav-count').textContent = totalUsers;

        // Update notification badge
        document.getElementById('notif-count').textContent = totalRegistrations;

        // Find most popular event
        findMostPopularEvent(regsSnap);

        // Load recent registrations table
        loadRecentRegistrations(regsSnap, eventsSnap);

        // Draw charts
        drawRegistrationsChart(regsSnap);
        drawCategoryChart(eventsSnap);

        // Update analytics tab numbers
        updateAnalyticsTab(totalEvents, totalUsers, totalRegistrations, eventsSnap, regsSnap);

    } catch (error) {
        console.error("❌ Error loading dashboard:", error);
        showToast("Error loading analytics data", "error");
    }
}

/**
 * Animate number counting up (like a counter)
 *
 * @param {string} elementId - ID of element to animate
 * @param {number} target - Final number
 */
function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let current = 0;
    const duration = 1500;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = Math.floor(current).toLocaleString();
    }, 16);
}

/**
 * Find which event has most registrations
 */
async function findMostPopularEvent(regsSnap) {
    const el = document.getElementById('metric-popular');
    if (!el) return;

    // Count registrations per event
    const eventCounts = {};
    regsSnap.forEach(doc => {
        const eventId = doc.data().eventId;
        eventCounts[eventId] = (eventCounts[eventId] || 0) + 1;
    });

    if (Object.keys(eventCounts).length === 0) {
        el.textContent = 'No events yet';
        return;
    }

    // Find event with max registrations
    const topEventId = Object.keys(eventCounts).reduce((a, b) =>
        eventCounts[a] > eventCounts[b] ? a : b
    );

    try {
        const eventDoc = await db.collection(COLLECTIONS.events).doc(topEventId).get();
        if (eventDoc.exists) {
            el.textContent = truncateText(eventDoc.data().title, 25);
        }
    } catch (e) {
        el.textContent = 'N/A';
    }
}

/**
 * Load recent registrations in dashboard table
 */
async function loadRecentRegistrations(regsSnap, eventsSnap) {
    const tbody = document.getElementById('recent-reg-tbody');
    if (!tbody) return;

    // Create events lookup map for quick access
    const eventsMap = {};
    eventsSnap.forEach(doc => {
        eventsMap[doc.id] = doc.data().title;
    });

    // Get last 5 registrations (most recent first)
    const recentRegs = [];
    regsSnap.forEach(doc => recentRegs.push({ id: doc.id, ...doc.data() }));

    // Sort by timestamp and take last 5
    recentRegs.sort((a, b) => {
        const tA = a.timestamp?.toMillis?.() || 0;
        const tB = b.timestamp?.toMillis?.() || 0;
        return tB - tA;
    });

    const recent = recentRegs.slice(0, 5);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:rgba(255,255,255,0.3)">No registrations yet</td></tr>';
        return;
    }

    tbody.innerHTML = recent.map(reg => `
        <tr>
            <td><code style="color:#a78bfa; font-size:0.78rem">${reg.registrationId || 'N/A'}</code></td>
            <td style="font-size:0.82rem">${reg.userEmail || 'N/A'}</td>
            <td style="font-size:0.82rem">${truncateText(eventsMap[reg.eventId] || 'Unknown Event', 30)}</td>
            <td style="font-size:0.78rem; color:rgba(255,255,255,0.5)">
                ${reg.timestamp ? formatDate(reg.timestamp.toDate()) : 'N/A'}
            </td>
            <td><span class="status-badge confirmed">✓ Confirmed</span></td>
        </tr>
    `).join('');
}


// ============================================================
// SECTION 4: CHARTS (using Chart.js library)
// Draw visual charts for the admin dashboard
// ============================================================

/**
 * Draw the registrations over time line chart
 */
function drawRegistrationsChart(regsSnap) {
    const canvas = document.getElementById('registrations-chart');
    if (!canvas) return;

    // Destroy previous chart if exists (prevent duplicates)
    if (registrationsChart) {
        registrationsChart.destroy();
    }

    // Count registrations per day for last 7 days
    const labels = [];
    const data = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayLabel);

        // Count registrations on this date
        let count = 0;
        regsSnap.forEach(doc => {
            const reg = doc.data();
            if (reg.timestamp) {
                const regDate = reg.timestamp.toDate();
                if (regDate.toDateString() === date.toDateString()) {
                    count++;
                }
            }
        });
        data.push(count);
    }

    // Create Chart.js line chart
    registrationsChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Registrations',
                data: data,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,      // Curved lines
                pointBackgroundColor: '#8b5cf6',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: 'rgba(255,255,255,0.4)',
                        stepSize: 1
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: {
                    ticks: { color: 'rgba(255,255,255,0.4)' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

/**
 * Draw the category distribution donut chart
 */
function drawCategoryChart(eventsSnap) {
    const canvas = document.getElementById('category-chart');
    if (!canvas) return;

    if (categoryChart) categoryChart.destroy();

    // Count events per category
    const categoryCounts = {};
    eventsSnap.forEach(doc => {
        const cat = doc.data().category || 'other';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const labels = Object.keys(categoryCounts).map(c => capitalizeWords(c));
    const data = Object.values(categoryCounts);

    // Color palette for chart segments
    const colors = [
        '#8b5cf6', '#6366f1', '#10b981',
        '#f59e0b', '#ef4444', '#3b82f6',
        '#ec4899', '#14b8a6'
    ];

    categoryChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderColor: '#0f0f1e',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255,255,255,0.6)',
                        padding: 12,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

/**
 * Update analytics tab with additional charts
 */
function updateAnalyticsTab(totalEvents, totalUsers, totalRegistrations, eventsSnap, regsSnap) {
    // Update number displays
    const avgPerEvent = totalEvents > 0 ? Math.round(totalRegistrations / totalEvents) : 0;

    document.getElementById('a-total-events')?.setAttribute('data-val', totalEvents);
    document.getElementById('a-total-users')?.setAttribute('data-val', totalUsers);
    document.getElementById('a-total-reg')?.setAttribute('data-val', totalRegistrations);

    const analyticsEls = {
        'a-total-events': totalEvents,
        'a-total-users': totalUsers,
        'a-total-reg': totalRegistrations,
        'a-avg-reg': avgPerEvent
    };

    Object.entries(analyticsEls).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    });

    // Draw popular events bar chart
    drawPopularEventsChart(eventsSnap, regsSnap);
}

/**
 * Draw horizontal bar chart of most popular events
 */
async function drawPopularEventsChart(eventsSnap, regsSnap) {
    const canvas = document.getElementById('popular-events-chart');
    if (!canvas) return;

    // Count registrations per event
    const eventRegCounts = {};
    regsSnap.forEach(doc => {
        const id = doc.data().eventId;
        eventRegCounts[id] = (eventRegCounts[id] || 0) + 1;
    });

    // Get event titles
    const eventData = [];
    eventsSnap.forEach(doc => {
        eventData.push({
            title: truncateText(doc.data().title, 25),
            count: eventRegCounts[doc.id] || 0
        });
    });

    // Sort by count and take top 5
    eventData.sort((a, b) => b.count - a.count);
    const top5 = eventData.slice(0, 5);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: top5.map(e => e.title),
            datasets: [{
                label: 'Registrations',
                data: top5.map(e => e.count),
                backgroundColor: 'rgba(139, 92, 246, 0.6)',
                borderColor: '#8b5cf6',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y', // Horizontal bars
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: 'rgba(255,255,255,0.4)', stepSize: 1 },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}


// ============================================================
// SECTION 5: MANAGE EVENTS TABLE
// List all events with edit/delete buttons
// ============================================================

/**
 * Load all events into the manage events table
 */
async function loadEventsTable() {
    const tbody = document.getElementById('manage-events-tbody');
    if (!tbody) return;

    try {
        const snapshot = await db
            .collection(COLLECTIONS.events)
            .orderBy('createdAt', 'desc')
            .get();

        adminAllEvents = [];
        snapshot.forEach(doc => {
            adminAllEvents.push({ id: doc.id, ...doc.data() });
        });

        renderEventsTable(adminAllEvents);

    } catch (error) {
        console.error("❌ Error loading events table:", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:rgba(255,255,255,0.3)">Error loading events</td></tr>';
    }
}

/**
 * Render the events table with given data
 *
 * @param {Array} events - Events to render
 */
async function renderEventsTable(events) {
    const tbody = document.getElementById('manage-events-tbody');
    if (!tbody) return;

    if (events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:rgba(255,255,255,0.3)">No events found. Add your first event!</td></tr>';
        return;
    }

    // Count registrations for each event
    const regCounts = await getRegistrationCounts();

    tbody.innerHTML = events.map(event => `
        <tr>
            <td>
                ${event.imageURL
            ? `<img src="${event.imageURL}" class="table-event-img" alt="${event.title}">`
            : `<div class="table-event-img" style="background:rgba(139,92,246,0.15); display:flex; align-items:center; justify-content:center; font-size:1.2rem">🎉</div>`
        }
            </td>
            <td>
                <strong style="font-size:0.88rem; color:white">${truncateText(event.title, 35)}</strong>
            </td>
            <td>
                <span class="event-category-badge ${event.category || ''}" style="position:static; display:inline-block">
                    ${capitalizeWords(event.category) || 'N/A'}
                </span>
            </td>
            <td style="font-size:0.8rem; color:rgba(255,255,255,0.6)">${formatDate(event.date)}</td>
            <td style="font-size:0.8rem; color:rgba(255,255,255,0.6)">${truncateText(event.venue, 25)}</td>
            <td>
                <span style="font-size:0.82rem; color:#a78bfa; font-weight:600">
                    ${regCounts[event.id] || 0} / ${event.ticketLimit || '∞'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="table-action-btn edit" onclick="openEditModal('${event.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="table-action-btn delete" onclick="openDeleteModal('${event.id}', '${event.title.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Get registration counts for all events
 * Returns object like: { eventId: count, eventId2: count }
 */
async function getRegistrationCounts() {
    const counts = {};
    try {
        const snap = await db.collection(COLLECTIONS.registrations).get();
        snap.forEach(doc => {
            const id = doc.data().eventId;
            counts[id] = (counts[id] || 0) + 1;
        });
    } catch (e) { }
    return counts;
}


// ============================================================
// SECTION 6: ADD EVENT FORM
// Handle the event creation form submission
// ============================================================

/**
 * Setup event creation form
 * Handles image upload to Storage + data save to Firestore
 */
function setupAddEventForm() {
    const form = document.getElementById('add-event-form');
    const imageArea = document.getElementById('image-upload-area');
    const imageInput = document.getElementById('event-image-input');
    const preview = document.getElementById('upload-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const previewImg = document.getElementById('preview-img');
    const removeBtn = document.getElementById('remove-image');
    const textarea = document.getElementById('event-desc-input');
    const charCount = document.getElementById('desc-char-count');

    if (!form) return;

    // ---- Character Counter for Description ----
    if (textarea && charCount) {
        textarea.addEventListener('input', function () {
            charCount.textContent = `${this.value.length} characters`;
        });
    }

    // ---- Image Preview ----
    if (imageInput) {
        imageInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                showToast("Please select an image file", "error");
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast("Image must be smaller than 5MB", "error");
                return;
            }

            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                preview?.classList.remove('hidden');
                placeholder?.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    // ---- Remove Image Button ----
    if (removeBtn) {
        removeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (imageInput) imageInput.value = '';
            if (previewImg) previewImg.src = '';
            preview?.classList.add('hidden');
            placeholder?.classList.remove('hidden');
        });
    }

    // ---- Drag and Drop ----
    if (imageArea) {
        imageArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageArea.classList.add('dragover');
        });

        imageArea.addEventListener('dragleave', () => {
            imageArea.classList.remove('dragover');
        });

        imageArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && imageInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                imageInput.files = dt.files;
                imageInput.dispatchEvent(new Event('change'));
            }
        });
    }

    // ---- Reset Form Button ----
    document.getElementById('reset-form')?.addEventListener('click', function () {
        form.reset();
        preview?.classList.add('hidden');
        placeholder?.classList.remove('hidden');
        if (previewImg) previewImg.src = '';
        if (charCount) charCount.textContent = '0 characters';
    });

    // ---- Form Submit ----
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        await submitNewEvent();
    });
}

/**
 * Main function to create a new event
 * Steps:
 * 1. Validate form
 * 2. Upload image to Firebase Storage
 * 3. Get image download URL
 * 4. Save event data + URL to Firestore
 */
async function submitNewEvent() {
    const submitBtn = document.getElementById('submit-event-btn');
    const submitIcon = document.getElementById('submit-icon');
    const submitText = document.getElementById('submit-btn-text');
    const submitLoader = document.getElementById('submit-loader');
    const feedback = document.getElementById('event-form-feedback');
    const feedbackText = document.getElementById('form-feedback-text');

    // Collect form values
    const title = document.getElementById('event-title-input')?.value?.trim();
    const description = document.getElementById('event-desc-input')?.value?.trim();
    const date = document.getElementById('event-date-input')?.value;
    const time = document.getElementById('event-time-input')?.value;
    const venue = document.getElementById('event-venue-input')?.value?.trim();
    const category = document.getElementById('event-category-input')?.value;
    const organizer = document.getElementById('event-organizer-input')?.value?.trim();
    const ticketLimit = document.getElementById('event-limit-input')?.value;
    const imageFile = document.getElementById('event-image-input')?.files[0];

    // Basic validation
    if (!title || !description || !date || !time || !venue || !category || !organizer || !ticketLimit) {
        showToast("Please fill in all required fields", "error");
        return;
    }

    if (!imageFile) {
        showToast("Please upload an event image", "error");
        return;
    }

    // Show loading state
    submitBtn.disabled = true;
    submitIcon?.classList.add('hidden');
    submitLoader?.classList.remove('hidden');
    submitText.textContent = 'Uploading image...';

    try {
        // ---- STEP 1: Upload image to Firebase Storage ----
        const imageURL = await uploadEventImage(imageFile);
        console.log("✅ Image uploaded:", imageURL);

        submitText.textContent = 'Saving event...';

        // ---- STEP 2: Save event data to Firestore ----
        const eventData = {
            title: title,
            description: description,
            date: date,
            time: time,
            venue: venue,
            category: category,
            organizer: organizer,
            ticketLimit: parseInt(ticketLimit),
            imageURL: imageURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.currentUser.uid
        };

        // Add document to "events" collection
        // Firestore auto-generates a unique ID
        const docRef = await db.collection(COLLECTIONS.events).add(eventData);
        console.log("✅ Event saved with ID:", docRef.id);

        // ---- STEP 3: Show success ----
        feedback?.classList.remove('hidden');
        feedback?.classList.remove('error');
        if (feedbackText) feedbackText.textContent = `✅ Event "${title}" published successfully!`;

        showToast(`Event "${title}" created!`, "success");

        // Reset the form
        document.getElementById('add-event-form').reset();
        document.getElementById('upload-preview')?.classList.add('hidden');
        document.getElementById('upload-placeholder')?.classList.remove('hidden');
        document.getElementById('preview-img').src = '';

        // Refresh events table
        loadEventsTable();
        loadAdminDashboard();

        // Hide feedback after 5 seconds
        setTimeout(() => feedback?.classList.add('hidden'), 5000);

    } catch (error) {
        console.error("❌ Error creating event:", error);
        feedback?.classList.remove('hidden');
        feedback?.classList.add('error');
        if (feedbackText) feedbackText.textContent = `❌ Error: ${error.message}`;
        showToast("Failed to create event", "error");
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitIcon?.classList.remove('hidden');
        submitLoader?.classList.add('hidden');
        submitText.textContent = 'Publish Event';
    }
}

/**
 * Upload image file to Firebase Storage
 * Returns the download URL of the uploaded image
 *
 * @param {File} file - Image file to upload
 * @returns {Promise<string>} Download URL
 */
async function uploadEventImage(file) {
    return new Promise((resolve, reject) => {
        // Create unique filename using timestamp + original name
        const fileName = `events/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

        // Reference to where in Storage to save the file
        const storageRef = storage.ref(fileName);

        // Start the upload
        const uploadTask = storageRef.put(file);

        // Show progress bar
        const progressBar = document.getElementById('upload-progress');
        const progressFill = document.getElementById('upload-progress-fill');
        const progressText = document.getElementById('upload-progress-text');

        if (progressBar) progressBar.classList.remove('hidden');

        // Listen to upload progress
        uploadTask.on(
            'state_changed',
            // Progress callback
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const rounded = Math.round(progress);

                if (progressFill) progressFill.style.width = `${rounded}%`;
                if (progressText) progressText.textContent = `Uploading ${rounded}%`;
            },
            // Error callback
            (error) => {
                if (progressBar) progressBar.classList.add('hidden');
                reject(error);
            },
            // Success callback
            async () => {
                if (progressBar) progressBar.classList.add('hidden');
                // Get the download URL after upload completes
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                resolve(downloadURL);
            }
        );
    });
}


// ============================================================
// SECTION 7: EDIT EVENT MODAL
// Open modal with pre-filled form, save changes
// ============================================================

/**
 * Open the edit event modal and pre-fill with event data
 *
 * @param {string} eventId - Firestore event document ID
 */
async function openEditModal(eventId) {
    currentEditEventId = eventId;

    try {
        // Fetch the event from Firestore
        const eventDoc = await db.collection(COLLECTIONS.events).doc(eventId).get();

        if (!eventDoc.exists) {
            showToast("Event not found", "error");
            return;
        }

        const event = eventDoc.data();

        // Pre-fill all form fields with existing data
        document.getElementById('edit-event-id').value = eventId;
        document.getElementById('edit-title').value = event.title || '';
        document.getElementById('edit-desc').value = event.description || '';
        document.getElementById('edit-date').value = event.date || '';
        document.getElementById('edit-time').value = event.time || '';
        document.getElementById('edit-venue').value = event.venue || '';
        document.getElementById('edit-category').value = event.category || '';
        document.getElementById('edit-organizer').value = event.organizer || '';
        document.getElementById('edit-limit').value = event.ticketLimit || '';

        // Show the modal
        document.getElementById('edit-event-modal')?.classList.remove('hidden');

    } catch (error) {
        console.error("❌ Error loading event for edit:", error);
        showToast("Error loading event", "error");
    }
}

/**
 * Setup the edit event modal functionality
 */
function setupEditEventModal() {
    // Close modal buttons
    document.getElementById('close-edit-modal')?.addEventListener('click', closeEditModal);
    document.getElementById('cancel-edit')?.addEventListener('click', closeEditModal);

    // Close when clicking overlay
    document.getElementById('edit-modal-overlay')?.addEventListener('click', closeEditModal);

    // Image preview in edit form
    const editImageInput = document.getElementById('edit-image-input');
    if (editImageInput) {
        editImageInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const previewImg = document.getElementById('edit-preview-img');
                const preview = document.getElementById('edit-upload-preview');
                const placeholder = document.getElementById('edit-upload-placeholder');

                if (previewImg) previewImg.src = e.target.result;
                preview?.classList.remove('hidden');
                placeholder?.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    // Edit form submission
    document.getElementById('edit-event-form')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        await saveEditedEvent();
    });
}

/**
 * Save the edited event to Firestore
 * If new image selected, upload it first
 */
async function saveEditedEvent() {
    const submitBtn = document.querySelector('#edit-event-form .btn-primary');

    // Updated data
    const updatedData = {
        title: document.getElementById('edit-title')?.value?.trim(),
        description: document.getElementById('edit-desc')?.value?.trim(),
        date: document.getElementById('edit-date')?.value,
        time: document.getElementById('edit-time')?.value,
        venue: document.getElementById('edit-venue')?.value?.trim(),
        category: document.getElementById('edit-category')?.value,
        organizer: document.getElementById('edit-organizer')?.value?.trim(),
        ticketLimit: parseInt(document.getElementById('edit-limit')?.value),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Show loading
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="mini-spinner"></div> Saving...';
    }

    try {
        // Check if new image was selected
        const newImageFile = document.getElementById('edit-image-input')?.files[0];

        if (newImageFile) {
            // Upload new image first
            updatedData.imageURL = await uploadEventImage(newImageFile);
        }

        // Update Firestore document
        await db.collection(COLLECTIONS.events).doc(currentEditEventId).update(updatedData);

        console.log("✅ Event updated:", currentEditEventId);
        showToast(`Event "${updatedData.title}" updated!`, "success");

        closeEditModal();
        loadEventsTable();
        loadAdminDashboard();

    } catch (error) {
        console.error("❌ Error updating event:", error);
        showToast("Error updating event", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    }
}

function closeEditModal() {
    document.getElementById('edit-event-modal')?.classList.add('hidden');
    currentEditEventId = null;
}


// ============================================================
// SECTION 8: DELETE EVENT
// Confirm then delete event from Firestore
// ============================================================

/**
 * Open delete confirmation modal
 *
 * @param {string} eventId - Event to delete
 * @param {string} eventTitle - Event name for display
 */
function openDeleteModal(eventId, eventTitle) {
    currentDeleteEventId = eventId;
    const nameEl = document.getElementById('delete-event-name');
    if (nameEl) nameEl.textContent = eventTitle;
    document.getElementById('delete-confirm-modal')?.classList.remove('hidden');
}

/**
 * Setup delete modal buttons
 */
function setupDeleteModal() {
    document.getElementById('close-delete-modal')?.addEventListener('click', closeDeleteModal);
    document.getElementById('cancel-delete')?.addEventListener('click', closeDeleteModal);

    document.getElementById('confirm-delete')?.addEventListener('click', async function () {
        if (!currentDeleteEventId) return;

        const btn = this;
        btn.disabled = true;
        btn.innerHTML = '<div class="mini-spinner"></div> Deleting...';

        try {
            await db.collection(COLLECTIONS.events).doc(currentDeleteEventId).delete();

            console.log("✅ Event deleted:", currentDeleteEventId);
            showToast("Event deleted successfully", "success");

            closeDeleteModal();
            loadEventsTable();
            loadAdminDashboard();

        } catch (error) {
            console.error("❌ Error deleting event:", error);
            showToast("Error deleting event", "error");
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-trash"></i> Delete Event';
        }
    });
}

function closeDeleteModal() {
    document.getElementById('delete-confirm-modal')?.classList.add('hidden');
    currentDeleteEventId = null;
}


// ============================================================
// SECTION 9: REGISTRATIONS TABLE
// Show all registrations across all events
// ============================================================

async function loadRegistrationsTable() {
    const tbody = document.getElementById('registrations-tbody');
    if (!tbody) return;

    try {
        const [regsSnap, eventsSnap] = await Promise.all([
            db.collection(COLLECTIONS.registrations).orderBy('timestamp', 'desc').get(),
            db.collection(COLLECTIONS.events).get()
        ]);

        // Build event title lookup
        const eventsMap = {};
        eventsSnap.forEach(doc => eventsMap[doc.id] = doc.data().title);

        if (regsSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:rgba(255,255,255,0.3)">No registrations yet</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        regsSnap.forEach(doc => {
            const reg = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><code style="color:#a78bfa; font-size:0.78rem">${reg.registrationId || 'N/A'}</code></td>
                <td style="font-size:0.82rem">${reg.userEmail || 'N/A'}</td>
                <td style="font-size:0.82rem">${truncateText(eventsMap[reg.eventId] || 'Deleted Event', 30)}</td>
                <td style="font-size:0.78rem; color:rgba(255,255,255,0.5)">
                    ${reg.timestamp ? formatDate(reg.timestamp.toDate()) : 'N/A'}
                </td>
                <td><span class="status-badge confirmed">✓ Confirmed</span></td>
                <td>
                    <button class="table-action-btn delete" onclick="deleteRegistration('${doc.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Populate event filter dropdown
        populateEventFilterDropdown(eventsMap);

    } catch (error) {
        console.error("❌ Error loading registrations:", error);
    }
}

/**
 * Delete a registration from Firestore
 */
async function deleteRegistration(regId) {
    if (!confirm("Delete this registration?")) return;

    try {
        await db.collection(COLLECTIONS.registrations).doc(regId).delete();
        showToast("Registration deleted", "success");
        loadRegistrationsTable();
        loadAdminDashboard();
    } catch (error) {
        showToast("Error deleting registration", "error");
    }
}

/**
 * Populate the filter by event dropdown
 */
function populateEventFilterDropdown(eventsMap) {
    const select = document.getElementById('filter-by-event');
    if (!select) return;

    const currentOptions = select.innerHTML;
    const newOptions = Object.entries(eventsMap)
        .map(([id, title]) => `<option value="${id}">${truncateText(title, 40)}</option>`)
        .join('');

    select.innerHTML = '<option value="all">All Events</option>' + newOptions;
}


// ============================================================
// SECTION 10: USERS TABLE
// Show all registered users
// ============================================================

async function loadUsersTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    try {
        const usersSnap = await db
            .collection(COLLECTIONS.users)
            .orderBy('createdAt', 'desc')
            .get();

        if (usersSnap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:rgba(255,255,255,0.3)">No users registered yet</td></tr>';
            return;
        }

        // Count registrations per user
        const regCounts = {};
        const regsSnap = await db.collection(COLLECTIONS.registrations).get();
        regsSnap.forEach(doc => {
            const uid = doc.data().userId;
            regCounts[uid] = (regCounts[uid] || 0) + 1;
        });

        tbody.innerHTML = '';
        usersSnap.forEach(doc => {
            const user = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <img src="${user.profileImage || 'assets/icons/default-avatar.png'}" 
                         class="table-user-avatar"
                         onerror="this.src='assets/icons/default-avatar.png'"
                         alt="${user.name}">
                </td>
                <td style="font-size:0.85rem; color:white; font-weight:500">${user.name || 'N/A'}</td>
                <td style="font-size:0.8rem; color:rgba(255,255,255,0.6)">${user.email || 'N/A'}</td>
                <td style="font-size:0.78rem; color:rgba(255,255,255,0.4)">
                    ${user.createdAt ? formatDate(user.createdAt.toDate()) : 'N/A'}
                </td>
                <td>
                    <span style="color:#a78bfa; font-weight:700">${regCounts[user.uid] || 0}</span>
                </td>
                <td><span class="status-badge active">Active</span></td>
            `;
            tbody.appendChild(row);
        });

    } catch (error) {
        console.error("❌ Error loading users:", error);
    }
}


// ============================================================
// SECTION 11: ADMIN TAB NAVIGATION
// Switch between admin panel tabs
// ============================================================

function setupAdminTabNavigation() {
    const navLinks = document.querySelectorAll('.admin-nav-link[data-admin-tab]');
    const tabs = document.querySelectorAll('.admin-tab');

    // Tab titles
    const tabTitles = {
        'dashboard': { title: 'Admin Dashboard', subtitle: 'Analytics and overview' },
        'add-event': { title: 'Add New Event', subtitle: 'Create and publish an event' },
        'manage-events': { title: 'Manage Events', subtitle: 'Edit or delete events' },
        'registrations': { title: 'Registrations', subtitle: 'View all event registrations' },
        'users': { title: 'Users', subtitle: 'All registered platform users' },
        'analytics': { title: 'Analytics', subtitle: 'Detailed statistics and insights' }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetTab = this.dataset.adminTab;

            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Show target tab, hide others
            tabs.forEach(tab => {
                if (tab.id === `admin-tab-${targetTab}`) {
                    tab.classList.remove('hidden');
                    tab.classList.add('active');
                } else {
                    tab.classList.add('hidden');
                    tab.classList.remove('active');
                }
            });

            // Update page title
            const info = tabTitles[targetTab] || tabTitles['dashboard'];
            document.getElementById('admin-page-title').textContent = info.title;
            document.getElementById('admin-page-subtitle').textContent = info.subtitle;

            // Close sidebar on mobile
            if (window.innerWidth < 820) {
                document.getElementById('admin-sidebar')?.classList.remove('sidebar-open');
            }
        });
    });

    // Mobile sidebar toggle
    const toggle = document.getElementById('admin-sidebar-toggle');
    const sidebar = document.getElementById('admin-sidebar');

    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-open');
        });
    }

    // Handle table header "view all" links
    document.querySelectorAll('[data-admin-tab-link]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.adminTabLink;
            const navLink = document.querySelector(`.admin-nav-link[data-admin-tab="${target}"]`);
            if (navLink) navLink.click();
        });
    });

    // Logout
    document.getElementById('admin-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });
}

// Global function so onclick in HTML can call it
window.switchAdminTab = function (tab) {
    const link = document.querySelector(`.admin-nav-link[data-admin-tab="${tab}"]`);
    if (link) link.click();
};


// ============================================================
// SECTION 12: ADMIN SEARCH
// Search events in manage events tab
// ============================================================

function setupAdminSearch() {
    const searchInput = document.getElementById('admin-event-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const query = this.value.trim().toLowerCase();

        if (!query) {
            renderEventsTable(adminAllEvents);
            return;
        }

        const filtered = adminAllEvents.filter(event =>
            (event.title || '').toLowerCase().includes(query) ||
            (event.venue || '').toLowerCase().includes(query) ||
            (event.category || '').toLowerCase().includes(query)
        );

        renderEventsTable(filtered);
    });
}


// ============================================================
// SECTION 13: EXPORT REGISTRATIONS CSV
// Download registrations as a CSV file
// ============================================================

function setupExportButton() {
    document.getElementById('export-registrations')?.addEventListener('click', async function () {
        try {
            const regsSnap = await db.collection(COLLECTIONS.registrations).get();
            const eventsSnap = await db.collection(COLLECTIONS.events).get();

            const eventsMap = {};
            eventsSnap.forEach(doc => eventsMap[doc.id] = doc.data().title);

            // Build CSV content
            let csv = 'Registration ID,User Email,Event Name,Date\n';

            regsSnap.forEach(doc => {
                const reg = doc.data();
                const date = reg.timestamp ? reg.timestamp.toDate().toLocaleDateString() : 'N/A';
                const eventTitle = (eventsMap[reg.eventId] || 'Unknown').replace(/,/g, ' ');
                csv += `${reg.registrationId},${reg.userEmail},${eventTitle},${date}\n`;
            });

            // Download file
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eventsphere_registrations_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);

            showToast("CSV exported successfully!", "success");

        } catch (error) {
            showToast("Export failed", "error");
        }
    });
}


// ============================================================
// SECTION 14: REAL-TIME CLOCK
// Shows current time in admin topbar
// ============================================================

function startAdminClock() {
    const clockEl = document.getElementById('admin-clock');
    if (!clockEl) return;

    function updateClock() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// Make admin functions globally accessible (called from onclick in HTML)
window.openEditModal = openEditModal;
window.openDeleteModal = openDeleteModal;
window.deleteRegistration = deleteRegistration;

console.log("📁 admin.js loaded");
