// ============================================================
// EVENTS PAGE JAVASCRIPT (events.js)
// Fetches all events from Firebase and displays them
//
// This file handles:
// 1. Fetch all events from Firestore database
// 2. Display events as cards in the grid
// 3. Search events by title/venue/organizer
// 4. Filter events by category
// 5. Filter events by date
// 6. Sort events (newest, oldest, A-Z)
// 7. Category count badges in sidebar
// 8. Load more functionality
// 9. Grid/List view toggle
//
// CORE CONCEPT:
// Admin adds event → Stored in Firestore "events" collection
// This file fetches those events → Creates HTML cards → Shows them
// ALL EVENTS COME FROM DATABASE - nothing is hardcoded!
// ============================================================


// ============================================================
// GLOBAL VARIABLES
// These store state across different functions
// ============================================================

// Stores all events fetched from Firebase
let allEvents = [];

// Stores currently filtered/visible events
let filteredEvents = [];

// How many events to show at once (pagination)
let eventsShownCount = 9;
const EVENTS_PER_LOAD = 6; // Load 6 more when "Load More" clicked

// Current filter/search state
let currentCategory = 'all';  // Category filter
let currentDateFilter = 'all'; // Date filter
let currentSort = 'newest';    // Sort order
let currentSearch = '';        // Search text


// ============================================================
// SECTION 1: MAIN INITIALIZATION
// Runs when the page loads
// ============================================================

/**
 * Initialize the events page
 * Called when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log("📅 Events page loading...");
    
    // Start fetching events from Firebase
    await fetchAllEvents();
    
    // Setup all interactive elements
    setupSearchBar();
    setupCategoryFilters();
    setupDateFilters();
    setupSortDropdown();
    setupViewToggle();
    setupLoadMore();
    setupScrollReveal();
});


// ============================================================
// SECTION 2: FETCH EVENTS FROM FIREBASE
// Gets all events from Firestore "events" collection
// ============================================================

/**
 * Fetch all events from Firestore database
 * This is the MAIN data loading function
 * 
 * Firestore Query:
 * - Collection: "events"
 * - Ordered by: "createdAt" descending (newest first)
 */
async function fetchAllEvents() {
    try {
        console.log("🔥 Fetching events from Firestore...");
        
        // Show skeleton loading cards while fetching
        showSkeletonCards();
        
        // Query Firestore "events" collection
        // .orderBy("createdAt", "desc") = newest events first
        const snapshot = await db
            .collection(COLLECTIONS.events)
            .orderBy("createdAt", "desc")
            .get();
        
        // Check if any events exist
        if (snapshot.empty) {
            console.log("📭 No events found in database");
            allEvents = [];
            filteredEvents = [];
            showNoEventsState();
            return;
        }
        
        // Convert Firestore documents to JavaScript objects
        allEvents = [];
        
        snapshot.forEach((doc) => {
            // doc.id = unique document ID (we use this for event-details page)
            // doc.data() = all the event fields we saved
            const eventData = {
                id: doc.id,         // Firebase document ID
                ...doc.data()       // Spread all event fields
            };
            allEvents.push(eventData);
        });
        
        console.log(`✅ Fetched ${allEvents.length} events from database`);
        
        // Start with all events visible
        filteredEvents = [...allEvents];
        
        // Update category counts in sidebar
        updateCategoryCounts();
        
        // Render the event cards
        renderEvents();
        
    } catch (error) {
        console.error("❌ Error fetching events:", error);
        showFetchError();
    }
}


// ============================================================
// SECTION 3: RENDER EVENTS (Create HTML Cards)
// Takes the events array and creates card elements
// ============================================================

/**
 * Render event cards to the grid
 * Clears existing cards and creates new ones
 * Only shows events up to eventsShownCount (for pagination)
 */
