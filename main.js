import { getUser, getEmoteSets, getEmoteImgUrl } from "./api.js";
import { displayEmoteSets } from "./emotedisplay.js";
import { displayVoteCreation } from "./displayVoteCreation.js";

console.log("JS is connected");

const usernameInput = document.querySelector('#username');
const fetchButton = document.querySelector('#fetch-emotes');
const voteCreationButton = document.querySelector('#create-vote-btn');
const availableVotesButton = document.querySelector('#available-votes-btn');
const profileButton = document.querySelector('#profile-btn');
const userLookUp = document.querySelector('#username-input-section');
const dashboard = document.querySelector('#dashboard');
const contentArea = document.querySelector('#content-area');
let currentEmoteSets = null;
let selectedEmoteSet = null;

function setCurrentEmoteSets(data) {
    currentEmoteSets = data;
}

function setSelectedEmoteSet(data) {
    selectedEmoteSet = data;
}

fetchButton.addEventListener('click', async function() {
    userLookUp.style.display = 'none';
    dashboard.style.display = 'block';
});

availableVotesButton.addEventListener('click', async function() {
    contentArea.innerHTML = '<h2>Vote list coming soon</h2>';
});

voteCreationButton.addEventListener('click', async function() {
    const username = usernameInput.value;
    console.log('Username:', username);
    contentArea.innerHTML = '';

    // Create the emote-set-list div inside content area
    const emoteSetList = document.createElement('div');
    emoteSetList.id = 'emote-set-list';
    contentArea.appendChild(emoteSetList);

    // Create the vote-creation div inside content area  
    const voteCreation = document.createElement('div');
    voteCreation.id = 'vote-creation';
    voteCreation.style.display = 'none';
    contentArea.appendChild(voteCreation);
    
    try {
        const emoteSets = await getEmoteSets(username);
        console.log('Emote sets:', emoteSets);
        displayEmoteSets(emoteSets, displayVoteCreation, setCurrentEmoteSets, setSelectedEmoteSet);
    } catch (error) {
        console.error('Error:', error);
    }
});

profileButton.addEventListener('click', async function() {
    contentArea.innerHTML = '<h2>Profile/settings coming soon</h2>';
})
