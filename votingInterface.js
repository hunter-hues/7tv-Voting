import { getEmotesFromSet, getEmoteImgUrl, createNeutralVote, createNeutralVotesInBackground } from "./api.js";

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
            // Your existing click handler logic goes here
            console.log("Selected voting event:", event);
            const emotesData = await getEmotesFromSet(event.emote_set_id);
            const emotes = emotesData.emotes;  
            console.log("Emotes data received:", emotes);
            console.log("Type of emotes:", typeof emotes);
            console.log("Is emotes an array?", Array.isArray(emotes));

            contentArea.innerHTML='';
            const emoteGrid = document.createElement('div');
            emoteGrid.className = 'emote-voting-grid';
            createNeutralVotesInBackground(event.id, emotes);
            emotes.forEach(emote => {
                const emoteDiv = document.createElement('div');
                emoteDiv.className = 'emote-div';
                const emoteUrl = getEmoteImgUrl(emote.id, '2');
                const emoteImg = document.createElement('img');
                emoteImg.src = emoteUrl;
                const emoteName = document.createElement('h3');
                emoteName.textContent = emote.name;
                const keepButton = document.createElement('button');
                //add an image for buttons like a check, unsure what for neutral, and x or circle with cross
                keepButton.textContent = 'yes';
                const neutralButton = document.createElement('button');
                neutralButton.textContent = 'idc';
                const removeButton = document.createElement('button');
                removeButton.textContent = 'no';

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
                    } else {
                        console.error('Vote failed:', result.message);
                        alert('Failed to submit vote: ' + result.message);
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
                    } else {
                        console.error('Vote failed:', result.message);
                        alert('Failed to submit vote: ' + result.message);
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
                    } else {
                        console.error('Vote failed:', result.message);
                        alert('Failed to submit vote: ' + result.message);
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
        });
    } else {
        // For expired events, maybe just show results (future feature)
        eventButton.style.cursor = 'default';
    }
    
    eventButton.appendChild(voteTitle);
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