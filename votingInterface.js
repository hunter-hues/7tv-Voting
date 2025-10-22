import { getEmotesFromSet, getEmoteImgUrl, createNeutralVote, createNeutralVotesInBackground, getVoteCounts } from "./api.js";
const contentArea = document.querySelector('#content-area');
async function createVotingInterface(event, isExpired = false) {
    console.log("Selected voting event:", event);
    const emotesData = await getEmotesFromSet(event.emote_set_id);
    const emotes = emotesData.emotes;
    
    const voteData = await getVoteCounts(event.id);
    if (!voteData.success) {
        console.error('Failed to get vote data:', voteData.error);
        return;
    }
    const voteCounts = voteData.vote_counts || {};
    const userVotes = voteData.vote_choices || {};

    contentArea.innerHTML = '';
    const emoteGrid = document.createElement('div');
    emoteGrid.className = 'emote-voting-grid';
    
    // Add expired message if needed
    if (isExpired) {
        const expiredMessage = document.createElement('div');
        expiredMessage.style.cssText = 'background: #ffebee; color: #c62828; padding: 10px; margin-bottom: 20px; border-radius: 4px; text-align: center; font-weight: bold;';
        expiredMessage.textContent = ' This voting event has expired - Results are view-only';
        emoteGrid.appendChild(expiredMessage);
    }
    
    // Only create neutral votes for active events
    if (!isExpired) {
        createNeutralVotesInBackground(event.id, emotes);
    }
    
    emotes.forEach(emote => {
        const emoteDiv = document.createElement('div');
        emoteDiv.id = emote.id;
        emoteDiv.classList.add('emote-div');
        const emoteUrl = getEmoteImgUrl(emote.id, '2');
        const emoteImg = document.createElement('img');
        emoteImg.src = emoteUrl;
        const emoteName = document.createElement('h3');
        emoteName.textContent = emote.name;
        const userVote = userVotes ? userVotes[emote.id] : null;
        console.log(`Emote ID: ${emote.id}, User vote: ${userVote}`);
        //add an image for buttons like a check, unsure what for neutral, and x or circle with cross
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
                console.log('Vote submitted:', result.message);
                // After successful vote submission
                keepButton.classList.remove('inactive');
                keepButton.classList.add('active');
                neutralButton.classList.remove('active');
                neutralButton.classList.add('inactive');
                removeButton.classList.remove('active');
                removeButton.classList.add('inactive');

                // Then refresh vote counts
                const updatedVoteData = await getVoteCounts(event.id);
                // Update button text with new counts
                keepButton.textContent = `yes (${updatedVoteData.vote_counts[emote.id]?.keep || 0})`;
                neutralButton.textContent = `idc (${updatedVoteData.vote_counts[emote.id]?.neutral || 0})`;
                removeButton.textContent = `no (${updatedVoteData.vote_counts[emote.id]?.remove || 0})`;
            } else {
                if (result.message === "This voting event has expired") {
                    alert('This voting event has expired. Refreshing...');
                    await createVotingInterface(event, true); // true = expired
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
                console.log('Vote submitted:', result.message);
                // After successful vote submission
                keepButton.classList.remove('active');
                keepButton.classList.add('inactive');
                neutralButton.classList.remove('active');
                neutralButton.classList.add('inactive');
                removeButton.classList.remove('inactive');
                removeButton.classList.add('active');

                // Then refresh vote counts
                const updatedVoteData = await getVoteCounts(event.id);
                // Update button text with new counts
                keepButton.textContent = `yes (${updatedVoteData.vote_counts[emote.id]?.keep || 0})`;
                neutralButton.textContent = `idc (${updatedVoteData.vote_counts[emote.id]?.neutral || 0})`;
                removeButton.textContent = `no (${updatedVoteData.vote_counts[emote.id]?.remove || 0})`;
            } else {
                if (result.message === "This voting event has expired") {
                    alert('This voting event has expired. Refreshing...');
                    await createVotingInterface(event, true); // true = expired
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
                console.log('Vote submitted:', result.message);
                // After successful vote submission
                keepButton.classList.remove('active');
                keepButton.classList.add('inactive');
                neutralButton.classList.remove('inactive');
                neutralButton.classList.add('active');
                removeButton.classList.remove('active');
                removeButton.classList.add('inactive');

                // Then refresh vote counts
                const updatedVoteData = await getVoteCounts(event.id);
                // Update button text with new counts
                keepButton.textContent = `yes (${updatedVoteData.vote_counts[emote.id]?.keep || 0})`;
                neutralButton.textContent = `idc (${updatedVoteData.vote_counts[emote.id]?.neutral || 0})`;
                removeButton.textContent = `no (${updatedVoteData.vote_counts[emote.id]?.remove || 0})`;
            } else {
                if (result.message === "This voting event has expired") {
                    alert('This voting event has expired. Refreshing...');
                    await createVotingInterface(event, true); // true = expired
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
        emoteGrid.appendChild(emoteDiv);
    });
    
    contentArea.appendChild(emoteGrid);
}

function createEventButton(event, isActive) {
    const eventButton = document.createElement('button');
    eventButton.classList.add('voting-event');
    
    // Add visual styling for expired events
    if (!isActive) {
        eventButton.style.opacity = '0.7';
        eventButton.style.backgroundColor = '#f8f9fa';
    }
    
    const usernameAndTitle = document.createElement('h3');
    usernameAndTitle.classList.add('username-and-title');
    usernameAndTitle.textContent = `${event.creator_username}'s vote for '${event.emote_set_name}'`;

    const voteTitle = document.createElement('h2');
    voteTitle.classList.add('vote-title');
    voteTitle.textContent = `"${event.title}"`;
    voteTitle.style.fontWeight = 'bold';
    voteTitle.style.color = '#333';

    const voteEventId = document.createElement('h4');
    voteEventId.classList.add('vote-event-id');
    voteEventId.textContent = `#${event.id}`
    
    const timeInfo = document.createElement('p');
    timeInfo.classList.add('time-info');
    
    if (isActive) {
        timeInfo.textContent = `${event.time_remaining}`;
    } else {
        timeInfo.textContent = `${event.time_ended}`;
        timeInfo.style.fontStyle = 'italic';
    }
    
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
    
    eventButton.appendChild(voteTitle);
    eventButton.appendChild(voteEventId);
    eventButton.appendChild(usernameAndTitle);
    eventButton.appendChild(timeInfo);
    eventButton.appendChild(totalVotes);
    
    return eventButton;
}

export function displayVotingEvents(activeEvents, expiredEvents) {
    const contentArea = document.querySelector('#content-area');
    contentArea.innerHTML = ''; 

    console.log("Active events:", activeEvents);
    console.log("Expired events:", expiredEvents);
    console.log("Active count:", activeEvents ? activeEvents.length : 0);
    console.log("Expired count:", expiredEvents ? expiredEvents.length : 0);

    if ((!activeEvents || activeEvents.length === 0) && (!expiredEvents || expiredEvents.length === 0)) {
        contentArea.innerHTML = '<h2>No voting events available</h2>';
        return;
    }
    // Create main container for both sections
    const mainContainer = document.createElement('div');

    // Active Events Section
    if (activeEvents && activeEvents.length > 0) {
        const activeSection = document.createElement('div');
        activeSection.style.marginBottom = '2rem';
        
        const activeTitle = document.createElement('h2');
        activeTitle.textContent = 'Active Voting Events';
        activeTitle.style.color = '#28a745';
        activeSection.appendChild(activeTitle);
        
        const activeEventList = document.createElement('div');
        
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
        
        const expiredTitle = document.createElement('h2');
        expiredTitle.textContent = 'Recent Results';
        expiredTitle.style.color = '#6c757d';
        expiredSection.appendChild(expiredTitle);
        
        const expiredEventList = document.createElement('div');
        
        expiredEvents.forEach(event => {
            const eventButton = createEventButton(event, false); // false = expired
            expiredEventList.appendChild(eventButton);
        });
        
        expiredSection.appendChild(expiredEventList);
        mainContainer.appendChild(expiredSection);
    }

    contentArea.appendChild(mainContainer);
}

export async function displayVotingEventById(eventId) {
    try {
        const response = await fetch(`/votes/${eventId}`);
        const data = await response.json();
        
        if (data.success) {
            await createVotingInterface(data.event, false); // false = not expired
        } else {
            contentArea.innerHTML = `<p>Error: ${data.message}</p>`;
        }
    } catch (error) {
        console.error('Error loading voting event:', error);
        contentArea.innerHTML = '<p>Error loading voting event</p>';
    }
}