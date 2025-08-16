import { getUser, getEmoteSets, getEmoteImgUrl } from "./api.js";
import { displayEmoteSets } from "./emotedisplay.js";
import { displayVoteCreation } from "./displayVoteCreation.js";

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
    contentArea.innerHTML = '<h2>Vote list coming soon</h2>';
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
    contentArea.innerHTML = '<h2>Profile/settings coming soon</h2>';
})
