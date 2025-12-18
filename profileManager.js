// Export the main function
export async function displayProfile() {
    const contentArea = document.querySelector('#content-area');
    contentArea.innerHTML = '';
    
    // Profile container
    const profileContainer = document.createElement('div');
    profileContainer.id = 'profile-container';
    
    // Profile title
    const profileTitle = document.createElement('h2');
    profileTitle.className = 'profile-title';
    profileTitle.textContent = 'Profile';
    
    // Manage Moderators Section (Glass Card)
    const manageModeratorsCard = document.createElement('div');
    manageModeratorsCard.className = 'glass-card profile-section';
    
    const manageModeratorsTitle = document.createElement('h3');
    manageModeratorsTitle.className = 'profile-section-title';
    manageModeratorsTitle.textContent = 'Manage Moderators';
    
    const modInputSection = document.createElement('div');
    modInputSection.className = 'profile-input-group';
    
    const modUsernameInput = document.createElement('input');
    modUsernameInput.type = 'text';
    modUsernameInput.id = 'mod-username-input';
    modUsernameInput.className = 'form-input';
    modUsernameInput.placeholder = 'Enter Twitch username';
    
    const addModButton = document.createElement('button');
    addModButton.id = 'add-mod-button';
    addModButton.className = 'glass-button';
    addModButton.textContent = 'Add Mod';
    
    modInputSection.appendChild(modUsernameInput);
    modInputSection.appendChild(addModButton);
    
    const modList = document.createElement('div');
    modList.id = 'mod-list';
    modList.className = 'profile-list';
    
    manageModeratorsCard.appendChild(manageModeratorsTitle);
    manageModeratorsCard.appendChild(modInputSection);
    manageModeratorsCard.appendChild(modList);
    
    // Channels You Moderate Section (Glass Card)
    const modForCard = document.createElement('div');
    modForCard.className = 'glass-card profile-section';
    
    const modForTitle = document.createElement('h3');
    modForTitle.className = 'profile-section-title';
    modForTitle.textContent = 'Channels You Moderate';
    
    const modForList = document.createElement('div');
    modForList.id = 'mod-for-list';
    modForList.className = 'profile-list';
    
    modForCard.appendChild(modForTitle);
    modForCard.appendChild(modForList);
    
    // Logout button section
    const logoutSection = document.createElement('div');
    logoutSection.className = 'profile-logout-section';
    
    const logoutButton = document.createElement('button');
    logoutButton.id = 'logout-button';
    logoutButton.className = 'glass-button logout-button';
    logoutButton.textContent = 'Logout';
    
    logoutSection.appendChild(logoutButton);
    
    // Append all sections to profile container
    profileContainer.appendChild(profileTitle);
    profileContainer.appendChild(manageModeratorsCard);
    profileContainer.appendChild(modForCard);
    profileContainer.appendChild(logoutSection);
    
    // Append to content area
    contentArea.appendChild(profileContainer);
    
    await loadModList();
    await loadModForList();
}

document.addEventListener('click', async function(event) {
    if (event.target.id === 'logout-button') {
        try {
            const response = await fetch('/auth/logout');
            if (response.ok) {
                // Reload the page to reset everything
                window.location.reload();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
});

document.addEventListener('click', async function(event) {
    if (event.target.id === 'add-mod-button') {
        const input = document.querySelector('#mod-username-input');
        const username = input.value.trim();
        
        if (username) { 
            const success = await addMod(username);
            if (success) {
                input.value = '';  
            }
        }
    }
});



// Helper function to load/refresh the mod list
async function loadModList() {
    const response = await fetch('/mods/list', {
        credentials: 'include'
    });
    const data = await response.json();
    
    const modListContainer = document.querySelector('#mod-list');
    modListContainer.innerHTML = '';
    
    // Check if there are any mods
    if (!data.moderators || data.moderators.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'profile-empty-message';
        emptyMessage.textContent = 'No moderators yet';
        modListContainer.appendChild(emptyMessage);
        return;
    }
    
    // Loop through each mod
    for (const modUsername of data.moderators) {
        // Create container div for this mod
        const modDiv = document.createElement('div');
        modDiv.className = 'profile-list-item';
        
        // Add the username text
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'profile-username';
        usernameSpan.textContent = modUsername;
        modDiv.appendChild(usernameSpan);
        
        // Create remove button
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.className = 'remove-user-button';
        removeButton.setAttribute('data-username', modUsername);
        
        // Add click listener
        removeButton.addEventListener('click', async () => {
            await removeMod(modUsername);
        });
        
        // Append button to div, div to container
        modDiv.appendChild(removeButton);
        modListContainer.appendChild(modDiv);
    }
}

async function loadModForList() {
    const response = await fetch('/auth/me', {
        credentials: 'include' 
    });
    const data = await response.json();
    
    const modForContainer = document.querySelector('#mod-for-list');
    modForContainer.innerHTML = '';
    
    // Check if authenticated and has can_create_votes_for data
    if (!data.authenticated || !data.user.can_create_votes_for || data.user.can_create_votes_for.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'profile-empty-message';
        emptyMessage.textContent = 'You are not a moderator for any channels';
        modForContainer.appendChild(emptyMessage);
        return;
    }
    
    // Display each channel
    for (const channelUsername of data.user.can_create_votes_for) {
        const channelDiv = document.createElement('div');
        channelDiv.className = 'profile-list-item channel-item';
        channelDiv.textContent = channelUsername;
        modForContainer.appendChild(channelDiv);
    }
}

// Helper function to add a mod
async function addMod(username) {
    try {
        const response = await fetch('/mods/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username }),
            credentials: 'include'  // ← Add this
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Success! Refresh the list
            await loadModList();
            console.log(data.message);
            return true;
        } else {
            // Failed - show error
            console.error(data.message);
            return false;
        }
    } catch (error) {
        // Network error or other exception
        console.error('Error adding mod:', error);
        return false;
    }
}

// Helper function to remove a mod
async function removeMod(username) {
    try {
        const response = await fetch('/mods/remove', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username }),
            credentials: 'include'  // ← Add this
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Success! Refresh the list
            await loadModList();
            console.log(data.message);
            return true;
        } else {
            // Failed - show error
            console.error(data.message);
            return false;
        }
    } catch (error) {
        // Network error or other exception
        console.error('Error removing mod:', error);
        return false;
    }
}