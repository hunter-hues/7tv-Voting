// Export the main function
export async function displayProfile() {
    // 1. Get content area
    // 2. Set up HTML structure
    // 3. Call loadModList()
    // 4. Set up event listeners for add/remove
    const contentArea = document.querySelector('#content-area');
    
    contentArea.innerHTML = `
        <h2>Profile</h2>
        
        <h3>Manage Moderators</h3>
        <input type="text" id="mod-username-input" placeholder="Enter Twitch username">
        <button id="add-mod-button">Add Mod</button>
        <div id="mod-list"></div>
        
        <h3>Channels You Moderate</h3>
        <div id="mod-for-list"></div>
        
        <button id="logout-button">Logout</button>
    `;
    
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
        modListContainer.innerHTML = '<p>No moderators yet</p>';
        return;
    }
    
    // Loop through each mod
    for (const modUsername of data.moderators) {
        // Create container div for this mod
        const modDiv = document.createElement('div');
        
        // Add the username text
        const usernameText = document.createTextNode(modUsername + ' ');
        modDiv.appendChild(usernameText);
        
        // Create remove button
        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.classList.add('remove-mod-btn');
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
        modForContainer.innerHTML = '<p>You are not a moderator for any channels</p>';
        return;
    }
    
    // Display each channel
    for (const channelUsername of data.user.can_create_votes_for) {
        const channelDiv = document.createElement('div');
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