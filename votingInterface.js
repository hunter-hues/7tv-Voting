import { getEmotesFromSet, getEmoteImgUrl, createNeutralVote, createNeutralVotesInBackground, getVoteCounts } from "./api.js";
import { getCachedUser } from './userCache.js';
const contentArea = document.querySelector('#content-area');

// Store active timers for cleanup
const activeTimers = new Map();

// Format time remaining with adaptive colon format
function formatTimeRemaining(remainingMs) {
    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;
    
    // Adaptive display based on time remaining
    if (days > 0) {
        // More than 24 hours: D:HH:MM (no seconds)
        return `${days}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else if (hours > 0) {
        // 1-24 hours: HH:MM:SS
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (minutes > 0) {
        // Less than 1 hour: MM:SS
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
        // Less than 1 minute: SS
        return `${String(seconds).padStart(2, '0')}`;
    }
}

// Create countdown timer for an event button
function createCountdownTimer(timeInfoElement, endTimeISO) {
    const endTime = new Date(endTimeISO);
    
    function update() {
        const now = new Date();
        const remaining = endTime - now;
        
        if (remaining <= 0) {
            timeInfoElement.textContent = "Ended";
            timeInfoElement.classList.add('expired');
            // Remove urgency classes
            timeInfoElement.classList.remove('time-urgent', 'time-warning', 'time-normal');
            return null; // Signal to stop
        }
        
        // Update text
        timeInfoElement.textContent = formatTimeRemaining(remaining);
        
        // Update CSS classes based on time remaining for styling
        timeInfoElement.classList.remove('time-urgent', 'time-warning', 'time-normal');
        if (remaining < 3600000) { // Less than 1 hour
            timeInfoElement.classList.add('time-urgent');
        } else if (remaining < 86400000) { // Less than 24 hours
            timeInfoElement.classList.add('time-warning');
        } else {
            timeInfoElement.classList.add('time-normal');
        }
        
        // Update frequency: every second if < 1 hour, every minute otherwise
        if (remaining < 3600000) { // Less than 1 hour
            return 1000; // Update every second
        } else {
            return 60000; // Update every minute
        }
    }
    
    // Initial update
    const now = new Date();
    const remaining = endTime - now;
    if (remaining <= 0) {
        update(); // Set to "Ended"
        return null;
    }
    
    // Determine initial interval based on remaining time
    const startInterval = remaining < 3600000 ? 1000 : 60000;
    
    // Do initial update
    update();
    
    let interval = setInterval(() => {
        const nextInterval = update();
        if (nextInterval === null) {
            clearInterval(interval);
            activeTimers.delete(timeInfoElement);
        } else if (nextInterval !== startInterval) {
            // Interval needs to change - restart with new frequency
            clearInterval(interval);
            interval = setInterval(update, nextInterval);
        }
    }, startInterval);
    
    return interval;
}

// Cleanup function for timers
export function cleanupTimers() {
        activeTimers.forEach((timerId, element) => {
        clearInterval(timerId);
    });
    activeTimers.clear();
}
function calculateTotalVotes(voteCounts) {
    let totalKeep = 0, totalNeutral = 0, totalRemove = 0;
    for (const emoteId in voteCounts) {
        totalKeep += voteCounts[emoteId].keep || 0;
        totalNeutral += voteCounts[emoteId].neutral || 0;
        totalRemove += voteCounts[emoteId].remove || 0;
    }
    return { totalKeep, totalNeutral, totalRemove };
}

async function createVotingInterface(event, isExpired = false) {
    console.log("Selected voting event:", event);

    // Cleanup any existing timers before clearing content
    cleanupTimers();

    // OPTIMIZATION #1: Parallelize initial API calls
    const parallelStartTime = performance.now();
    console.log('[PARALLEL API] Starting parallel API calls...');
    
    // Start all three API calls in parallel
    const [authResponse, emotesData, voteData] = await Promise.all([
        getCachedUser(),
        getEmotesFromSet(event.emote_set_id),
        getVoteCounts(event.id)
    ]);
    
    const parallelEndTime = performance.now();
    const parallelTime = parallelEndTime - parallelStartTime;
    console.log(`[PARALLEL API] All API calls completed in ${parallelTime.toFixed(2)}ms (parallel)`);
    
    // Process results
    const authData = authResponse;
    let currentUsername = null;
    if (authData.authenticated) {
        currentUsername = authData.user.login;
    }
    // Check if user can edit this event
    const canEdit = event.can_edit || false;

    const emotes = emotesData.emotes;
    
    if (!voteData.success) {
        console.error('Failed to get vote data:', voteData.error);
        return;
    }
    const voteCounts = voteData.vote_counts || {};
    const userVotes = voteData.vote_choices || {};

    contentArea.innerHTML = '';

    // Create event info header
    const infoHeader = document.createElement('div');
    infoHeader.className = 'event-info-header';

    // Event title and creator
    const titleSection = document.createElement('h2');
    titleSection.className = 'event-title';
    titleSection.textContent = `"${event.title}"`;

    const creatorInfo = document.createElement('p');
    creatorInfo.className = 'event-creator-info';
    creatorInfo.textContent = `Created by ${event.owner_username || event.creator_username} for emote set: ${event.emote_set_name}`;

    // Time info
    const timeInfo = document.createElement('p');
    timeInfo.className = `event-time-info ${isExpired ? 'expired' : 'active'}`;
    timeInfo.textContent = event.time_remaining || event.time_ended || 'Time info unavailable';

    // Calculate total votes across all emotes
    let totalKeep = 0, totalNeutral = 0, totalRemove = 0;
    for (const emoteId in voteCounts) {
        totalKeep += voteCounts[emoteId].keep || 0;
        totalNeutral += voteCounts[emoteId].neutral || 0;
        totalRemove += voteCounts[emoteId].remove || 0;
    }

    // Vote statistics
    const voteStats = document.createElement('div');
    voteStats.id = 'vote-statistics';
    voteStats.className = 'vote-statistics';
    voteStats.innerHTML = `
        <strong>Vote Statistics:</strong><br>
        Total Voters: ${event.total_votes || 0}<br>
        Keep: ${totalKeep} | Neutral: ${totalNeutral} | Remove: ${totalRemove}
    `;

    // Append all to header
    infoHeader.appendChild(titleSection);
    infoHeader.appendChild(creatorInfo);
    infoHeader.appendChild(timeInfo);
    infoHeader.appendChild(voteStats);

    // Add header to page
    contentArea.appendChild(infoHeader);

    // Pagination state
    let currentPage = 1;
    const emotesPerPage = 20;
    let filteredEmotes = [...emotes];
    let sortedEmotes = [...emotes];
    let searchTerm = '';
    let sortBy = 'default';

    // Helper function to filter emotes
    function filterEmotes(emotes, searchTerm) {
        if (!searchTerm) return emotes;
        const term = searchTerm.toLowerCase();
        return emotes.filter(emote => emote.name.toLowerCase().includes(term));
    }

    // Helper function to sort emotes
    function sortEmotes(emotes, sortBy, voteCounts) {
        const sorted = [...emotes];
        
        switch(sortBy) {
            case 'name-asc':
                return sorted.sort((a, b) => a.name.localeCompare(b.name));
            case 'name-desc':
                return sorted.sort((a, b) => b.name.localeCompare(a.name));
            case 'total-votes-desc':
                return sorted.sort((a, b) => {
                    const votesA = (voteCounts[a.id]?.keep || 0) + (voteCounts[a.id]?.remove || 0);
                    const votesB = (voteCounts[b.id]?.keep || 0) + (voteCounts[b.id]?.remove || 0);
                    return votesB - votesA;
                });
            case 'total-votes-asc':
                return sorted.sort((a, b) => {
                    const votesA = (voteCounts[a.id]?.keep || 0) + (voteCounts[a.id]?.remove || 0);
                    const votesB = (voteCounts[b.id]?.keep || 0) + (voteCounts[b.id]?.remove || 0);
                    return votesA - votesB;
                });
            case 'positive-votes-desc':
                return sorted.sort((a, b) => {
                    const votesA = voteCounts[a.id]?.keep || 0;
                    const votesB = voteCounts[b.id]?.keep || 0;
                    return votesB - votesA;
                });
            case 'positive-votes-asc':
                return sorted.sort((a, b) => {
                    const votesA = voteCounts[a.id]?.keep || 0;
                    const votesB = voteCounts[b.id]?.keep || 0;
                    return votesA - votesB;
                });
            case 'negative-votes-desc':
                return sorted.sort((a, b) => {
                    const votesA = voteCounts[a.id]?.remove || 0;
                    const votesB = voteCounts[b.id]?.remove || 0;
                    return votesB - votesA;
                });
            case 'negative-votes-asc':
                return sorted.sort((a, b) => {
                    const votesA = voteCounts[a.id]?.remove || 0;
                    const votesB = voteCounts[b.id]?.remove || 0;
                    return votesA - votesB;
                });
            case 'ratio-desc':
                return sorted.sort((a, b) => {
                    const keepA = voteCounts[a.id]?.keep || 0;
                    const removeA = voteCounts[a.id]?.remove || 0;
                    const keepB = voteCounts[b.id]?.keep || 0;
                    const removeB = voteCounts[b.id]?.remove || 0;
                    
                    // Calculate ratio: keep/remove
                    let ratioA, ratioB;
                    
                    if (removeA === 0) {
                        // No remove votes: Infinity if has keep votes, 0 if no votes at all
                        ratioA = keepA > 0 ? Infinity : 0;
                    } else if (keepA === 0) {
                        // Only remove votes: use negative value to represent "worse" ratio
                        // More remove votes = more negative = lower ratio
                        ratioA = -removeA;
                    } else {
                        // Normal case: keep/remove
                        ratioA = keepA / removeA;
                    }
                    
                    if (removeB === 0) {
                        ratioB = keepB > 0 ? Infinity : 0;
                    } else if (keepB === 0) {
                        ratioB = -removeB;
                    } else {
                        ratioB = keepB / removeB;
                    }
                    
                    // Sort: Infinity > positive ratios > 0 > negative ratios (more negative = lower)
                    if (ratioA === Infinity && ratioB === Infinity) return 0;
                    if (ratioA === Infinity) return -1;  // A is higher
                    if (ratioB === Infinity) return 1;   // B is higher
                    return ratioB - ratioA;
                });
            case 'ratio-asc':
                return sorted.sort((a, b) => {
                    const keepA = voteCounts[a.id]?.keep || 0;
                    const removeA = voteCounts[a.id]?.remove || 0;
                    const keepB = voteCounts[b.id]?.keep || 0;
                    const removeB = voteCounts[b.id]?.remove || 0;
                    
                    // Calculate ratio: keep/remove
                    let ratioA, ratioB;
                    
                    if (removeA === 0) {
                        // No remove votes: Infinity if has keep votes, 0 if no votes at all
                        ratioA = keepA > 0 ? Infinity : 0;
                    } else if (keepA === 0) {
                        // Only remove votes: use negative value to represent "worse" ratio
                        // More remove votes = more negative = lower ratio
                        ratioA = -removeA;
                    } else {
                        // Normal case: keep/remove
                        ratioA = keepA / removeA;
                    }
                    
                    if (removeB === 0) {
                        ratioB = keepB > 0 ? Infinity : 0;
                    } else if (keepB === 0) {
                        ratioB = -removeB;
                    } else {
                        ratioB = keepB / removeB;
                    }
                    
                    // Sort: negative ratios (more negative = lower) < 0 < positive ratios < Infinity
                    if (ratioA === Infinity && ratioB === Infinity) return 0;
                    if (ratioA === Infinity) return 1;  // A is higher
                    if (ratioB === Infinity) return -1; // B is higher
                    return ratioA - ratioB;
                });
            default:
                return sorted; // Default order (as received from API)
        }
    }

    // Function to create emote div with vote buttons
    function createEmoteDiv(emote, voteCounts, userVotes, isExpired, event) {
        const emoteDiv = document.createElement('div');
        emoteDiv.id = emote.id;
        emoteDiv.classList.add('emote-div');
        const emoteUrl = getEmoteImgUrl(emote.id, '2');
        const emoteImg = document.createElement('img');
        emoteImg.src = emoteUrl;
        const emoteName = document.createElement('h3');
        emoteName.textContent = emote.name;
        const userVote = userVotes ? userVotes[emote.id] : null;
        
        const keepButton = document.createElement('button');
        keepButton.className = 'vote-button vote-keep';
        keepButton.textContent = `yes (${voteCounts[emote.id]?.keep || 0})`;
        if (userVote === 'keep') {
            keepButton.classList.add('active');
        } else {
            keepButton.classList.add('inactive');
        }
        if (isExpired) {
            keepButton.disabled = true;
        }

        const neutralButton = document.createElement('button');
        neutralButton.className = 'vote-button vote-neutral';
        neutralButton.textContent = `idc (${voteCounts[emote.id]?.neutral || 0})`;
        if (userVote === 'neutral') {
            neutralButton.classList.add('active');
        } else {
            neutralButton.classList.add('inactive');
        }
        if (isExpired) {
            neutralButton.disabled = true;
        }

        const removeButton = document.createElement('button');
        removeButton.className = 'vote-button vote-remove';
        removeButton.textContent = `no (${voteCounts[emote.id]?.remove || 0})`;
        if (userVote === 'remove') {
            removeButton.classList.add('active');
        } else {
            removeButton.classList.add('inactive');
        }
        if (isExpired) {
            removeButton.disabled = true;
        }

        // Vote button event listeners
        keepButton.addEventListener('click', async function () {
            const response = await fetch('/votes/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voting_event_id: event.id,  
                    emote_id: emote.id,
                    vote_choice: 'keep'  
                })
            });
            const result = await response.json();
            if (result.success) {
                keepButton.classList.remove('inactive');
                keepButton.classList.add('active');
                neutralButton.classList.remove('active');
                neutralButton.classList.add('inactive');
                removeButton.classList.remove('active');
                removeButton.classList.add('inactive');

                const updatedVoteData = await getVoteCounts(event.id);
                keepButton.textContent = `yes (${updatedVoteData.vote_counts[emote.id]?.keep || 0})`;
                neutralButton.textContent = `idc (${updatedVoteData.vote_counts[emote.id]?.neutral || 0})`;
                removeButton.textContent = `no (${updatedVoteData.vote_counts[emote.id]?.remove || 0})`;
                const { totalKeep, totalNeutral, totalRemove } = calculateTotalVotes(updatedVoteData.vote_counts);
                const voteStatsDiv = document.getElementById('vote-statistics');
                if (voteStatsDiv) {
                    voteStatsDiv.innerHTML = `
                        <strong>Vote Statistics:</strong><br>
                        Total Voters: ${event.total_votes || 0}<br>
                        Keep: ${totalKeep} | Neutral: ${totalNeutral} | Remove: ${totalRemove}
                    `;
                }
            } else {
                if (result.message === "This voting event has expired") {
                    alert('This voting event has expired. Refreshing...');
                    await createVotingInterface(event, true);
                } else {
                    console.error('Vote failed:', result.message);
                    alert('Failed to submit vote: ' + result.message);
                }
            }
        });

        removeButton.addEventListener('click', async function () {
            const response = await fetch('/votes/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voting_event_id: event.id,  
                    emote_id: emote.id,
                    vote_choice: 'remove'  
                })
            });
            const result = await response.json();
            if (result.success) {
                keepButton.classList.remove('active');
                keepButton.classList.add('inactive');
                neutralButton.classList.remove('active');
                neutralButton.classList.add('inactive');
                removeButton.classList.remove('inactive');
                removeButton.classList.add('active');

                const updatedVoteData = await getVoteCounts(event.id);
                // Update voteCounts object for sorting
                voteCounts[emote.id] = updatedVoteData.vote_counts[emote.id];
                keepButton.textContent = `yes (${updatedVoteData.vote_counts[emote.id]?.keep || 0})`;
                neutralButton.textContent = `idc (${updatedVoteData.vote_counts[emote.id]?.neutral || 0})`;
                removeButton.textContent = `no (${updatedVoteData.vote_counts[emote.id]?.remove || 0})`;
                const { totalKeep, totalNeutral, totalRemove } = calculateTotalVotes(updatedVoteData.vote_counts);
                const voteStatsDiv = document.getElementById('vote-statistics');
                if (voteStatsDiv) {
                    voteStatsDiv.innerHTML = `
                        <strong>Vote Statistics:</strong><br>
                        Total Voters: ${event.total_votes || 0}<br>
                        Keep: ${totalKeep} | Neutral: ${totalNeutral} | Remove: ${totalRemove}
                    `;
                }
            } else {
                if (result.message === "This voting event has expired") {
                    alert('This voting event has expired. Refreshing...');
                    await createVotingInterface(event, true);
                } else {
                    console.error('Vote failed:', result.message);
                    alert('Failed to submit vote: ' + result.message);
                }
            }
        });

        neutralButton.addEventListener('click', async function () {
            const response = await fetch('/votes/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voting_event_id: event.id,  
                    emote_id: emote.id,
                    vote_choice: 'neutral'  
                })
            });
            const result = await response.json();
            if (result.success) {
                keepButton.classList.remove('active');
                keepButton.classList.add('inactive');
                neutralButton.classList.remove('inactive');
                neutralButton.classList.add('active');
                removeButton.classList.remove('active');
                removeButton.classList.add('inactive');

                const updatedVoteData = await getVoteCounts(event.id);
                // Update voteCounts object for sorting
                voteCounts[emote.id] = updatedVoteData.vote_counts[emote.id];
                keepButton.textContent = `yes (${updatedVoteData.vote_counts[emote.id]?.keep || 0})`;
                neutralButton.textContent = `idc (${updatedVoteData.vote_counts[emote.id]?.neutral || 0})`;
                removeButton.textContent = `no (${updatedVoteData.vote_counts[emote.id]?.remove || 0})`;
                const { totalKeep, totalNeutral, totalRemove } = calculateTotalVotes(updatedVoteData.vote_counts);
                const voteStatsDiv = document.getElementById('vote-statistics');
                if (voteStatsDiv) {
                    voteStatsDiv.innerHTML = `
                        <strong>Vote Statistics:</strong><br>
                        Total Voters: ${event.total_votes || 0}<br>
                        Keep: ${totalKeep} | Neutral: ${totalNeutral} | Remove: ${totalRemove}
                    `;
                }
            } else {
                if (result.message === "This voting event has expired") {
                    alert('This voting event has expired. Refreshing...');
                    await createVotingInterface(event, true);
                } else {
                    console.error('Vote failed:', result.message);
                    alert('Failed to submit vote: ' + result.message);
                }
            }
        });

        emoteDiv.appendChild(emoteName);
        emoteDiv.appendChild(emoteImg);
        emoteDiv.appendChild(keepButton);
        emoteDiv.appendChild(neutralButton);
        emoteDiv.appendChild(removeButton);
        
        return emoteDiv;
    }

    // Function to render emotes for current page
    function renderEmotePage() {
        // Filter and sort
        filteredEmotes = filterEmotes(emotes, searchTerm);
        sortedEmotes = sortEmotes(filteredEmotes, sortBy, voteCounts);
        
        // Calculate pagination
        const totalPages = Math.ceil(sortedEmotes.length / emotesPerPage);
        const startIndex = (currentPage - 1) * emotesPerPage;
        const endIndex = startIndex + emotesPerPage;
        const pageEmotes = sortedEmotes.slice(startIndex, endIndex);
        
        // Clear existing emotes from grid
        const existingEmotes = emoteGrid.querySelectorAll('.emote-div');
        existingEmotes.forEach(el => el.remove());
        
        // Render emotes for current page
        pageEmotes.forEach(emote => {
            const emoteDiv = createEmoteDiv(emote, voteCounts, userVotes, isExpired, event);
            emoteGrid.appendChild(emoteDiv);
        });
        
        // Update page info
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1} (${sortedEmotes.length} emotes)`;
        
        // Update button states
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage >= totalPages || totalPages === 0;
    }

    const emoteGrid = document.createElement('div');
    emoteGrid.className = 'emote-voting-grid';
    
    // Create pagination controls container
    const paginationControls = document.createElement('div');
    paginationControls.className = 'emote-pagination-controls';
    
    // Search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search emotes by name...';
    searchInput.className = 'emote-search-input';
    
    // Sort select
    const sortSelect = document.createElement('select');
    sortSelect.className = 'emote-sort-select';
    sortSelect.innerHTML = `
        <option value="default">Default Order</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="total-votes-desc">Total Votes (High to Low)</option>
        <option value="total-votes-asc">Total Votes (Low to High)</option>
        <option value="positive-votes-desc">Positive Votes (High to Low)</option>
        <option value="positive-votes-asc">Positive Votes (Low to High)</option>
        <option value="negative-votes-desc">Negative Votes (High to Low)</option>
        <option value="negative-votes-asc">Negative Votes (Low to High)</option>
        <option value="ratio-desc">Keep/Remove Ratio (High to Low)</option>
        <option value="ratio-asc">Keep/Remove Ratio (Low to High)</option>
    `;
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'emote-page-info';
    
    // Navigation buttons
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.className = 'emote-page-button';
    
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = 'emote-page-button';
    
    // Assemble controls
    const controlsLeft = document.createElement('div');
    controlsLeft.className = 'controls-left';
    controlsLeft.appendChild(searchInput);
    controlsLeft.appendChild(sortSelect);
    
    const controlsRight = document.createElement('div');
    controlsRight.className = 'controls-right';
    controlsRight.appendChild(prevButton);
    controlsRight.appendChild(pageInfo);
    controlsRight.appendChild(nextButton);
    
    paginationControls.appendChild(controlsLeft);
    paginationControls.appendChild(controlsRight);
    
    // Debounce helper function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Event listeners
    let searchDebounceCount = 0;
    let searchExecuteCount = 0;
    
    // Debounced search function for emotes
    const debouncedEmoteSearch = debounce(function() {
        searchExecuteCount++;
        console.log(`[DEBOUNCE] Search executed (count: ${searchExecuteCount}). Current value: "${searchInput.value}"`);
        searchTerm = searchInput.value;
        currentPage = 1; // Reset to first page on search
        renderEmotePage();
    }, 300);
    
    searchInput.addEventListener('input', function() {
        searchDebounceCount++;
        if (searchDebounceCount % 5 === 0) {
            console.log(`[DEBOUNCE] Input event fired (total: ${searchDebounceCount}, executed: ${searchExecuteCount})`);
        }
        debouncedEmoteSearch();
    });
    
    sortSelect.addEventListener('change', function() {
        sortBy = this.value;
        currentPage = 1; // Reset to first page on sort change
        renderEmotePage();
    });
    
    prevButton.addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderEmotePage();
        }
    });
    
    nextButton.addEventListener('click', function() {
        const totalPages = Math.ceil(sortedEmotes.length / emotesPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderEmotePage();
        }
    });
    
    // Add expired message if needed
    if (isExpired) {
        const expiredMessage = document.createElement('div');
        expiredMessage.className = 'expired-message';
        expiredMessage.textContent = ' This voting event has expired - Results are view-only';
        emoteGrid.appendChild(expiredMessage);
    }
    
    // Only create neutral votes for active events
    // Optimize: Only create votes for emotes the user hasn't voted on yet
    if (!isExpired) {
        createNeutralVotesInBackground(event.id, emotes, userVotes);

        if (canEdit) {
            const editButton = document.createElement('button');
            editButton.id = 'edit-button';
            editButton.className = 'edit-event-button';
            editButton.textContent = 'Edit Event';
        
            editButton.addEventListener('click', async function () {
                openEditPopup(event);
            });
            
            emoteGrid.appendChild(editButton);
        }
    }
    
    // Initial render
    renderEmotePage();
    
    // Create emote layout wrapper
    const emoteLayout = document.createElement('div');
    emoteLayout.className = 'emote-layout';
    
    // Append pagination controls and grid to layout wrapper
    emoteLayout.appendChild(paginationControls);
    emoteLayout.appendChild(emoteGrid);
    
    // Append layout wrapper to content area
    contentArea.appendChild(emoteLayout);
}

