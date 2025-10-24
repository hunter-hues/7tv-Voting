import { displayVotingEventById } from "./votingInterface.js";

export function displayVoteCreation(selectedEmoteSet, username) {
    let activeTimeTab = 'duration';
    
    const emoteSetDisplay = document.querySelector('#emote-set-list');
    const votingSection = document.querySelector('#vote-creation')
    emoteSetDisplay.style.display = 'none';
    votingSection.style.display = 'block';
    votingSection.innerHTML = '';

    const votingForm = document.createElement('form');

    //Title Section
    const titleSection = document.createElement('div');
    titleSection.className = 'form-section';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Vote Title';

    const titleError = document.createElement('div');
    titleError.className = 'error-message';
    titleError.style.color = 'red';
    titleError.style.display = 'none';

    //Time Section
    const timeSection = document.createElement('div');
    timeSection.className = 'form-section';
    const durationTab = document.createElement('button');
    durationTab.textContent = 'Duration';
    durationTab.type = 'button';
    const endTimeTab = document.createElement('button');
    endTimeTab.textContent = 'End Time';
    endTimeTab.type = 'button';

    //Duration Content
    const durationContent = document.createElement('div');
    durationContent.className = 'time-tabs';

    const durationError = document.createElement('div');
    durationError.className = 'error-message';
    durationError.style.color = 'red';
    durationError.style.display = 'none';
    
    //Days Input
    const daysLabel = document.createElement('label');
    daysLabel.textContent = 'Days';
    const durationDays = document.createElement('input');
    durationDays.type = 'number';
    durationDays.value = '0';
    durationDays.min = '0';
    durationDays.max = '7';
    durationDays.placeholder = '0';
    //Hours Input
    const hoursLabel = document.createElement('label');
    hoursLabel.textContent = 'Hours';
    const durationHours = document.createElement('input');
    durationHours.type = 'number';
    durationHours.value = '0';
    durationHours.min = '0';
    durationHours.max = '24';
    durationHours.placeholder = '0'; 
    //Minutes Input
    const minutesLabel = document.createElement('label');
    minutesLabel.textContent = 'Minutes';
    const durationMinutes = document.createElement('input');
    durationMinutes.type = 'number';
    durationMinutes.value = '0';
    durationMinutes.min = '0';
    durationMinutes.max = '59';
    durationMinutes.placeholder = '0';

    //End Time
    const endTimeContent = document.createElement('div');
    endTimeContent.className = 'time-tabs';
    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'datetime-local';
    endTimeInput.min = new Date().toISOString().slice(0, 16); // Set minimum to current time
    endTimeContent.style.display = 'none';

    const endTimeError = document.createElement('div');
    endTimeError.className = 'error-message';
    endTimeError.style.color = 'red';
    endTimeError.style.display = 'none';
    

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
    specificUsersSection.className = 'form-section';
    specificUsersSection.style.display = 'none';
    specificUsersSection.id = 'specific-users-section';

    // Username input
    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Enter Twitch username';
    usernameInput.id = 'username-input';

    // Add user button
    const addUserButton = document.createElement('button');
    addUserButton.type = 'button';
    addUserButton.textContent = 'Add User';
    addUserButton.id = 'add-user-btn';

    // Users list display
    const usersList = document.createElement('div');
    usersList.id = 'users-list';
    usersList.style.marginTop = '10px';

    specificUsersSection.appendChild(usernameInput);
    specificUsersSection.appendChild(addUserButton);
    specificUsersSection.appendChild(usersList);

    // Show/hide specific users section based on permission selection
    permissionSelect.addEventListener('change', function() {
        if (permissionSelect.value === 'specific') {
            specificUsersSection.style.display = 'block';
        } else {
            specificUsersSection.style.display = 'none';
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
            userDiv.style.display = 'flex';
            userDiv.style.justifyContent = 'space-between';
            userDiv.style.marginBottom = '5px';
            
            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = username;
            
            const removeButton = document.createElement('button');
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
    timeSection.appendChild(durationTab);
    durationContent.appendChild(durationDays);
    durationContent.appendChild(daysLabel);
    durationContent.appendChild(durationHours);
    durationContent.appendChild(hoursLabel);
    durationContent.appendChild(durationMinutes);
    durationContent.appendChild(minutesLabel);
    timeSection.appendChild(endTimeTab);
    endTimeContent.appendChild(endTimeInput);
    permissionsSection.appendChild(permissionSelect);
    permissionsSection.appendChild(specificUsersSection); 
    submitSection.appendChild(submitButton);

    //Add error displays
    titleSection.appendChild(titleError);
    durationContent.appendChild(durationError);
    endTimeContent.appendChild(endTimeError);

    // Add sections to form
    votingForm.appendChild(titleSection);
    timeSection.appendChild(durationContent);
    timeSection.appendChild(endTimeContent);
    votingForm.appendChild(timeSection);
    votingForm.appendChild(permissionsSection);
    votingForm.appendChild(submitSection);

    votingSection.appendChild(votingForm);

    durationTab.addEventListener('click', function() {
        durationContent.style.display = 'block';
        endTimeContent.style.display = 'none';
        activeTimeTab = 'duration';
    });
    
    endTimeTab.addEventListener('click', function() {
        durationContent.style.display = 'none';
        endTimeContent.style.display = 'block';
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
                    displayVotingEventById(result.vote_id);
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
            titleError.style.display = 'block';
            titleError.textContent = 'Voting event needs a title';
        }
        else {
            titleError.style.display = 'none';
        }
        validateForm();
    });

    function validateDuration() {
        if (activeTimeTab !== 'duration') return;

        const totalMinutes = (parseInt(durationDays.value) * 24 * 60) + (parseInt(durationHours.value) * 60) + (parseInt(durationMinutes.value));
        if (totalMinutes === 0) {
            durationError.style.display = 'block';
            durationError.textContent = 'Duration cannot be empty';
        } else if (totalMinutes < 5) {
            durationError.style.display = 'block';
            durationError.textContent = 'Minimum 5 minutes required';
        } else if (totalMinutes > (31 * 24 * 60)) {
            durationError.style.display = 'block';
            durationError.textContent = 'Maximum 31 days allowed';
        } else {
            durationError.style.display = 'none';
        }
        validateForm();
    }

    durationDays.addEventListener('blur', validateDuration);
    durationHours.addEventListener('blur', validateDuration);
    durationMinutes.addEventListener('blur', validateDuration);

    durationTab.addEventListener('click', validateDuration);
    durationTab.addEventListener('click', validateForm);

    function validateEndTime() {
        if (activeTimeTab !== 'endTime') return;

        const selectedDate = new Date(endTimeInput.value);
        const now = new Date();
        const diffMinutes = (selectedDate - now) / (1000 * 60);

        if (isNaN(selectedDate.getTime())) {
            endTimeError.style.display = 'block';
            endTimeError.textContent = 'Please select a valid date and time';
        } else if (diffMinutes < 5) {
            endTimeError.style.display = 'block';
            endTimeError.textContent = 'End time must be 5 minutes or more from now';
        } else if (diffMinutes > (31 * 24 * 60)) {
            endTimeError.style.display = 'block';
            endTimeError.textContent = 'End time cannot be more than 31 days from now';
        } else {
            endTimeError.style.display = 'none';
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