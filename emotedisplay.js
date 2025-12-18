import { getEmoteImgUrl } from "./api.js";

export function displayEmoteSets(emoteSetsData, displayVoteCreation, setCurrentEmoteSets, setSelectedEmoteSet, username) {
    setCurrentEmoteSets(emoteSetsData);
    const container = document.querySelector('#emote-set-list');
    container.innerHTML = '';
    for(let emoteSet of emoteSetsData.emote_sets) {
        const parentDiv = document.createElement('button');
        parentDiv.className = 'emote-set glass-card';
        const setName = document.createElement('h3');
        setName.textContent = emoteSet.name
        parentDiv.appendChild(setName)
        
        if (emoteSet.preview_emotes.length === 0) {
            parentDiv.disabled = true;
            const noEmotesMsg = document.createElement('p');
            noEmotesMsg.textContent = 'No emotes';
            parentDiv.appendChild(noEmotesMsg);
        } else {
            const previewContainer = document.createElement('div');
            previewContainer.className = 'preview-emotes';
            for(let emote of emoteSet.preview_emotes) {
                const emotePreviewImg = document.createElement('img');
                emotePreviewImg.className = 'emote';
                emotePreviewImg.src = getEmoteImgUrl(emote.id, 2);
                previewContainer.appendChild(emotePreviewImg);
            }
            parentDiv.appendChild(previewContainer);
            parentDiv.addEventListener('click', function() {
                console.log('Clicked emote set:', emoteSet.name);
                setSelectedEmoteSet(emoteSet);
                
                const moderatorSection = document.getElementById('moderator-emote-sets');
                if (moderatorSection) {
                    moderatorSection.classList.add('hidden');
                }
                const backButton = document.getElementById('mod-back-button');
                if (backButton) {
                    backButton.classList.add('hidden');
                }
                
                displayVoteCreation(emoteSet, username);
            });
        }
        container.appendChild(parentDiv);
    }
}