function renderEvents() {
    const grid = document.getElementById('events-grid');
    const countText = document.getElementById('events-count-text');
    const noEventsDiv = document.getElementById('no-events-found');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (!grid) return;
    
    // Clear existing content (skeleton cards or previous results)
    grid.innerHTML = '';
    
    // Update count text above grid
    if (countText) {
        if (filteredEvents.length === 0) {
            countText.innerHTML = '<span>0</span> events found';
        } else {
            countText.innerHTML = `Showing <span>${Math.min(eventsShownCount, filteredEvents.length)}</span> of <span>${filteredEvents.length}</span> events`;
        }
    }
    
    // Show "no events" message if no results
    if (filteredEvents.length === 0) {
        if (noEventsDiv) noEventsDiv.classList.remove('hidden');
        if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
        return;
    }
    
    // Hide "no events" message
    if (noEventsDiv) noEventsDiv.classList.add('hidden');
    
    // Get only the events we should show (up to eventsShownCount)
    const eventsToShow = filteredEvents.slice(0, eventsShownCount);
    
    // Create a card for each event
    eventsToShow.forEach((event, index) => {
        const card = createEventCard(event, index);
        grid.appendChild(card);
    });
    
    // Show/hide "Load More" button
    if (loadMoreContainer) {
        if (filteredEvents.length > eventsShownCount) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    }
    
    // Animate cards in with staggered delay
    animateCards();
}

/**
 * Create a single event card HTML element
 * This function builds the complete card structure
 * 
 * @param {Object} event - Event data object from Firestore
 * @param {number} index - Card index for animation delay
 * @returns {HTMLElement} The card element
 */
function createEventCard(event, index) {
    // Create the card container div
    const card = document.createElement('div');
    card.className = 'event-card';
    
    // Add animation delay based on position (staggered entrance)
    card.style.animationDelay = `${index * 0.08}s`;
    card.style.opacity = '0'; // Start invisible (animated in)
    
    // Format the date for display
    const formattedDate = formatDate(event.date);
    
    // Check if event is in the past
    const isPast = isPastDate(event.date);
    
    // Determine category badge color class
    const categoryClass = event.category ? event.category.toLowerCase() : '';
    
    // Create image HTML
    // If event has an image URL (from Firebase Storage), use it
    // Otherwise show placeholder with category emoji
    const categoryEmojis = {
        technology: '💻',
        music: '🎵',
        sports: '⚽',
        art: '🎨',
        business: '💼',
        education: '📚',
        food: '🍔',
        health: '💪',
        gaming: '🎮',
        other: '🎉'
    };
    
    const placeholderEmoji = categoryEmojis[categoryClass] || '🎉';
    
    // Build the image section HTML
    const imageHTML = event.imageURL 
        ? `<img src="${event.imageURL}" 
               alt="${event.title}" 
               loading="lazy"
               onerror="this.parentElement.classList.add('no-image'); this.innerHTML='${placeholderEmoji}'; this.remove();">`
        : `<div style="font-size:3rem; display:flex; align-items:center; justify-content:center; height:100%">${placeholderEmoji}</div>`;
    
    // Build the complete card HTML using template literals
    // Note: event.id is used in the URL so clicking goes to correct event
    card.innerHTML = `
        <!-- Event Image Area -->
        <div class="event-card-image ${!event.imageURL ? 'no-image' : ''}">
            ${imageHTML}
            <!-- Category badge on image -->
            <span class="event-category-badge ${categoryClass}">
                ${capitalizeWords(event.category) || 'Event'}
            </span>
            ${isPast ? '<span style="position:absolute; top:12px; right:12px; background:rgba(107,114,128,0.85); color:white; font-size:0.65rem; font-weight:700; padding:3px 9px; border-radius:20px;">PAST</span>' : ''}
        </div>
        
        <!-- Event Info Body -->
        <div class="event-card-body">
            <!-- Title -->
            <h3 class="event-card-title">${event.title || 'Untitled Event'}</h3>
            
            <!-- Short description (truncated) -->
            <p class="event-card-desc">
                ${truncateText(event.description, 100)}
            </p>
            
            <!-- Date and Venue -->
            <div class="event-card-meta">
                <div class="event-meta-item">
                    <i class="fas fa-calendar-alt"></i>
                    <span>${formattedDate}</span>
                </div>
                <div class="event-meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${truncateText(event.venue, 40) || 'Venue TBA'}</span>
                </div>
                ${event.organizer ? `
                <div class="event-meta-item">
                    <i class="fas fa-user-tie"></i>
                    <span>${event.organizer}</span>
                </div>
                ` : ''}
            </div>
            
            <!-- View Details button - links to event-details.html with event ID -->
            <!-- This is the key: ?id=${event.id} tells event-details.html which event to load -->
            <a href="event-details.html?id=${event.id}" class="event-card-btn">
                <i class="fas fa-arrow-right"></i>
                View Details & Register
            </a>
        </div>
    `;
    
    return card;
}

