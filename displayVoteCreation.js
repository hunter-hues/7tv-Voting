import { displayVotingEventById } from "./votingInterface.js";

export function displayVoteCreation(selectedEmoteSet, username) {
    let activeTimeTab = 'duration';
    
    const emoteSetDisplay = document.querySelector('#emote-set-list');
    const votingSection = document.querySelector('#vote-creation');
    const personalEmotesTitle = document.querySelector('.section-title');
    
    if (emoteSetDisplay) {
        emoteSetDisplay.classList.add('hidden');
    }
    if (personalEmotesTitle) {
        personalEmotesTitle.classList.add('hidden');
    }
    if (votingSection) {
        votingSection.classList.remove('hidden');
        votingSection.innerHTML = '';
    }

    // Create emote set name title
    const emoteSetTitle = document.createElement('h2');
    emoteSetTitle.className = 'emote-set-title';
    emoteSetTitle.textContent = `Creating vote for: ${selectedEmoteSet.name}`;

    const votingForm = document.createElement('form');

    //Title Section
    const titleSection = document.createElement('div');
    titleSection.className = 'form-section';
    const titleInput = document.createElement('input');
    titleInput.className = 'form-input';
    titleInput.type = 'text';
    titleInput.placeholder = 'Vote Title';

    const titleError = document.createElement('div');
    titleError.className = 'error-message hidden';

    //Time Section
    const timeSection = document.createElement('div');
    timeSection.className = 'form-section';
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

    //Duration Content
    const durationContent = document.createElement('div');
    durationContent.className = 'time-tabs';

    const durationError = document.createElement('div');
    durationError.className = 'error-message hidden';
    
    //Days Input
    const daysLabel = document.createElement('label');
    daysLabel.className = 'duration-label';
    daysLabel.textContent = 'Days';
    const durationDays = document.createElement('input');
    durationDays.className = 'duration-input';
    durationDays.type = 'number';
    durationDays.value = '0';
    durationDays.min = '0';
    durationDays.max = '31';
    durationDays.placeholder = '0';
    
    //Hours Input
    const hoursLabel = document.createElement('label');
    hoursLabel.className = 'duration-label';
    hoursLabel.textContent = 'Hours';
    const durationHours = document.createElement('input');
    durationHours.className = 'duration-input';
    durationHours.type = 'number';
    durationHours.value = '0';
    durationHours.min = '0';
    durationHours.max = '24';
    durationHours.placeholder = '0'; 
    
    //Minutes Input
    const minutesLabel = document.createElement('label');
    minutesLabel.className = 'duration-label';
    minutesLabel.textContent = 'Minutes';
    const durationMinutes = document.createElement('input');
    durationMinutes.className = 'duration-input';
    durationMinutes.type = 'number';
    durationMinutes.value = '0';
    durationMinutes.min = '0';
    durationMinutes.max = '59';
    durationMinutes.placeholder = '0';
    
    // Wrap duration inputs in group
    const durationGroup = document.createElement('div');
    durationGroup.className = 'duration-input-group';
    durationGroup.appendChild(durationDays);
    durationGroup.appendChild(daysLabel);
    durationGroup.appendChild(durationHours);
    durationGroup.appendChild(hoursLabel);
    durationGroup.appendChild(durationMinutes);
    durationGroup.appendChild(minutesLabel);

    //End Time
    const endTimeContent = document.createElement('div');
    endTimeContent.className = 'time-tabs hidden';
    const endTimeInput = document.createElement('input');
    endTimeInput.className = 'form-input';
    endTimeInput.type = 'datetime-local';
    endTimeInput.min = new Date().toISOString().slice(0, 16); // Set minimum to current time

    const endTimeError = document.createElement('div');
    endTimeError.className = 'error-message hidden';
    

    //Permissions
    const permissionsSection = document.createElement('div');
    permissionsSection.className = 'form-section';
    const permissionSelect = document.createElement('select');
    permissionSelect.innerHTML = `
        <option value="all">All users</option>
        <option value="followers">Followers only</option>
        <option value="subscribers">Subscribers only</option>
        <option value="specific">Specific users</option>
    `;

    // Specific users section (initially hidden)
    const specificUsersSection = document.createElement('div');
    specificUsersSection.className = 'form-section specific-users-section hidden';
    specificUsersSection.id = 'specific-users-section';

    // Username input
    const usernameInput = document.createElement('input');
    usernameInput.className = 'specific-users-input';
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Enter Twitch username';
    usernameInput.id = 'username-input';

    // Add user button
    const addUserButton = document.createElement('button');
    addUserButton.className = 'add-user-button';
    addUserButton.type = 'button';
    addUserButton.textContent = 'Add User';
    addUserButton.id = 'add-user-btn';

    // Users list display
    const usersList = document.createElement('div');
    usersList.className = 'edit-users-list';
    usersList.id = 'users-list';

    specificUsersSection.appendChild(usernameInput);
    specificUsersSection.appendChild(addUserButton);
    specificUsersSection.appendChild(usersList);

    // Show/hide specific users section based on permission selection
    permissionSelect.addEventListener('change', function() {
        if (permissionSelect.value === 'specific') {
            specificUsersSection.classList.remove('hidden');
        } else {
            specificUsersSection.classList.add('hidden');
        }
    });

    // Add user functionality
    let specificUsersList = [];
    addUserButton.addEventListener('click', function() {
        const username = usernameInput.value.trim();
        if (username && !specificUsersList.includes(username)) {
            specificUsersList.push(username);
            updateUsersList();
            usernameInput.value = '';
        }
    });

    // Update users list display
    function updateUsersList() {
        usersList.innerHTML = '';
        specificUsersList.forEach((username, index) => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            
            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            
            const removeButton = document.createElement('button');
            removeButton.className = 'remove-user-button';
            removeButton.type = 'button';
            removeButton.textContent = 'Remove';
            removeButton.onclick = () => {
                specificUsersList.splice(index, 1);
                updateUsersList();
            };
            
            userDiv.appendChild(usernameSpan);
            userDiv.appendChild(removeButton);
            usersList.appendChild(userDiv);
        });
    }

    //Submit Button
    const submitSection = document.createElement('div');
    submitSection.className = 'form-section';
    const submitButton = document.createElement('button');
    submitButton.textContent = 'Start Vote';
    submitButton.disabled = true;

    // Add inputs and labels to sections
    titleSection.appendChild(titleInput);
    timeSection.appendChild(tabContainer);
    durationContent.appendChild(durationGroup);
    durationContent.appendChild(durationError);
    timeSection.appendChild(durationContent);
    endTimeContent.appendChild(endTimeInput);
    endTimeContent.appendChild(endTimeError);
    timeSection.appendChild(endTimeContent);
    permissionsSection.appendChild(permissionSelect);
    permissionsSection.appendChild(specificUsersSection); 
    submitSection.appendChild(submitButton);

    //Add error displays
    titleSection.appendChild(titleError);

    // Add sections to form
    votingForm.appendChild(titleSection);
    timeSection.appendChild(durationContent);
    timeSection.appendChild(endTimeContent);
    votingForm.appendChild(timeSection);
    votingForm.appendChild(permissionsSection);
    votingForm.appendChild(submitSection);

    if (votingSection) {
        votingSection.appendChild(emoteSetTitle);
        votingSection.appendChild(votingForm);
    } else {
        console.error('votingSection (#vote-creation) not found!');
    }

    durationTab.addEventListener('click', function() {
        durationContent.classList.remove('hidden');
        endTimeContent.classList.add('hidden');
        durationTab.classList.add('active');
        durationTab.classList.remove('inactive');
        endTimeTab.classList.add('inactive');
        endTimeTab.classList.remove('active');
        activeTimeTab = 'duration';
    });
    
    endTimeTab.addEventListener('click', function() {
        durationContent.classList.add('hidden');
        endTimeContent.classList.remove('hidden');
        durationTab.classList.add('inactive');
        durationTab.classList.remove('active');
        endTimeTab.classList.add('active');
        endTimeTab.classList.remove('inactive');
        activeTimeTab = 'endTime';
    });

    submitButton.addEventListener('click', async function() {
        event.preventDefault();
        console.log('specificUsersList before submission:', specificUsersList);
        const formData = {
            emoteSet: selectedEmoteSet, 
            emoteSetOwner: username,
            voteTitle: titleInput.value,
            activeTimeTab: activeTimeTab,
            duration: {
                days: durationDays.value, 
                hours: durationHours.value,
                minutes: durationMinutes.value
            },
            endTime: endTimeInput.value ? new Date(endTimeInput.value).toISOString() : null,
            permissions: permissionSelect.value,
            specific_users: permissionSelect.value === 'specific' ? specificUsersList : []
        }
        validateForm();
        console.log(formData);

        if(!submitButton.disabled) {
            try {
                const response = await fetch('/votes/create', {
                    method: 'POST',  // We're creating/sending data
                    headers: { 'Content-Type': 'application/json' },  // Tell server it's JSON
                    body: JSON.stringify(formData)  // Convert object to JSON string
                });

                const result = await response.json();
                console.log('Vote creation response: ', result)

                if (result.success) {
                    alert('Vote created successfully!');
                    await displayVotingEventById(result.vote_id);
                } else {
                    alert(`Error: ${result.message}`);
                }

            } catch (error) {
                console.error('Error creating vote:', error);
                alert('Failed to create vote. Please try again.')
            }
        }
    });

    //Error validations
    titleInput.addEventListener('blur', function() {
        if (titleInput.value.trim() === '') {
            titleError.classList.remove('hidden');
            titleError.textContent = 'Voting event needs a title';
        }
        else {
            titleError.classList.add('hidden');
        }
        validateForm();
    });

    function validateDuration() {
        if (activeTimeTab !== 'duration') return true;
    
        const totalMinutes = (parseInt(durationDays.value) * 24 * 60) + 
                            (parseInt(durationHours.value) * 60) + 
                            parseInt(durationMinutes.value);
        
        // If duration is 0, that's OK - user might just be changing title
        if (totalMinutes === 0) {
            durationError.classList.add('hidden');
            validateForm();
            return true;
        }
        
        // Must be at least 5 minutes from now
        if (totalMinutes < 5) {
            durationError.classList.remove('hidden');
            durationError.textContent = 'Duration must be at least 5 minutes from now';
            validateForm(); 
            return false;
        }
        
        // Check if duration exceeds 31 days (for CREATE form - no event.created_at needed)
        const maxMinutes = 31 * 24 * 60; // 31 days in minutes
        if (totalMinutes > maxMinutes) {
            durationError.classList.remove('hidden');
            durationError.textContent = 'Duration cannot be more than 31 days';
            validateForm();
            return false;
        }
        
        durationError.classList.add('hidden');
        validateForm();
        return true;
    }

    durationDays.addEventListener('input', function() {
        validateDuration();
        validateForm(); 
    });
    durationHours.addEventListener('input', function() {
        validateDuration();
        validateForm();
    });
    durationMinutes.addEventListener('input', function() {
        validateDuration();
        validateForm();
    });

    endTimeInput.addEventListener('input', validateForm);

    durationTab.addEventListener('click', validateDuration);
    durationTab.addEventListener('click', validateForm);

    function validateEndTime() {
        if (activeTimeTab !== 'endTime') return;

        const selectedDate = new Date(endTimeInput.value);
        const now = new Date();
        const diffMinutes = (selectedDate - now) / (1000 * 60);

        if (isNaN(selectedDate.getTime())) {
            endTimeError.classList.remove('hidden');
            endTimeError.textContent = 'Please select a valid date and time';
        } else if (diffMinutes < 5) {
            endTimeError.classList.remove('hidden');
            endTimeError.textContent = 'End time must be 5 minutes or more from now';
        } else if (diffMinutes > (31 * 24 * 60)) {
            endTimeError.classList.remove('hidden');
            endTimeError.textContent = 'End time cannot be more than 31 days from now';
        } else {
            endTimeError.classList.add('hidden');
        }
        validateForm();
    }

    endTimeInput.addEventListener('blur', validateEndTime);

    endTimeTab.addEventListener('click', validateEndTime);
    endTimeTab.addEventListener('click', validateForm);

    function validateForm() {
        const titleValid = titleInput.value.trim() !== '';
    
        let timeValid = false;
        if (activeTimeTab === 'duration') {
            const totalMinutes = (parseInt(durationDays.value) * 24 * 60) + 
                                (parseInt(durationHours.value) * 60) + 
                                parseInt(durationMinutes.value);
            timeValid = totalMinutes >= 5 && totalMinutes <= (31 * 24 * 60);
        } else if (activeTimeTab === 'endTime') {
            const selectedDate = new Date(endTimeInput.value);
            const now = new Date();
            const diffMinutes = (selectedDate - now) / (1000 * 60);
            timeValid = !isNaN(selectedDate.getTime()) && diffMinutes >= 5 && diffMinutes <= (31 * 24 * 60);
        }
        
        submitButton.disabled = !(titleValid && timeValid);
    }
}