async function openEditPopup(event) {
    // Create the backdrop (darkens the background)
    const backdrop = document.createElement('div');
    backdrop.className = 'popup-backdrop';

    // Create the popup container (centered box)
    const popup = document.createElement('div');
    popup.className = 'popup-container';

    // Close popup function
    const closePopup = () => {
        backdrop.remove();
        popup.remove();
    };

    // Close when clicking backdrop
    backdrop.addEventListener('click', closePopup);

    // Create form
    const editForm = document.createElement('form');
    
    // Header with close button
    const header = document.createElement('div');
    header.className = 'popup-header';
    
    const headerTitle = document.createElement('h2');
    headerTitle.className = 'popup-header-title';
    headerTitle.textContent = 'Edit Voting Event';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'popup-close-button';
    closeBtn.textContent = 'x';
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', closePopup);
    
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // Title Section
    const titleSection = document.createElement('div');
    titleSection.className = 'popup-form-section';
    
    const titleLabel = document.createElement('label');
    titleLabel.className = 'form-label';
    titleLabel.textContent = 'Event Title';
    
    const titleInput = document.createElement('input');
    titleInput.className = 'form-input';
    titleInput.type = 'text';
    titleInput.value = event.title;  // Pre-fill with current title

    const titleError = document.createElement('div');
    titleError.className = 'error-message hidden';

    titleSection.appendChild(titleLabel);
    titleSection.appendChild(titleInput);
    titleSection.appendChild(titleError);

    // Time Section
    let activeTimeTab = 'duration';  // Default to duration tab
    
    const timeSection = document.createElement('div');
    timeSection.className = 'popup-form-section';
    
    const timeLabel = document.createElement('label');
    timeLabel.className = 'form-label';
    timeLabel.textContent = 'Event Duration';
    
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';
    
    const durationTab = document.createElement('button');
    durationTab.className = 'tab-button active';
    durationTab.textContent = 'Duration';
    durationTab.type = 'button';
    
    const endTimeTab = document.createElement('button');
    endTimeTab.className = 'tab-button inactive';
    endTimeTab.textContent = 'End Time';
    endTimeTab.type = 'button';

    tabContainer.appendChild(durationTab);
    tabContainer.appendChild(endTimeTab);

    // Duration Content
    const durationContent = document.createElement('div');
    durationContent.className = 'time-tabs';

    const durationError = document.createElement('div');
    durationError.className = 'error-message hidden';
    
    // Days Input
    const daysLabel = document.createElement('label');
    daysLabel.className = 'duration-label';
    daysLabel.textContent = 'Days: ';
    const durationDays = document.createElement('input');
    durationDays.className = 'duration-input';
    durationDays.type = 'number';
    durationDays.value = '0';
    durationDays.min = '0';
    durationDays.max = '31';
    
    // Hours Input
    const hoursLabel = document.createElement('label');
    hoursLabel.className = 'duration-label';
    hoursLabel.textContent = 'Hours: ';
    const durationHours = document.createElement('input');
    durationHours.className = 'duration-input';
    durationHours.type = 'number';
    durationHours.value = '0';
    durationHours.min = '0';
    durationHours.max = '23';
    
    // Minutes Input
    const minutesLabel = document.createElement('label');
    minutesLabel.className = 'duration-label';
    minutesLabel.textContent = 'Minutes: ';
    const durationMinutes = document.createElement('input');
    durationMinutes.className = 'duration-input';
    durationMinutes.type = 'number';
    durationMinutes.value = '0';
    durationMinutes.min = '0';
    durationMinutes.max = '59';

    durationContent.appendChild(daysLabel);
    durationContent.appendChild(durationDays);
    durationContent.appendChild(hoursLabel);
    durationContent.appendChild(durationHours);
    durationContent.appendChild(minutesLabel);
    durationContent.appendChild(durationMinutes);
    durationContent.appendChild(durationError);

    // End Time Content
    const endTimeContent = document.createElement('div');
    endTimeContent.className = 'time-tabs hidden';
    
    const endTimeInput = document.createElement('input');
    endTimeInput.className = 'form-input';
    endTimeInput.type = 'datetime-local';
    endTimeInput.min = new Date().toISOString().slice(0, 16);

    const endTimeError = document.createElement('div');
    endTimeError.className = 'error-message hidden';
    
    endTimeContent.appendChild(endTimeInput);
    endTimeContent.appendChild(endTimeError);

    timeSection.appendChild(timeLabel);
    timeSection.appendChild(tabContainer);
    timeSection.appendChild(durationContent);
    timeSection.appendChild(endTimeContent);

    // Tab switching logic
    durationTab.addEventListener('click', function() {
        durationContent.classList.remove('hidden');
        endTimeContent.classList.add('hidden');
        durationTab.classList.add('active');
        durationTab.classList.remove('inactive');
        endTimeTab.classList.add('inactive');
        endTimeTab.classList.remove('active');
        activeTimeTab = 'duration';
        validateDuration();
    });
    
    endTimeTab.addEventListener('click', function() {
        durationContent.classList.add('hidden');
        endTimeContent.classList.remove('hidden');
        durationTab.classList.add('inactive');
        durationTab.classList.remove('active');
        endTimeTab.classList.add('active');
        endTimeTab.classList.remove('inactive');
        activeTimeTab = 'endTime';
        validateEndTime();
    });

    // Specific Users Section (only show if permission_level is "specific" or "specific_users")
    let specificUsersSection = null;
    let currentUsers = [];  // Declare outside so it's accessible in save handler
    
    if (event.permission_level === 'specific' || event.permission_level === 'specific_users') {
        specificUsersSection = document.createElement('div');
        specificUsersSection.className = 'form-section specific-users-section';
        
        const specificUsersLabel = document.createElement('label');
        specificUsersLabel.className = 'specific-users-label';
        specificUsersLabel.textContent = 'Allowed Users';
        
        // Username input
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.placeholder = 'Enter Twitch username';
        usernameInput.className = 'specific-users-input';
        
        // Add user button
        const addUserButton = document.createElement('button');
        addUserButton.type = 'button';
        addUserButton.textContent = 'Add User';
        addUserButton.className = 'add-user-button';
        
        // Users list display
        const usersList = document.createElement('div');
        usersList.id = 'edit-users-list';
        usersList.className = 'edit-users-list';
        
        // Current users list (from event)
        currentUsers = [...(event.specific_users || [])];
        
        // Function to update users list display
        function updateUsersListDisplay() {
            usersList.innerHTML = '';
            currentUsers.forEach((username, index) => {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-item';
                
                const usernameSpan = document.createElement('span');
                usernameSpan.textContent = username;
                
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.textContent = 'Remove';
                removeButton.className = 'remove-user-button';
                removeButton.onclick = () => {
                    currentUsers.splice(index, 1);
                    updateUsersListDisplay();
                };
                
                userDiv.appendChild(usernameSpan);
                userDiv.appendChild(removeButton);
                usersList.appendChild(userDiv);
            });
        }
        
        // Add user functionality
        addUserButton.addEventListener('click', function() {
            const username = usernameInput.value.trim();
            if (username && !currentUsers.includes(username)) {
                currentUsers.push(username);
                updateUsersListDisplay();
                usernameInput.value = '';
            }
        });
        
        // Allow Enter key to add user
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addUserButton.click();
            }
        });
        
        // Initial display
        updateUsersListDisplay();
        
        specificUsersSection.appendChild(specificUsersLabel);
        specificUsersSection.appendChild(usernameInput);
        specificUsersSection.appendChild(addUserButton);
        specificUsersSection.appendChild(usersList);
    }

    // Buttons Section
    const buttonSection = document.createElement('div');
    buttonSection.className = 'popup-button-section';
    
    const saveButton = document.createElement('button');
    saveButton.className = 'popup-button save-button';
    saveButton.textContent = 'Save Changes';
    saveButton.type = 'button';
    saveButton.disabled = true;
    
    const endNowButton = document.createElement('button');
    endNowButton.className = 'popup-button end-now-button';
    endNowButton.textContent = 'End Now';
    endNowButton.type = 'button';

    buttonSection.appendChild(saveButton);
    buttonSection.appendChild(endNowButton);

    // Validation functions
    function validateTitle() {
        if (titleInput.value.trim() === '') {
            titleError.classList.remove('hidden');
            titleError.textContent = 'Event title cannot be empty';
            return false;
        }
        titleError.classList.add('hidden');
        return true;
    }

    function validateDuration() {
        if (activeTimeTab !== 'duration') return true;
    
        const totalMinutes = (parseInt(durationDays.value) * 24 * 60) + 
                            (parseInt(durationHours.value) * 60) + 
                            parseInt(durationMinutes.value);
        
        // If duration is 0, that's OK - user might just be changing title
        if (totalMinutes === 0) {
            durationError.classList.add('hidden');
            return true;  // Allow 0 duration (won't be sent to backend)
        }
        
        // Must be at least 5 minutes from now
        if (totalMinutes < 5) {
            durationError.classList.remove('hidden');
            durationError.textContent = 'Duration must be at least 5 minutes from now';
            return false;
        }
        
        // Calculate time from original creation
        const createdAt = new Date(event.created_at);
        const proposedEndTime = new Date(Date.now() + totalMinutes * 60 * 1000);
        const maxEndTime = new Date(createdAt.getTime() + 31 * 24 * 60 * 60 * 1000); // 31 days from creation
        
        if (proposedEndTime > maxEndTime) {
            durationError.classList.remove('hidden');
            durationError.textContent = 'End time cannot be more than 31 days from original creation';
            return false;
        }
        
        durationError.classList.add('hidden');
        return true;
    }

    function validateEndTime() {
        if (activeTimeTab !== 'endTime') return true;
    
        // If no value entered, that's OK - user might just be changing title
        if (!endTimeInput.value) {
            endTimeError.classList.add('hidden');
            return true;
        }
    
        const selectedDate = new Date(endTimeInput.value);
        const now = new Date();
        const diffMinutes = (selectedDate - now) / (1000 * 60);
    
        if (isNaN(selectedDate.getTime())) {
            endTimeError.classList.remove('hidden');
            endTimeError.textContent = 'Please select a valid date and time';
            return false;
        }
        
        // Must be at least 5 minutes from now
        if (diffMinutes < 5) {
            endTimeError.classList.remove('hidden');
            endTimeError.textContent = 'End time must be at least 5 minutes from now';
            return false;
        }
        
        // Cannot be more than 31 days from original creation
        const createdAt = new Date(event.created_at);
        const maxEndTime = new Date(createdAt.getTime() + 31 * 24 * 60 * 60 * 1000);
        
        if (selectedDate > maxEndTime) {
            endTimeError.classList.remove('hidden');
            endTimeError.textContent = 'End time cannot be more than 31 days from original creation';
            return false;
        }
        
        endTimeError.classList.add('hidden');
        return true;
    }

    function validateForm() {
        const titleValid = validateTitle();
        let timeValid = false;
        
        if (activeTimeTab === 'duration') {
            timeValid = validateDuration();
        } else if (activeTimeTab === 'endTime') {
            timeValid = validateEndTime();
        }
        
        const isValid = titleValid && timeValid;
        saveButton.disabled = !isValid;
        return isValid;  // <-- Add this line!
    }

    // Add validation listeners
    titleInput.addEventListener('input', validateForm);
    durationDays.addEventListener('input', validateForm);
    durationHours.addEventListener('input', validateForm);
    durationMinutes.addEventListener('input', validateForm);
    endTimeInput.addEventListener('input', validateForm);

    // Save button handler
    // Save button handler
    saveButton.addEventListener('click', async function() {
        console.log('Save button clicked!');
        console.log('Validation result:', validateForm());
        
        if (!validateForm()) {
            console.log('Validation failed, returning early');
            return;
        }
        
        const updateData = {
            title: titleInput.value
        };
        
        // Only include time data if user is on a time tab and values are set
        if (activeTimeTab === 'duration') {
            const totalHours = (parseInt(durationDays.value) * 24) + 
                              parseInt(durationHours.value) + 
                              (parseInt(durationMinutes.value) / 60);
            
            // Only send if user actually entered a duration
            if (totalHours > 0) {
                updateData.time_tab = 'duration';
                updateData.duration_hours = totalHours;
            }
        } else if (activeTimeTab === 'endTime' && endTimeInput.value) {
            // Only send if user actually selected an end time
            updateData.time_tab = 'endTime';
            updateData.end_time = new Date(endTimeInput.value).toISOString();
        }

        // Include specific_users if this is a specific permission event
        if (specificUsersSection && (event.permission_level === 'specific' || event.permission_level === 'specific_users')) {
            updateData.specific_users = currentUsers;
        }
        
        console.log('Update data being sent:', updateData);
        console.log('Event ID:', event.id);
        console.log('URL:', `/votes/update/${event.id}`);
        
        try {
            const response = await fetch(`/votes/update/${event.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            const result = await response.json();
            console.log('Response data:', result);
            
            if (result.success) {
                alert('Event updated successfully!');
                closePopup();
                // Refresh the voting interface
                await createVotingInterface(result.event, false);
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error updating event:', error);
            alert('Failed to update event. Please try again.');
        }
    });

    // End Now button handler
    endNowButton.addEventListener('click', async function() {
        if (!confirm('Are you sure you want to end this voting event now?')) {
            return;
        }
        
        try {
            const response = await fetch(`/votes/update/${event.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ end_now: true })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Voting event ended!');
                closePopup();
                // Refresh as expired
                await createVotingInterface(result.event, true);
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error ending event:', error);
            alert('Failed to end event. Please try again.');
        }
    });

    // Assemble the form
    editForm.appendChild(header);
    editForm.appendChild(titleSection);
    editForm.appendChild(timeSection);
    if (specificUsersSection) {
        editForm.appendChild(specificUsersSection);
    }
    editForm.appendChild(buttonSection);
    
    popup.appendChild(editForm);

    // Add to page
    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
    
    // Initial validation
    validateForm();
}