/**
 * Animate cards with fade-in effect
 * Creates staggered entrance animation
 */
function animateCards() {
    const cards = document.querySelectorAll('.event-card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 80);
    });
}


// ============================================================
// SECTION 4: SEARCH FUNCTIONALITY
// Filter events as user types in search box
// ============================================================

/**
 * Setup search bar event listeners
 */
function setupSearchBar() {
    const searchInput = document.getElementById('event-search');
    const searchClear = document.getElementById('search-clear');
    const resetBtn = document.getElementById('reset-search');
    
    if (!searchInput) return;
    
    // Listen for every keystroke in search box
    searchInput.addEventListener('input', function() {
        currentSearch = this.value.trim().toLowerCase();
        
        // Show/hide clear button
        if (searchClear) {
            searchClear.style.opacity = currentSearch ? '1' : '0';
        }
        
        // Reset pagination and apply filters
        eventsShownCount = 9;
        applyFiltersAndSearch();
    });
    
    // Clear button removes search text
    if (searchClear) {
        searchClear.addEventListener('click', function() {
            searchInput.value = '';
            currentSearch = '';
            this.style.opacity = '0';
            applyFiltersAndSearch();
        });
    }
    
    // Reset search button in "no results" state
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            resetAllFilters();
        });
    }
    
    // Quick category buttons in hero section
    const quickCategoryBtns = document.querySelectorAll('.category-quick');
    quickCategoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;
            
            // Find and click the matching radio button in sidebar
            const radioBtn = document.querySelector(`input[name="category"][value="${category}"]`);
            if (radioBtn) {
                radioBtn.checked = true;
                currentCategory = category;
                eventsShownCount = 9;
                applyFiltersAndSearch();
                
                // Scroll to events section smoothly
                const eventsSection = document.querySelector('.events-main-section');
                if (eventsSection) {
                    eventsSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}


// ============================================================
// SECTION 5: CATEGORY FILTER
// Filter events when user selects a category radio button
// ============================================================

/**
 * Setup category filter radio buttons
 */
function setupCategoryFilters() {
    // Get all radio buttons with name="category"
    const categoryRadios = document.querySelectorAll('input[name="category"]');
    
    categoryRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            // Update current category
            currentCategory = this.value;
            
            // Reset pagination
            eventsShownCount = 9;
            
            // Apply all filters including this new category
            applyFiltersAndSearch();
        });
    });
    
    // Clear filters button
    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', resetAllFilters);
    }
}


// ============================================================
// SECTION 6: DATE FILTER
// Filter events by today, this week, this month
// ============================================================

/**
 * Setup date filter radio buttons
 */
function setupDateFilters() {
    const dateRadios = document.querySelectorAll('input[name="date-filter"]');
    
    dateRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            currentDateFilter = this.value;
            eventsShownCount = 9;
            applyFiltersAndSearch();
        });
    });
}


// ============================================================
// SECTION 7: SORT FUNCTIONALITY
// Sort events by different criteria
// ============================================================

/**
 * Setup sort dropdown
 */
function setupSortDropdown() {
    const sortSelect = document.getElementById('sort-events');
    
    if (!sortSelect) return;
    
    sortSelect.addEventListener('change', function() {
        currentSort = this.value;
        applyFiltersAndSearch();
    });
}


