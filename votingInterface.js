import { getEmotesFromSet, getEmoteImgUrl, createNeutralVote, createNeutralVotesInBackground, getVoteCounts } from "./api.js";
const contentArea = document.querySelector('#content-area');
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

    // Fetch current user
    const authResponse = await fetch('/auth/me');
    const authData = await authResponse.json();

    let currentUsername = null;
    if (authData.authenticated) {
        currentUsername = authData.user.login;
    }
    // Check if user can edit this event
    const canEdit = event.can_edit || false;

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

    // Create event info header
    const infoHeader = document.createElement('div');
    infoHeader.style.cssText = 'background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin-bottom: 20px;';

    // Event title and creator
    const titleSection = document.createElement('h2');
    titleSection.textContent = `"${event.title}"`;
    titleSection.style.cssText = 'margin: 0 0 10px 0; color: #333;';

    const creatorInfo = document.createElement('p');
    creatorInfo.textContent = `Created by ${event.creator_username} for emote set: ${event.emote_set_name}`;
    creatorInfo.style.cssText = 'margin: 0 0 15px 0; color: #666;';

    // Time info
    const timeInfo = document.createElement('p');
    timeInfo.textContent = event.time_remaining || event.time_ended || 'Time info unavailable';
    timeInfo.style.cssText = 'margin: 0 0 15px 0; font-weight: bold; color: ' + (isExpired ? '#dc3545' : '#28a745') + ';';

    // Calculate total votes across all emotes
    let totalKeep = 0, totalNeutral = 0, totalRemove = 0;
    for (const emoteId in voteCounts) {
        totalKeep += voteCounts[emoteId].keep || 0;
        totalNeutral += voteCounts[emoteId].neutral || 0;
        totalRemove += voteCounts[emoteId].remove || 0;
    }

    // Vote statistics
    const voteStats = document.createElement('div');
    voteStats.id = 'vote-statistics';  // ADD THIS LINE RIGHT AFTER
    voteStats.innerHTML = `
        <strong>Vote Statistics:</strong><br>
        Total Voters: ${event.total_votes || 0}<br>
        Keep: ${totalKeep} | Neutral: ${totalNeutral} | Remove: ${totalRemove}
    `;
    voteStats.style.cssText = 'margin: 0; color: #495057;';

    // Append all to header
    infoHeader.appendChild(titleSection);
    infoHeader.appendChild(creatorInfo);
    infoHeader.appendChild(timeInfo);
    infoHeader.appendChild(voteStats);

    // Add header to page
    contentArea.appendChild(infoHeader);

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

        if (canEdit) {
            const editButton = document.createElement('button');
            editButton.id = 'edit-button';
            editButton.textContent = 'Edit Event';  // Add text so it's visible!
            editButton.style.cssText = 'margin-bottom: 20px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
        
            editButton.addEventListener('click', async function () {
                openEditPopup(event);
            });
            
            emoteGrid.appendChild(editButton);  // <-- This line is missing!
        }
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
                // Update header statistics
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
                // Update header statistics
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
                // Update header statistics
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

