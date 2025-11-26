import { getUser, getEmoteSets, getEmoteImgUrl } from "./api.js";
import { displayEmoteSets } from "./emotedisplay.js";
import { displayVoteCreation } from "./displayVoteCreation.js";
import { displayVotingEvents } from "./votingInterface.js";
import { displayProfile } from "./profileManager.js";

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
        
        contentArea.innerHTML = '';
        
        const personalEmotesTitle = document.createElement('h3');
        personalEmotesTitle.textContent = 'Your emote sets';
        contentArea.appendChild(personalEmotesTitle);

        const emoteSetList = document.createElement('div');
        emoteSetList.id = 'emote-set-list';
        contentArea.appendChild(emoteSetList);
        
        const voteCreation = document.createElement('div');
        voteCreation.id = 'vote-creation';
        voteCreation.style.display = 'none';
        contentArea.appendChild(voteCreation);
        let emoteSets = [];
        try {
            emoteSets = await getEmoteSets(username);
            console.log('Emote sets:', emoteSets);
        } catch (error) {
            console.error('Error:', error);
            emoteSets = null;
        }
        
        if (emoteSets && emoteSets.emote_sets && emoteSets.emote_sets.length) {
            displayEmoteSets(emoteSets, displayVoteCreation, setCurrentEmoteSets, setSelectedEmoteSet, username);
        }

        else {
            const errorEmoteSets = document.createElement('p');
            errorEmoteSets.textContent = 'No 7tv account found, no emote sets to choose'
            emoteSetList.appendChild(errorEmoteSets);
        }

        const moderatorSection = document.createElement('div');
        moderatorSection.id = 'moderator-emote-sets';
        contentArea.appendChild(moderatorSection);

        let modList = [];
        try {
            const modResponse = await fetch('/emotes/mod-list', {credentials: 'include'})
            modList = await modResponse.json();
        } catch (error) {
            console.error('Error:', error);
            modList = null;
        }

        const moderatorChannelsTitle = document.createElement('h3');
        moderatorChannelsTitle.textContent = 'Channels you moderate for';

        const modListSection = document.createElement('div');
        modListSection.id = 'moderator-lists-section';

        // Only append and populate if there are actually mod channels
        if (modList && modList.success && modList.mod_channels && modList.mod_channels.length > 0) {
            moderatorSection.appendChild(moderatorChannelsTitle);
            moderatorSection.appendChild(modListSection);
            
            for (let i = 0; i < modList.mod_channels.length; i++) {
                const channelButton = document.createElement('button');
                channelButton.classList = 'channel-button';
                channelButton.textContent = modList.mod_channels[i].channel_username;
                channelButton.dataset.channelData = JSON.stringify(modList.mod_channels[i]);
                modListSection.appendChild(channelButton);

                channelButton.addEventListener('click', function() {
                    const channelData = JSON.parse(channelButton.dataset.channelData);
                    
                    modListSection.style.display = 'none';
                    
                    moderatorChannelsTitle.textContent = `${channelData.channel_username}'s emote sets`;
                    
                    const emoteSetContainer = document.createElement('div');
                    emoteSetContainer.id = 'mod-emote-sets-display';
                    moderatorSection.appendChild(emoteSetContainer);
                    
                    const backButton = document.createElement('button');
                    backButton.textContent = '← Back to channels';
                    backButton.id = 'mod-back-button';
                    moderatorSection.appendChild(backButton);

                    backButton.addEventListener('click', function() {
                        emoteSetContainer.remove();
                        backButton.remove(); 
                        modListSection.style.display = 'block';
                        moderatorChannelsTitle.textContent = 'Channels you moderate for';
                    });
                    
                    for (let j = 0; j < channelData.emote_sets.length; j++) {
                        const modEmoteSetButton = document.createElement('button');  
                        emoteSetContainer.appendChild(modEmoteSetButton);  

                        const modEmoteButtonName = document.createElement('h3');
                        modEmoteButtonName.textContent = channelData.emote_sets[j]['name'];
                        modEmoteSetButton.appendChild(modEmoteButtonName);
                    
                        for(let emote of channelData.emote_sets[j]['preview_emotes']) {  
                            const emotePreviewImg = document.createElement('img');
                            emotePreviewImg.src = getEmoteImgUrl(emote.id, 2);
                            modEmoteSetButton.appendChild(emotePreviewImg);
                        }
                        modEmoteSetButton.addEventListener('click', function() {
                            const emoteSet = channelData.emote_sets[j];  
                            console.log('Clicked emote set:', emoteSet.name);
                            setSelectedEmoteSet(emoteSet);
                            displayVoteCreation(emoteSet, channelData.channel_username);
                            moderatorSection.style.display = 'none';
                            personalEmotesTitle.style.display = 'none';
                            backButton.style.display = 'none';
                        });
                    }
                    
                });
            }
        }
        
    } else {
        // Handle not authenticated case
        contentArea.innerHTML = '<p>Please log in to create votes</p>';
    }
});

profileButton.addEventListener('click', async function() {
    displayProfile();
});