// ============================================================
// SECTION 8: APPLY ALL FILTERS
// Main function that combines search + category + date + sort
// Called whenever any filter changes
// ============================================================

/**
 * Apply all active filters and search to the events array
 * This is the central filtering function
 * 
 * Flow:
 * allEvents → search filter → category filter → date filter → sort → render
 */
function applyFiltersAndSearch() {
    // Start with all events
    let results = [...allEvents];
    
    // ---- STEP 1: Apply search filter ----
    if (currentSearch) {
        results = results.filter(event => {
            // Check if search term appears in title, description, venue, or organizer
            const searchableText = [
                event.title || '',
                event.description || '',
                event.venue || '',
                event.organizer || '',
                event.category || ''
            ].join(' ').toLowerCase();
            
            return searchableText.includes(currentSearch);
        });
    }
    
    // ---- STEP 2: Apply category filter ----
    if (currentCategory && currentCategory !== 'all') {
        results = results.filter(event => {
            return event.category && 
                   event.category.toLowerCase() === currentCategory.toLowerCase();
        });
    }
    
    // ---- STEP 3: Apply date filter ----
    if (currentDateFilter && currentDateFilter !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        results = results.filter(event => {
            const eventDate = new Date(event.date);
            
            switch (currentDateFilter) {
                case 'today':
                    // Events happening today
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return eventDate >= today && eventDate < tomorrow;
                    
                case 'week':
                    // Events in the next 7 days
                    const nextWeek = new Date(today);
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    return eventDate >= today && eventDate <= nextWeek;
                    
                case 'month':
                    // Events in the next 30 days
                    const nextMonth = new Date(today);
                    nextMonth.setDate(nextMonth.getDate() + 30);
                    return eventDate >= today && eventDate <= nextMonth;
                    
                default:
                    return true;
            }
        });
    }
    
    // ---- STEP 4: Apply sort ----
    results = sortEvents(results, currentSort);
    
    // Update filtered events
    filteredEvents = results;
    
    // Re-render the grid with filtered results
    renderEvents();
    
    // Update category counts to show filtered numbers
    updateCategoryCounts();
}

/**
 * Sort events array based on selected sort option
 * 
 * @param {Array} events - Events array to sort
 * @param {string} sortType - Sort option selected
 * @returns {Array} Sorted events array
 */
function sortEvents(events, sortType) {
    // Create a copy so we don't modify original array
    const sorted = [...events];
    
    switch (sortType) {
        case 'newest':
            // Sort by createdAt timestamp - newest first
            return sorted.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return dateB - dateA; // Descending
            });
            
        case 'oldest':
            // Sort by createdAt - oldest first
            return sorted.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return dateA - dateB; // Ascending
            });
            
        case 'name-az':
            // Alphabetical A to Z by title
            return sorted.sort((a, b) => {
                return (a.title || '').localeCompare(b.title || '');
            });
            
        case 'name-za':
            // Alphabetical Z to A by title
            return sorted.sort((a, b) => {
                return (b.title || '').localeCompare(a.title || '');
            });
            
        case 'date-asc':
            // Events by date - earliest first
            return sorted.sort((a, b) => {
                return new Date(a.date) - new Date(b.date);
            });
            
        default:
            return sorted;
    }
}

/**
 * Reset all filters and search to default
 */
function resetAllFilters() {
    // Reset all state variables
    currentCategory = 'all';
    currentDateFilter = 'all';
    currentSort = 'newest';
    currentSearch = '';
    eventsShownCount = 9;
    
    // Reset UI elements
    const searchInput = document.getElementById('event-search');
    if (searchInput) searchInput.value = '';
    
    // Reset radio buttons to first option
    const allCategoryRadio = document.querySelector('input[name="category"][value="all"]');
    if (allCategoryRadio) allCategoryRadio.checked = true;
    
    const allDateRadio = document.querySelector('input[name="date-filter"][value="all"]');
    if (allDateRadio) allDateRadio.checked = true;
    
    const sortSelect = document.getElementById('sort-events');
    if (sortSelect) sortSelect.value = 'newest';
    
    // Reset filtered events to all events
    filteredEvents = [...allEvents];
    
    // Re-render
    renderEvents();
    updateCategoryCounts();
}


