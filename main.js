import { getUser, getEmoteSets, getEmoteImgUrl } from "./api.js";
import { displayEmoteSets } from "./emotedisplay.js";
import { displayVoteCreation } from "./displayVoteCreation.js";
import { displayVotingEvents } from "./votingInterface.js";

console.log("JS is connected");
checkAuth();

const usernameInput = document.querySelector('#username');
const loginButton = document.querySelector('#login-with-twitch-btn');
const voteCreationButton = document.querySelector('#create-vote-btn');
const availableVotesButton = document.querySelector('#available-votes-btn');
const profileButton = document.querySelector('#profile-btn');
const twitchLogin = document.querySelector('#login-with-twitch-section');
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

async function checkAuth(){
    const response = await fetch('/auth/me');
    const data = await response.json();
    console.log(data);
    if (data['authenticated'] == true) {
        twitchLogin.style.display = 'none';
        dashboard.style.display = 'block';
    } else{
        dashboard.style.display = 'none';
        twitchLogin.style.display = 'block';
    }
}

loginButton.addEventListener('click', async function() {
    window.location.href = '/auth/login'
});

availableVotesButton.addEventListener('click', async function() {
    try {
        const response = await fetch('/votes/voting-events');
        const data = await response.json();
        
        if (data.success) {
            displayVotingEvents(data.active_events, data.expired_events);
        } else {
            contentArea.innerHTML = '<p>Error loading voting events</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        contentArea.innerHTML = '<p>Failed to load voting events</p>';
    }
});

voteCreationButton.addEventListener('click', async function() {
    const response = await fetch('/auth/me');
    const data = await response.json();

    if (data.authenticated) {
        const username = data.user.login;
        console.log('Username:', username);
        
        // ALL your current logic goes here:
        contentArea.innerHTML = '';
        
        const emoteSetList = document.createElement('div');
        emoteSetList.id = 'emote-set-list';
        contentArea.appendChild(emoteSetList);
        
        const voteCreation = document.createElement('div');
        voteCreation.id = 'vote-creation';
        voteCreation.style.display = 'none';
        contentArea.appendChild(voteCreation);
        
        try {
            const emoteSets = await getEmoteSets(username);
            console.log('Emote sets:', emoteSets);
            displayEmoteSets(emoteSets, displayVoteCreation, setCurrentEmoteSets, setSelectedEmoteSet, username);
        } catch (error) {
            console.error('Error:', error);
        }
        
    } else {
        // Handle not authenticated case
        contentArea.innerHTML = '<p>Please log in to create votes</p>';
    }
});

profileButton.addEventListener('click', async function() {
    contentArea.innerHTML = `
        <h2>Profile</h2>
        <button id="logout-button">Logout</button>
    `;
})

// Add this after the profileButton event listener
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
