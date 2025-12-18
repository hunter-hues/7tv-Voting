import { getUser, getEmoteSets, getEmoteImgUrl } from "./api.js";
import { displayEmoteSets } from "./emotedisplay.js";
import { displayVoteCreation } from "./displayVoteCreation.js";
import { displayVotingEvents, cleanupTimers } from "./votingInterface.js";
import { displayProfile } from "./profileManager.js";

console.log("JS is connected");

// Helper functions (don't need DOM, can stay outside)
function setCurrentEmoteSets(data) {
    currentEmoteSets = data;
}

function setSelectedEmoteSet(data) {
    selectedEmoteSet = data;
}

// Import user cache
import { getCachedUser, clearUserCache } from './userCache.js';

// Module-level variables for helper functions
let currentEmoteSets = null;
let selectedEmoteSet = null;

// Wait for DOM to be fully loaded before accessing elements
document.addEventListener('DOMContentLoaded', () => {
    // Now safe to query DOM elements
    const usernameInput = document.querySelector('#username');
    const loginButton = document.querySelector('#login-with-twitch-btn');
    const voteCreationButton = document.querySelector('#create-vote-btn');
    const availableVotesButton = document.querySelector('#available-votes-btn');
    const profileButton = document.querySelector('#profile-btn');
    const homeButton = document.querySelector('#home-btn');
    const twitchLogin = document.querySelector('#login-with-twitch-section');
    const dashboard = document.querySelector('#dashboard');
    const contentArea = document.querySelector('#content-area');

    // Store the initial landing page content
    const initialContent = contentArea.innerHTML;

    // Set home button as active by default on page load
    homeButton.classList.add('active');

    // Define checkAuth inside DOMContentLoaded so it has access to twitchLogin and dashboard
    async function checkAuth(){
        const data = await getCachedUser();
        const isAuthenticated = data && (data.authenticated === true || data.authenticated === 'true');
        
        const loginOverlay = document.getElementById('login-overlay');
        
        if (isAuthenticated) {
            // Hide login popup when authenticated
            if (loginOverlay) loginOverlay.classList.add('hidden');
        } else {
            // Show login popup when not authenticated
            // Dashboard stays visible and functional
            if (loginOverlay) loginOverlay.classList.remove('hidden');
        }
    }

    // Call checkAuth after everything is set up
    checkAuth();

    // Event listeners
    loginButton.addEventListener('click', async function() {
        window.location.href = '/auth/login'
    });

    availableVotesButton.addEventListener('click', async function() {
        // Update active nav button
        homeButton.classList.remove('active');
        profileButton.classList.remove('active');
        availableVotesButton.classList.add('active');
        voteCreationButton.classList.remove('active');
        
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
        // Update active nav button
        homeButton.classList.remove('active');
        profileButton.classList.remove('active');
        availableVotesButton.classList.remove('active');
        voteCreationButton.classList.add('active');
        
        const data = await getCachedUser();

        if (data.authenticated) {
            const username = data.user.login;
            const sevenTV_id = data.user.sevenTV_id;
            console.log('Username:', username);
            
            contentArea.innerHTML = '';
            
            const personalEmotesTitle = document.createElement('h3');
            personalEmotesTitle.className = 'section-title';
            personalEmotesTitle.textContent = 'Your emote sets';
            contentArea.appendChild(personalEmotesTitle);

            const emoteSetList = document.createElement('div');
            emoteSetList.id = 'emote-set-list';
            contentArea.appendChild(emoteSetList);
            
            const voteCreation = document.createElement('div');
            voteCreation.id = 'vote-creation';
            voteCreation.className = 'hidden';
            contentArea.appendChild(voteCreation);
            let emoteSets = [];
            try {
                // CHANGE: Check if sevenTV_id exists and is valid
                if (sevenTV_id && !sevenTV_id.startsWith('no_account_')) {
                    emoteSets = await getEmoteSets(sevenTV_id);  // CHANGE: username → sevenTV_id
                } else {
                    emoteSets = null;  // No 7TV account
                }
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
                    channelButton.className = 'channel-button glass-card';
                    channelButton.textContent = modList.mod_channels[i].channel_username;
                    channelButton.dataset.channelData = JSON.stringify(modList.mod_channels[i]);
                    modListSection.appendChild(channelButton);

                    channelButton.addEventListener('click', function() {
                        const channelData = JSON.parse(channelButton.dataset.channelData);
                        
                        modListSection.classList.add('hidden');
                        
                        moderatorChannelsTitle.textContent = `${channelData.channel_username}'s emote sets`;
                        
                        const emoteSetContainer = document.createElement('div');
                        emoteSetContainer.id = 'mod-emote-sets-display';
                        moderatorSection.appendChild(emoteSetContainer);
                        
                        const backButton = document.createElement('button');
                        backButton.className = 'glass-button'
                        backButton.textContent = '← Back to channels';
                        backButton.id = 'mod-back-button';
                        moderatorSection.appendChild(backButton);

                        backButton.addEventListener('click', function() {
                            emoteSetContainer.remove();
                            backButton.remove(); 
                            modListSection.classList.remove('hidden');
                            moderatorChannelsTitle.textContent = 'Channels you moderate for';
                        });
                        
                        for (let j = 0; j < channelData.emote_sets.length; j++) {
                            const modEmoteSetButton = document.createElement('button');  
                            emoteSetContainer.appendChild(modEmoteSetButton);  

                            const modEmoteButtonName = document.createElement('h3');
                            modEmoteButtonName.textContent = channelData.emote_sets[j]['name'];
                            modEmoteSetButton.appendChild(modEmoteButtonName);
                            modEmoteSetButton.className = 'glass-card emote-set-button'
                        
                            for(let emote of channelData.emote_sets[j]['preview_emotes']) {  
                                const emotePreviewImg = document.createElement('img');
                                emotePreviewImg.className = "emote-preview";
                                emotePreviewImg.src = getEmoteImgUrl(emote.id, 2);
                                modEmoteSetButton.appendChild(emotePreviewImg);
                            }
                            modEmoteSetButton.addEventListener('click', function() {
                                const emoteSet = channelData.emote_sets[j];  
                                console.log('Clicked emote set:', emoteSet.name);
                                setSelectedEmoteSet(emoteSet);
                                displayVoteCreation(emoteSet, channelData.channel_username);
                                moderatorSection.classList.add('hidden');
                                personalEmotesTitle.classList.add('hidden');
                                backButton.classList.add('hidden');
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
        // Update active nav button
        homeButton.classList.remove('active');
        profileButton.classList.add('active');
        availableVotesButton.classList.remove('active');
        voteCreationButton.classList.remove('active');
        
        displayProfile();
    });


    homeButton.addEventListener('click', function() {
        // Update active nav button
        homeButton.classList.add('active');
        profileButton.classList.remove('active');
        availableVotesButton.classList.remove('active');
        voteCreationButton.classList.remove('active');
        
        // Clear any timers from voting events
        cleanupTimers();
        
        // Restore the original landing page content
        contentArea.innerHTML = initialContent;
    });
});