// ============================================================
// SECTION 9: CATEGORY COUNTS
// Updates the number badges next to each category filter
// Shows how many events are in each category
// ============================================================

/**
 * Update the count badges next to each category filter option
 * Shows total count for each category from allEvents
 */
function updateCategoryCounts() {
    // Count events in each category
    const counts = {
        all: allEvents.length,
        technology: 0,
        music: 0,
        sports: 0,
        art: 0,
        business: 0,
        education: 0,
        food: 0,
        health: 0,
        gaming: 0,
        other: 0
    };
    
    // Count each event by category
    allEvents.forEach(event => {
        const cat = event.category ? event.category.toLowerCase() : 'other';
        if (counts.hasOwnProperty(cat)) {
            counts[cat]++;
        } else {
            counts.other++;
        }
    });
    
    // Update each count badge in the DOM
    Object.keys(counts).forEach(category => {
        const countElement = document.getElementById(`count-${category}`);
        if (countElement) {
            countElement.textContent = counts[category];
        }
    });
}


// ============================================================
// SECTION 10: VIEW TOGGLE (Grid / List view)
// Let users switch between grid and list layout
// ============================================================

/**
 * Setup grid/list view toggle buttons
 */
function setupViewToggle() {
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    const eventsGrid = document.getElementById('events-grid');
    
    if (!gridBtn || !listBtn || !eventsGrid) return;
    
    // Grid view button
    gridBtn.addEventListener('click', function() {
        // Update button states
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        // Remove list view class
        eventsGrid.classList.remove('list-view');
    });
    
    // List view button
    listBtn.addEventListener('click', function() {
        // Update button states
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        // Add list view class (CSS handles the layout change)
        eventsGrid.classList.add('list-view');
    });
}


// ============================================================
// SECTION 11: LOAD MORE PAGINATION
// Shows more events when "Load More" is clicked
// ============================================================

/**
 * Setup "Load More" button
 */
function setupLoadMore() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    if (!loadMoreBtn) return;
    
    loadMoreBtn.addEventListener('click', function() {
        // Show loading state on button
        loadMoreBtn.innerHTML = '<div class="mini-spinner"></div> Loading...';
        loadMoreBtn.disabled = true;
        
        // Increase how many events to show
        eventsShownCount += EVENTS_PER_LOAD;
        
        // Re-render (will show more events now)
        setTimeout(() => {
            renderEvents();
            
            // Reset button
            loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More Events';
            loadMoreBtn.disabled = false;
        }, 500);
    });
}


// ============================================================
// SECTION 12: LOADING & ERROR STATES
// Functions that show different states of the events grid
// ============================================================

/**
 * Show skeleton loading cards while fetching
 * These are animated placeholder cards
 */
function showSkeletonCards() {
    const grid = document.getElementById('events-grid');
    if (!grid) return;
    
    // Create 6 skeleton cards
    grid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        grid.innerHTML += `
            <div class="skeleton-card">
                <div class="skeleton-img"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line long"></div>
                    <div class="skeleton-line medium"></div>
                    <div class="skeleton-line short"></div>
                    <div class="skeleton-line medium"></div>
                </div>
            </div>
        `;
    }
}

/**
 * Show "no events" empty state
 */
function showNoEventsState() {
    const grid = document.getElementById('events-grid');
    const countText = document.getElementById('events-count-text');
    
    if (!grid) return;
    
    // Clear skeleton cards
    grid.innerHTML = '';
    
    // Update count text
    if (countText) {
        countText.innerHTML = '<span>0</span> events found';
    }
    
    // Show the no events div
    const noEventsDiv = document.getElementById('no-events-found');
    if (noEventsDiv) {
        noEventsDiv.classList.remove('hidden');
    }
    
    // Show admin hint if needed (just in console)
    console.log("💡 Tip: Add events through the admin panel at admin.html");
}