function createEventButton(event, isActive) {
    const eventButton = document.createElement('button');
    eventButton.className = 'event-button glass-card';
    
    // ADD: Add permission level as CSS class
    if (event.permission_level) {
        eventButton.classList.add(`permission-${event.permission_level}`);
    }
    
    eventButton.dataset.eventData = JSON.stringify(event)
    
    // Add visual styling for expired events
    if (!isActive) {
        eventButton.classList.add('expired');
    }
    
    const voteEventId = document.createElement('h4');
    voteEventId.classList.add('vote-event-id');
    voteEventId.textContent = `#${event.id}`

    const timeInfo = document.createElement('p');
    timeInfo.classList.add('time-info');
    if (isActive) {
        // Check if we have end_time for live countdown
        if (event.end_time) {
            // Set initial display
            const endTime = new Date(event.end_time);
            const now = new Date();
            const remaining = endTime - now;
            if (remaining > 0) {
                timeInfo.textContent = formatTimeRemaining(remaining);
                // Start countdown timer
                const timerId = createCountdownTimer(timeInfo, event.end_time);
                if (timerId) {
                    // Store in map for cleanup
                    activeTimers.set(timeInfo, timerId);
                }
            } else {
                timeInfo.textContent = "Ended";
                timeInfo.classList.add('expired');
            }
        } else {
            // Fallback to static time_remaining if end_time not available
            timeInfo.textContent = `${event.time_remaining}`;
        }
    } else {
        timeInfo.textContent = `${event.time_ended}`;
        timeInfo.classList.add('expired');
    }

    const colorBlock = document.createElement('div');
    colorBlock.className = 'color-block';

    // Add permission class to colorBlock (same pattern as eventButton)
    if (event.permission_level) {
        colorBlock.classList.add(`permission-${event.permission_level}`);
    }

    colorBlock.appendChild(voteEventId);
    colorBlock.appendChild(timeInfo);

    const usernameAndTitle = document.createElement('h3');
    usernameAndTitle.classList.add('username-and-title');
    usernameAndTitle.textContent = `${event.owner_username || event.creator_username}'s vote for '${event.emote_set_name}'`;

    const voteTitle = document.createElement('h2');
    voteTitle.classList.add('vote-title');
    voteTitle.textContent = `"${event.title}"`;

    const totalVotes = document.createElement('p');
    totalVotes.classList.add('total-votes');
    totalVotes.textContent = `${event.total_votes} votes counted`;
    
    // Only add click functionality for active events
    if (isActive) {
        eventButton.addEventListener('click', async function() {
            await createVotingInterface(event, !isActive); // !isActive = true if expired
        });
    } else {
        // Allow expired events to be clickable for view-only mode
        eventButton.addEventListener('click', async function() {
            await createVotingInterface(event, true); // true = expired
        });
    }
    
    // Create a container for text content
    const textContent = document.createElement('div');
    textContent.className = 'event-text-content';

    // Add text elements to the container
    textContent.appendChild(voteTitle);
    textContent.appendChild(usernameAndTitle);
    textContent.appendChild(totalVotes);

    // Append to event button
    eventButton.appendChild(colorBlock);
    eventButton.appendChild(textContent);
    
    return eventButton;
}

