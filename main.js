console.log("JS is connected");

const usernameInput = document.querySelector('#username');
const fetchButton = document.querySelector('#fetch-emotes');
let currentEmoteSets = null;
let selectedEmoteSet = null;

async function getUser(username) {
    try {
        const response = await fetch(`/users/${username}`);
        if(!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch(error) {
        console.error('Error:', error)
    }
}

async function getEmoteSets(username) {
    try {
        const userData = await getUser(username);
        const userId = userData.id;

        const emoteSetsData = await fetch(`/emotes/emote_sets/${userId}`);
        if (!emoteSetsData.ok) {
            throw new Error(`HTTP error! status: ${emoteSetsData.status}`);
        }
        const emoteSets = await emoteSetsData.json();
        return emoteSets;
    } catch (error) {
        console.error('Error in getEmoteSets:', error);
        throw error; // Re-throw so the event listener can catch it
    }
}

fetchButton.addEventListener('click', async function(event) {
    const username = usernameInput.value;
    console.log('Username:', username);
    
    try {
        const emoteSets = await getEmoteSets(username);
        console.log('Emote sets:', emoteSets);
        displayEmoteSets(emoteSets);
    } catch (error) {
        console.error('Error:', error);
    }
});

function getEmoteImgUrl(id, size) {
    return `https://cdn.7tv.app/emote/${id}/${size}x`;
}

function displayEmoteSets(emoteSetsData) {
    currentEmoteSets = emoteSetsData;
    const container = document.querySelector('#emote-set-list');
    container.innerHTML = '';
    for(let emoteSet of emoteSetsData.emote_sets) {
        const parentDiv = document.createElement('button');
        const setName = document.createElement('h3');
        setName.textContent = emoteSet.name
        parentDiv.appendChild(setName)
        
        if (emoteSet.preview_emotes.length === 0) {
            parentDiv.disabled = true;
            const noEmotesMsg = document.createElement('p');
            noEmotesMsg.textContent = 'No emotes';
            parentDiv.appendChild(noEmotesMsg);
        } else {
            for(let emote of emoteSet.preview_emotes) {
                const emotePreviewImg = document.createElement('img');
                emotePreviewImg.src = getEmoteImgUrl(emote.id, 2);
                parentDiv.appendChild(emotePreviewImg);
            }
            parentDiv.addEventListener('click', function() {
                console.log('Clicked emote set:', emoteSet.name);
                selectedEmoteSet = emoteSet;
            });
        }
        container.appendChild(parentDiv);
    }
}