/**
 * Show error state if Firebase fetch fails
 */
function showFetchError() {
    const grid = document.getElementById('events-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div style="
            grid-column: 1/-1; 
            text-align: center; 
            padding: 60px 20px;
            color: rgba(255,255,255,0.5)
        ">
            <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
            <h3 style="color: white; margin-bottom: 8px;">Failed to Load Events</h3>
            <p style="margin-bottom: 20px; font-size: 0.88rem;">
                There was an error connecting to the database. 
                Please check your internet connection and refresh.
            </p>
            <button onclick="location.reload()" class="btn-primary">
                <i class="fas fa-redo"></i>
                Try Again
            </button>
        </div>
    `;
}


// ============================================================
// SECTION 13: SCROLL REVEAL ANIMATIONS
// Animate elements as they enter the viewport
// ============================================================

/**
 * Setup scroll reveal for elements with [data-aos] attribute
 * Uses Intersection Observer API - modern, performance-friendly
 */
function setupScrollReveal() {
    // Intersection Observer watches when elements become visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Element is now visible - add animate class
                entry.target.classList.add('aos-animate');
                // Stop watching this element
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,    // Trigger when 10% of element is visible
        rootMargin: '0px'  // No margin offset
    });
    
    // Watch all elements with data-aos attribute
    document.querySelectorAll('[data-aos]').forEach(element => {
        observer.observe(element);
    });
}


// ============================================================
// SECTION 14: LANDING PAGE SPECIFIC FUNCTIONS
// These run on index.html (if main.js isn't separate)
// ============================================================

/**
 * Initialize counter animation for statistics section
 * Counts up from 0 to target number
 */
function initCounterAnimation() {
    // Find all elements with data-target attribute
    const counters = document.querySelectorAll('.stat-number[data-target]');
    
    if (counters.length === 0) return;
    
    // Watch for stats section to become visible
    const statsSection = document.querySelector('.stats-section');
    if (!statsSection) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Start counting each stat
                counters.forEach(counter => {
                    animateCounter(counter);
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.3 });
    
    observer.observe(statsSection);
}

/**
 * Animate a single counter from 0 to its target
 * 
 * @param {HTMLElement} element - The counter element
 */
function animateCounter(element) {
    const target = parseInt(element.dataset.target);
    const duration = 2000; // 2 seconds total
    const startTime = performance.now();
    
    // Easing function - starts fast, slows at end
    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }
    
    function updateCounter(currentTime) {
        // Calculate progress (0 to 1)
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        
        // Calculate current number
        const current = Math.floor(eased * target);
        
        // Update display
        element.textContent = current.toLocaleString(); // Adds commas: 10,000
        
        // Continue animation if not done
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            // Ensure we show exactly the target
            element.textContent = target.toLocaleString();
        }
    }
    
    requestAnimationFrame(updateCounter);
}

/**
 * Initialize floating particles in background
 * Creates random floating dots
 */
function initParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;
    
    // Create 20 particles
    for (let i = 0; i < 20; i++) {
        createParticle(container);
    }
}

/**
 * Create a single particle element
 * 
 * @param {HTMLElement} container - Container to add particle to
 */
function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random properties
    const size = Math.random() * 4 + 2;      // 2-6px
    const left = Math.random() * 100;         // 0-100% from left
    const delay = Math.random() * 8;          // 0-8s delay
    const duration = Math.random() * 10 + 8; // 8-18s duration
    const opacity = Math.random() * 0.4 + 0.1; // 0.1-0.5 opacity
    
    // Apply styles
    particle.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        bottom: -10px;
        opacity: 0;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        background: rgba(139, 92, 246, ${opacity});
    `;
    
    container.appendChild(particle);
}

// Initialize particles and counters when page loads
document.addEventListener('DOMContentLoaded', function() {
    initParticles();
    initCounterAnimation();
    setupScrollReveal();
});

// Log that events.js loaded
console.log("📁 events.js loaded - Ready to fetch events");