export function displayVotingEvents(activeEvents, expiredEvents) {
    const contentArea = document.querySelector('#content-area');
    // Cleanup timers before clearing content
    cleanupTimers();
    contentArea.innerHTML = ''; 

    // Create filter and sort controls container
    const filterAndSortSection = document.createElement('div');
    filterAndSortSection.id = 'filter-sort-section';
    filterAndSortSection.className = 'filter-sort-section glass-card';

    const filterGrid = document.createElement('div');
    filterGrid.className = 'filter-grid';
    
    // Status filter
    const statusFilterDiv = document.createElement('div');
    const statusLabel = document.createElement('label');
    statusLabel.setAttribute('for', 'status-filter');
    statusLabel.className = 'filter-label';
    statusLabel.textContent = 'Status:';
    const statusSelect = document.createElement('select');
    statusSelect.id = 'status-filter';
    statusSelect.className = 'filter-select';
    statusSelect.innerHTML = `
        <option value="all">All Events</option>
        <option value="active" selected>Active Only</option>
        <option value="expired">Expired Only</option>
    `;
    statusFilterDiv.appendChild(statusLabel);
    statusFilterDiv.appendChild(statusSelect);
    
    // Permission filter
    const permissionFilterDiv = document.createElement('div');
    const permissionLabel = document.createElement('label');
    permissionLabel.setAttribute('for', 'permission-filter');
    permissionLabel.className = 'filter-label';
    permissionLabel.textContent = 'Permission:';
    const permissionSelect = document.createElement('select');
    permissionSelect.id = 'permission-filter';
    permissionSelect.className = 'filter-select';
    permissionSelect.innerHTML = `
        <option value="">All Types</option>
        <option value="all">All Users</option>
        <option value="followers">Followers Only</option>
        <option value="subscribers">Subscribers Only</option>
        <option value="specific">Specific Users</option>
    `;
    permissionFilterDiv.appendChild(permissionLabel);
    permissionFilterDiv.appendChild(permissionSelect);
    
    // Creator filter
    const creatorFilterDiv = document.createElement('div');
    const creatorLabel = document.createElement('label');
    creatorLabel.setAttribute('for', 'creator-filter');
    creatorLabel.className = 'filter-label';
    creatorLabel.textContent = 'Creator:';
    const creatorSelect = document.createElement('select');
    creatorSelect.id = 'creator-filter';
    creatorSelect.className = 'filter-select';
    creatorSelect.innerHTML = `
        <option value="all">All Creators</option>
        <option value="my-events">My Events</option>
        <option value="moderate">Events I Moderate</option>
        <option value="following">Channels I Follow</option>
    `;
    creatorFilterDiv.appendChild(creatorLabel);
    creatorFilterDiv.appendChild(creatorSelect);
    
    // Sort select
    const sortFilterDiv = document.createElement('div');
    const sortLabel = document.createElement('label');
    sortLabel.setAttribute('for', 'sort-select');
    sortLabel.className = 'filter-label';
    sortLabel.textContent = 'Sort By:';
    const sortSelect = document.createElement('select');
    sortSelect.id = 'sort-select';
    sortSelect.className = 'filter-select';
    sortSelect.innerHTML = `
        <option value="ending-soon" selected>Ending Soon</option>
        <option value="ending-later">Ending Later</option>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="most-votes">Most Votes</option>
        <option value="least-votes">Least Votes</option>
        <option value="a-z">A-Z</option>
        <option value="z-a">Z-A</option>
    `;
    sortFilterDiv.appendChild(sortLabel);
    sortFilterDiv.appendChild(sortSelect);
    
    filterGrid.appendChild(statusFilterDiv);
    filterGrid.appendChild(permissionFilterDiv);
    filterGrid.appendChild(creatorFilterDiv);
    filterGrid.appendChild(sortFilterDiv);
    
    // Search input
    const searchDiv = document.createElement('div');
    const searchLabel = document.createElement('label');
    searchLabel.setAttribute('for', 'search-input');
    searchLabel.className = 'filter-label';
    searchLabel.textContent = 'Search:';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search-input';
    searchInput.className = 'filter-search-input';
    searchInput.placeholder = 'Search by title, creator, or emote set...';
    searchDiv.appendChild(searchLabel);
    searchDiv.appendChild(searchInput);
    
    filterAndSortSection.appendChild(filterGrid);
    filterAndSortSection.appendChild(searchDiv);

    // Create events layout wrapper
    const eventsLayout = document.createElement('div');
    eventsLayout.className = 'events-layout';
    
    // Append filter section to layout wrapper
    eventsLayout.appendChild(filterAndSortSection);
    
    // Get references to all filter controls (using the elements we just created)
    const statusFilter = statusSelect;
    const permissionFilter = permissionSelect;
    const creatorFilter = creatorSelect;
    // sortSelect and searchInput are already defined above

    // Store current user info for filtering
    let currentUser = null;
    let followedChannels = new Set();
    let followedChannelsCacheTimestamp = null;
    const FOLLOWED_CHANNELS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    // Fetch current user info (using cache)
    getCachedUser().then(data => {
        if (data.authenticated) {
            currentUser = data.user;
        }
    });

    // Cache for parsed event data to avoid redundant JSON.parse calls
    const eventDataCache = new WeakMap();
    let cacheHits = 0;
    let cacheMisses = 0;
    
    // Helper function to get cached or parse event data
    function getCachedEventData(button) {
        let eventData = eventDataCache.get(button);
        if (!eventData) {
            cacheMisses++;
            eventData = JSON.parse(button.dataset.eventData);
            eventDataCache.set(button, eventData);
        } else {
            cacheHits++;
        }
        return eventData;
    }

    // Debounce helper function for event list search
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Debounce counters for event list search
    let eventSearchDebounceCount = 0;
    let eventSearchExecuteCount = 0;

    // Main filter and sort function
    async function applyFiltersAndSort() {
        // Reset cache stats at the start of each filter/sort operation
        const startCacheHits = cacheHits;
        const startCacheMisses = cacheMisses;
        const startTime = performance.now();
        
        const allButtons = document.querySelectorAll('.event-button');
        const statusValue = statusFilter.value;
        const permissionValue = permissionFilter.value;
        const creatorValue = creatorFilter.value;
        const sortValue = sortSelect.value;
        const searchValue = searchInput.value.toLowerCase().trim();
        
        // Handle "Channels I Follow" filter (requires API call)
        // OPTIMIZATION: Cache followed channels for 10 minutes
        if (creatorValue === 'following') {
            const now = Date.now();
            const cacheValid = followedChannelsCacheTimestamp && 
                             (now - followedChannelsCacheTimestamp) < FOLLOWED_CHANNELS_CACHE_DURATION;
            
            if (followedChannels.size === 0 || !cacheValid) {
                // Show loading state
                creatorFilter.disabled = true;
                try {
                    const fetchStartTime = performance.now();
                    const response = await fetch('/user/following', { credentials: 'include' });
                    const data = await response.json();
                    followedChannels = new Set(data.channel_ids || []);
                    followedChannelsCacheTimestamp = now;
                    const fetchEndTime = performance.now();
                    const fetchDuration = fetchEndTime - fetchStartTime;
                    
                    if (cacheValid) {
                        console.log(`[FOLLOWED CHANNELS CACHE] Cache expired, refreshed in ${fetchDuration.toFixed(2)}ms`);
                    } else {
                        console.log(`[FOLLOWED CHANNELS CACHE] Fetched ${followedChannels.size} followed channels in ${fetchDuration.toFixed(2)}ms (cached for 10 minutes)`);
                    }
                } catch (error) {
                    console.error('Failed to fetch followed channels:', error);
                    alert('Failed to load followed channels. Please try again.');
                    creatorFilter.value = 'all';
                    creatorFilter.disabled = false;
                    return;
                }
                creatorFilter.disabled = false;
            } else {
                console.log(`[FOLLOWED CHANNELS CACHE] Using cached followed channels (${followedChannels.size} channels)`);
            }
        }
        
        // Convert NodeList to Array for filtering and sorting
        let visibleButtons = Array.from(allButtons);
        
        // Apply filters
        visibleButtons = visibleButtons.filter(button => {
            const eventData = getCachedEventData(button);
        
            
            // Status filter
            if (statusValue === 'active' && !eventData.is_active) return false;
            if (statusValue === 'expired' && eventData.is_active) return false;
            
            // Permission filter
            if (permissionValue && permissionValue !== '' && eventData.permission_level !== permissionValue) return false;
            
            // Creator filter
            if (creatorValue === 'my-events' && currentUser && eventData.creator_username !== currentUser.display_name) return false;
            if (creatorValue === 'moderate' && !eventData.can_edit) return false;
            
            if (creatorValue === 'following') {
                const ownerIdString = String(eventData.owner_twitch_id); // Convert to string
                if (!followedChannels.has(ownerIdString)) return false;
            }
            
            // Search filter
            if (searchValue) {
                const title = eventData.title || '';
                const creatorUsername = eventData.creator_username || '';
                const ownerUsername = eventData.owner_username || '';
                const emoteSetName = eventData.emote_set_name || '';
                
                const titleMatch = title.toLowerCase().includes(searchValue);
                const creatorMatch = creatorUsername.toLowerCase().includes(searchValue);
                const ownerMatch = ownerUsername.toLowerCase().includes(searchValue);
                const emoteSetMatch = emoteSetName.toLowerCase().includes(searchValue);
                
                if (!titleMatch && !creatorMatch && !ownerMatch && !emoteSetMatch) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Apply sorting
        visibleButtons.sort((a, b) => {
            const eventA = getCachedEventData(a);
            const eventB = getCachedEventData(b);
            
            switch (sortValue) {
                case 'ending-soon':
                    return new Date(eventA.end_time) - new Date(eventB.end_time);
                case 'ending-later':
                    return new Date(eventB.end_time) - new Date(eventA.end_time);
                case 'newest':
                    return eventB.id - eventA.id; // Assuming higher ID = newer
                case 'oldest':
                    return eventA.id - eventB.id;
                case 'most-votes':
                    return eventB.total_votes - eventA.total_votes;
                case 'least-votes':
                    return eventA.total_votes - eventB.total_votes;
                case 'a-z':
                    return eventA.title.localeCompare(eventB.title);
                case 'z-a':
                    return eventB.title.localeCompare(eventA.title);
                default:
                    return 0;
            }
        });
        
        // Hide all buttons first
        allButtons.forEach(button => button.classList.add('hidden'));
        
        // Show and reorder visible buttons
        const activeSection = document.querySelector('.active-events-list');
        const expiredSection = document.querySelector('.expired-events-list');
        
        visibleButtons.forEach(button => {
            button.classList.remove('hidden');
            const eventData = getCachedEventData(button);
            
            // Append to correct section to maintain order
            if (eventData.is_active && activeSection) {
                activeSection.appendChild(button);
            } else if (!eventData.is_active && expiredSection) {
                expiredSection.appendChild(button);
            }
        });
        
        // Hide section titles AND sections if no buttons are visible in that section
        const activeTitle = document.querySelector('.active-section-title');
        const expiredTitle = document.querySelector('.expired-section-title');
        const activeSectionContainer = document.querySelector('.active-events-section');
        const expiredSectionContainer = document.querySelector('.expired-events-section');

        const activeVisible = visibleButtons.some(btn => getCachedEventData(btn).is_active);
        const expiredVisible = visibleButtons.some(btn => !getCachedEventData(btn).is_active);

        if (activeTitle) {
            activeTitle.classList.toggle('hidden', !activeVisible);
        }
        if (activeSectionContainer) {
            activeSectionContainer.classList.toggle('hidden', !activeVisible);
        }
        if (expiredTitle) {
            expiredTitle.classList.toggle('hidden', !expiredVisible);
        }
        if (expiredSectionContainer) {
            expiredSectionContainer.classList.toggle('hidden', !expiredVisible);
        }
        
        // Show "no results" message if nothing matches
        if (visibleButtons.length === 0) {
            const noResults = document.createElement('p');
            noResults.className = 'no-results-message';
            noResults.textContent = 'No events match your filters.';
            noResults.id = 'no-results-message';
            
            // Remove old message if exists
            const oldMessage = document.getElementById('no-results-message');
            if (oldMessage) oldMessage.remove();
            
            contentArea.appendChild(noResults);
        } else {
            // Remove "no results" message if it exists
            const oldMessage = document.getElementById('no-results-message');
            if (oldMessage) oldMessage.remove();
        }
        
        // Performance debugging
        const endTime = performance.now();
        const operationTime = endTime - startTime;
        const hitsThisOperation = cacheHits - startCacheHits;
        const missesThisOperation = cacheMisses - startCacheMisses;
        const totalOperations = hitsThisOperation + missesThisOperation;
        const cacheHitRate = totalOperations > 0 ? ((hitsThisOperation / totalOperations) * 100).toFixed(1) : 0;
        
        console.log(`[CACHE PERF] Filter/Sort completed in ${operationTime.toFixed(2)}ms`);
        console.log(`[CACHE PERF] Cache stats - Hits: ${hitsThisOperation}, Misses: ${missesThisOperation}, Hit rate: ${cacheHitRate}%`);
        console.log(`[CACHE PERF] Total buttons: ${allButtons.length}, Visible buttons: ${visibleButtons.length}`);
    }

    // Attach event listeners
    statusFilter.addEventListener('change', applyFiltersAndSort);
    permissionFilter.addEventListener('change', applyFiltersAndSort);
    creatorFilter.addEventListener('change', applyFiltersAndSort);
    sortSelect.addEventListener('change', applyFiltersAndSort);
    
    // Debounced search with debug logging
    const debouncedApplyFilters = debounce(function() {
        eventSearchExecuteCount++;
        console.log(`[EVENT SEARCH DEBOUNCE] Search executed (count: ${eventSearchExecuteCount}). Current value: "${searchInput.value}"`);
        applyFiltersAndSort();
    }, 300);
    
    searchInput.addEventListener('input', function() {
        eventSearchDebounceCount++;
        if (eventSearchDebounceCount % 3 === 0) {
            console.log(`[EVENT SEARCH DEBOUNCE] Input event fired (total: ${eventSearchDebounceCount}, executed: ${eventSearchExecuteCount})`);
        }
        debouncedApplyFilters();
    });

    

    console.log("Active events:", activeEvents);
    console.log("Expired events:", expiredEvents);
    console.log("Active count:", activeEvents ? activeEvents.length : 0);
    console.log("Expired count:", expiredEvents ? expiredEvents.length : 0);



    if ((!activeEvents || activeEvents.length === 0) && (!expiredEvents || expiredEvents.length === 0)) {
        cleanupTimers();
        cleanupTimers();
        contentArea.innerHTML = '<h2>No voting events available</h2>';
        return;
    }
    // Create main container for both sections
    const mainContainer = document.createElement('div');
    mainContainer.className = 'events-main-container';  

    // Active Events Section
    if (activeEvents && activeEvents.length > 0) {
        const activeSection = document.createElement('div');
        activeSection.className = 'active-events-section';
        
        const activeTitle = document.createElement('h2');
        activeTitle.className = 'section-title active-section-title';
        activeTitle.textContent = 'Active Voting Events';
        activeSection.appendChild(activeTitle);
        
        const activeEventList = document.createElement('div');
        activeEventList.classList.add('active-events-list');
        
        activeEvents.forEach(event => {
            const eventButton = createEventButton(event, true); // true = active
            activeEventList.appendChild(eventButton);
        });
        
        activeSection.appendChild(activeEventList);
        mainContainer.appendChild(activeSection);
    }

    // Expired Events Section
    if (expiredEvents && expiredEvents.length > 0) {
        const expiredSection = document.createElement('div');
        expiredSection.className = 'expired-events-section';
        
        const expiredTitle = document.createElement('h2');
        expiredTitle.className = 'section-title expired-section-title';
        expiredTitle.textContent = 'Recent Results';
        expiredSection.appendChild(expiredTitle);
        
        const expiredEventList = document.createElement('div');
        expiredEventList.classList.add('expired-events-list');
        
        expiredEvents.forEach(event => {
            const eventButton = createEventButton(event, false); // false = expired
            expiredEventList.appendChild(eventButton);
        });
        
        expiredSection.appendChild(expiredEventList);
        mainContainer.appendChild(expiredSection);
    }

    // Append main container to layout wrapper
    eventsLayout.appendChild(mainContainer);
    
    // Append layout wrapper to content area
    contentArea.appendChild(eventsLayout);

    applyFiltersAndSort(); 
}

export async function displayVotingEventById(eventId) {
    try {
        const response = await fetch(`/votes/${eventId}`);
        const data = await response.json();
        
        if (data.success) {
            await createVotingInterface(data.event, false); // false = not expired
        } else {
            cleanupTimers();
        cleanupTimers();
        contentArea.innerHTML = `<p>Error: ${data.message}</p>`;
        }
    } catch (error) {
        console.error('Error loading voting event:', error);
        cleanupTimers();
        contentArea.innerHTML = '<p>Error loading voting event</p>';
    }
}