async function openEditPopup(event) {
    // Create the backdrop (darkens the background)
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
    `;

    // Create the popup container (centered box)
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 8px;
        z-index: 1001;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;

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
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    `;
    
    const headerTitle = document.createElement('h2');
    headerTitle.textContent = 'Edit Voting Event';
    headerTitle.style.margin = '0';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'x';
    closeBtn.type = 'button';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 30px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        line-height: 1;
    `;
    closeBtn.addEventListener('click', closePopup);
    
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    // Title Section
    const titleSection = document.createElement('div');
    titleSection.className = 'form-section';
    titleSection.style.marginBottom = '15px';
    
    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Event Title';
    titleLabel.style.display = 'block';
    titleLabel.style.marginBottom = '5px';
    titleLabel.style.fontWeight = 'bold';
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = event.title;  // Pre-fill with current title
    titleInput.style.cssText = 'width: 100%; padding: 8px; box-sizing: border-box;';

    const titleError = document.createElement('div');
    titleError.className = 'error-message';
    titleError.style.color = 'red';
    titleError.style.display = 'none';
    titleError.style.marginTop = '5px';

    titleSection.appendChild(titleLabel);
    titleSection.appendChild(titleInput);
    titleSection.appendChild(titleError);

    // Time Section
    let activeTimeTab = 'duration';  // Default to duration tab
    
    const timeSection = document.createElement('div');
    timeSection.className = 'form-section';
    timeSection.style.marginBottom = '15px';
    
    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Event Duration';
    timeLabel.style.display = 'block';
    timeLabel.style.marginBottom = '5px';
    timeLabel.style.fontWeight = 'bold';
    
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
    
    const durationTab = document.createElement('button');
    durationTab.textContent = 'Duration';
    durationTab.type = 'button';
    durationTab.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;';
    
    const endTimeTab = document.createElement('button');
    endTimeTab.textContent = 'End Time';
    endTimeTab.type = 'button';
    endTimeTab.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px;';

    tabContainer.appendChild(durationTab);
    tabContainer.appendChild(endTimeTab);

    // Duration Content
    const durationContent = document.createElement('div');
    durationContent.className = 'time-tabs';
    durationContent.style.display = 'block';

    const durationError = document.createElement('div');
    durationError.className = 'error-message';
    durationError.style.color = 'red';
    durationError.style.display = 'none';
    durationError.style.marginTop = '5px';
    
    // Days Input
    const daysLabel = document.createElement('label');
    daysLabel.textContent = 'Days: ';
    daysLabel.style.marginRight = '5px';
    const durationDays = document.createElement('input');
    durationDays.type = 'number';
    durationDays.value = '0';
    durationDays.min = '0';
    durationDays.max = '31';
    durationDays.style.cssText = 'width: 60px; margin-right: 15px; padding: 5px;';
    
    // Hours Input
    const hoursLabel = document.createElement('label');
    hoursLabel.textContent = 'Hours: ';
    hoursLabel.style.marginRight = '5px';
    const durationHours = document.createElement('input');
    durationHours.type = 'number';
    durationHours.value = '0';
    durationHours.min = '0';
    durationHours.max = '23';
    durationHours.style.cssText = 'width: 60px; margin-right: 15px; padding: 5px;';
    
    // Minutes Input
    const minutesLabel = document.createElement('label');
    minutesLabel.textContent = 'Minutes: ';
    minutesLabel.style.marginRight = '5px';
    const durationMinutes = document.createElement('input');
    durationMinutes.type = 'number';
    durationMinutes.value = '0';
    durationMinutes.min = '0';
    durationMinutes.max = '59';
    durationMinutes.style.cssText = 'width: 60px; padding: 5px;';

    durationContent.appendChild(daysLabel);
    durationContent.appendChild(durationDays);
    durationContent.appendChild(hoursLabel);
    durationContent.appendChild(durationHours);
    durationContent.appendChild(minutesLabel);
    durationContent.appendChild(durationMinutes);
    durationContent.appendChild(durationError);

    // End Time Content
    const endTimeContent = document.createElement('div');
    endTimeContent.className = 'time-tabs';
    endTimeContent.style.display = 'none';
    
    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'datetime-local';
    endTimeInput.min = new Date().toISOString().slice(0, 16);
    endTimeInput.style.cssText = 'width: 100%; padding: 8px; box-sizing: border-box;';

    const endTimeError = document.createElement('div');
    endTimeError.className = 'error-message';
    endTimeError.style.color = 'red';
    endTimeError.style.display = 'none';
    endTimeError.style.marginTop = '5px';
    
    endTimeContent.appendChild(endTimeInput);
    endTimeContent.appendChild(endTimeError);

    timeSection.appendChild(timeLabel);
    timeSection.appendChild(tabContainer);
    timeSection.appendChild(durationContent);
    timeSection.appendChild(endTimeContent);

    // Tab switching logic
    durationTab.addEventListener('click', function() {
        durationContent.style.display = 'block';
        endTimeContent.style.display = 'none';
        activeTimeTab = 'duration';
        durationTab.style.background = '#007bff';
        endTimeTab.style.background = '#6c757d';
        validateDuration();
    });
    
    endTimeTab.addEventListener('click', function() {
        durationContent.style.display = 'none';
        endTimeContent.style.display = 'block';
        activeTimeTab = 'endTime';
        durationTab.style.background = '#6c757d';
        endTimeTab.style.background = '#007bff';
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
    buttonSection.style.cssText = 'display: flex; gap: 10px; margin-top: 20px;';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save Changes';
    saveButton.type = 'button';
    saveButton.style.cssText = 'flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;';
    saveButton.disabled = true;
    
    const endNowButton = document.createElement('button');
    endNowButton.textContent = 'End Now';
    endNowButton.type = 'button';
    endNowButton.style.cssText = 'flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;';

    buttonSection.appendChild(saveButton);
    buttonSection.appendChild(endNowButton);

    // Validation functions
    function validateTitle() {
        if (titleInput.value.trim() === '') {
            titleError.style.display = 'block';
            titleError.textContent = 'Event title cannot be empty';
            return false;
        }
        titleError.style.display = 'none';
        return true;
    }

    function validateDuration() {
        if (activeTimeTab !== 'duration') return true;
    
        const totalMinutes = (parseInt(durationDays.value) * 24 * 60) + 
                            (parseInt(durationHours.value) * 60) + 
                            parseInt(durationMinutes.value);
        
        // If duration is 0, that's OK - user might just be changing title
        if (totalMinutes === 0) {
            durationError.style.display = 'none';
            return true;  // Allow 0 duration (won't be sent to backend)
        }
        
        // Must be at least 5 minutes from now
        if (totalMinutes < 5) {
            durationError.style.display = 'block';
            durationError.textContent = 'Duration must be at least 5 minutes from now';
            return false;
        }
        
        // Calculate time from original creation
        const createdAt = new Date(event.created_at);
        const proposedEndTime = new Date(Date.now() + totalMinutes * 60 * 1000);
        const maxEndTime = new Date(createdAt.getTime() + 31 * 24 * 60 * 60 * 1000); // 31 days from creation
        
        if (proposedEndTime > maxEndTime) {
            durationError.style.display = 'block';
            durationError.textContent = 'End time cannot be more than 31 days from original creation';
            return false;
        }
        
        durationError.style.display = 'none';
        return true;
    }

    function validateEndTime() {
        if (activeTimeTab !== 'endTime') return true;
    
        // If no value entered, that's OK - user might just be changing title
        if (!endTimeInput.value) {
            endTimeError.style.display = 'none';
            return true;
        }
    
        const selectedDate = new Date(endTimeInput.value);
        const now = new Date();
        const diffMinutes = (selectedDate - now) / (1000 * 60);
    
        if (isNaN(selectedDate.getTime())) {
            endTimeError.style.display = 'block';
            endTimeError.textContent = 'Please select a valid date and time';
            return false;
        }
        
        // Must be at least 5 minutes from now
        if (diffMinutes < 5) {
            endTimeError.style.display = 'block';
            endTimeError.textContent = 'End time must be at least 5 minutes from now';
            return false;
        }
        
        // Cannot be more than 31 days from original creation
        const createdAt = new Date(event.created_at);
        const maxEndTime = new Date(createdAt.getTime() + 31 * 24 * 60 * 60 * 1000);
        
        if (selectedDate > maxEndTime) {
            endTimeError.style.display = 'block';
            endTimeError.textContent = 'End time cannot be more than 31 days from original creation';
            return false;
        }
        
        endTimeError.style.display = 'none';
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
    eventButton.classList.add('event-button');
    
    // ADD: Add permission level as CSS class
    if (event.permission_level) {
        eventButton.classList.add(`permission-${event.permission_level}`);
    }
    
    eventButton.dataset.eventData = JSON.stringify(event)
    
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

    // Create filter and sort controls container
    const filterAndSortSection = document.createElement('div');
    filterAndSortSection.id = 'filter-sort-section';
    filterAndSortSection.style.cssText = 'margin-bottom: 1.5rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;';

    filterAndSortSection.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div>
                <label for="status-filter" style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Status:</label>
                <select id="status-filter" style="width: 100%; padding: 0.5rem;">
                    <option value="all">All Events</option>
                    <option value="active" selected>Active Only</option>
                    <option value="expired">Expired Only</option>
                </select>
            </div>
            
            <div>
                <label for="permission-filter" style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Permission:</label>
                <select id="permission-filter" style="width: 100%; padding: 0.5rem;">
                    <option value="all">All Types</option>
                    <option value="public">Public</option>
                    <option value="followers">Followers Only</option>
                    <option value="subscribers">Subscribers Only</option>
                    <option value="specific">Specific Users</option>
                </select>
            </div>
            
            <div>
                <label for="creator-filter" style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Creator:</label>
                <select id="creator-filter" style="width: 100%; padding: 0.5rem;">
                    <option value="all">All Creators</option>
                    <option value="my-events">My Events</option>
                    <option value="moderate">Events I Moderate</option>
                    <option value="following">Channels I Follow</option>
                </select>
            </div>
            
            <div>
                <label for="sort-select" style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Sort By:</label>
                <select id="sort-select" style="width: 100%; padding: 0.5rem;">
                    <option value="ending-soon" selected>Ending Soon</option>
                    <option value="ending-later">Ending Later</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="most-votes">Most Votes</option>
                    <option value="least-votes">Least Votes</option>
                    <option value="a-z">A-Z</option>
                    <option value="z-a">Z-A</option>
                </select>
            </div>
        </div>
        
        <div>
            <label for="search-input" style="display: block; margin-bottom: 0.5rem; font-weight: bold;">Search:</label>
            <input 
                type="text" 
                id="search-input" 
                placeholder="Search by title, creator, or emote set..." 
                style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;"
            />
        </div>
    `;

    contentArea.appendChild(filterAndSortSection);
    // Get references to all filter controls
    const statusFilter = document.getElementById('status-filter');
    const permissionFilter = document.getElementById('permission-filter');
    const creatorFilter = document.getElementById('creator-filter');
    const sortSelect = document.getElementById('sort-select');
    const searchInput = document.getElementById('search-input');

    // Store current user info for filtering
    let currentUser = null;
    let followedChannels = new Set();

    // Fetch current user info
    fetch('/auth/me', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.authenticated) {
                currentUser = data.user;
            }
        });

    // Main filter and sort function
    async function applyFiltersAndSort() {
        const allButtons = document.querySelectorAll('.event-button');
        const statusValue = statusFilter.value;
        const permissionValue = permissionFilter.value;
        const creatorValue = creatorFilter.value;
        const sortValue = sortSelect.value;
        const searchValue = searchInput.value.toLowerCase().trim();
        
        // Handle "Channels I Follow" filter (requires API call)
        if (creatorValue === 'following' && followedChannels.size === 0) {
            // Show loading state
            creatorFilter.disabled = true;
            try {
                const response = await fetch('/user/following', { credentials: 'include' });
                const data = await response.json();
                followedChannels = new Set(data.channel_ids || []);
            } catch (error) {
                console.error('Failed to fetch followed channels:', error);
                alert('Failed to load followed channels. Please try again.');
                creatorFilter.value = 'all';
                creatorFilter.disabled = false;
                return;
            }
            creatorFilter.disabled = false;
        }
        
        // Convert NodeList to Array for filtering and sorting
        let visibleButtons = Array.from(allButtons);
        
        // Apply filters
        visibleButtons = visibleButtons.filter(button => {
            const eventData = JSON.parse(button.dataset.eventData);
        
            
            // Status filter
            if (statusValue === 'active' && !eventData.is_active) return false;
            if (statusValue === 'expired' && eventData.is_active) return false;
            
            // Permission filter
            if (permissionValue !== 'all' && eventData.permission_level !== permissionValue) return false;
            
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
            const eventA = JSON.parse(a.dataset.eventData);
            const eventB = JSON.parse(b.dataset.eventData);
            
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
        allButtons.forEach(button => button.style.display = 'none');
        
        // Show and reorder visible buttons
        const activeSection = document.querySelector('.active-events-list');
        const expiredSection = document.querySelector('.expired-events-list');
        
        visibleButtons.forEach(button => {
            button.style.display = 'block';
            const eventData = JSON.parse(button.dataset.eventData);
            
            // Append to correct section to maintain order
            if (eventData.is_active && activeSection) {
                activeSection.appendChild(button);
            } else if (!eventData.is_active && expiredSection) {
                expiredSection.appendChild(button);
            }
        });
        
        // Hide section titles if no buttons are visible in that section
        const activeTitle = document.querySelector('.active-section-title');
        const expiredTitle = document.querySelector('.expired-section-title');
        
        const activeVisible = visibleButtons.some(btn => JSON.parse(btn.dataset.eventData).is_active);
        const expiredVisible = visibleButtons.some(btn => !JSON.parse(btn.dataset.eventData).is_active);
        
        if (activeTitle) {
            activeTitle.style.display = activeVisible ? 'block' : 'none';
        }
        if (expiredTitle) {
            expiredTitle.style.display = expiredVisible ? 'block' : 'none';
        }
        
        // Show "no results" message if nothing matches
        if (visibleButtons.length === 0) {
            const noResults = document.createElement('p');
            noResults.textContent = 'No events match your filters.';
            noResults.style.cssText = 'text-align: center; color: #666; font-style: italic; padding: 2rem;';
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
    }

    // Attach event listeners
    statusFilter.addEventListener('change', applyFiltersAndSort);
    permissionFilter.addEventListener('change', applyFiltersAndSort);
    creatorFilter.addEventListener('change', applyFiltersAndSort);
    sortSelect.addEventListener('change', applyFiltersAndSort);
    searchInput.addEventListener('input', applyFiltersAndSort);

    

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
        activeTitle.classList.add('active-section-title'); // ADD THIS
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
        
        const expiredTitle = document.createElement('h2');
        expiredTitle.textContent = 'Recent Results';
        expiredTitle.style.color = '#6c757d';
        expiredTitle.classList.add('expired-section-title'); // ADD THIS
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

    contentArea.appendChild(mainContainer);

    applyFiltersAndSort(); 
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