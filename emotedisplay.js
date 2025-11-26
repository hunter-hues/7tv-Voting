import { getEmoteImgUrl } from "./api.js";

export function displayEmoteSets(emoteSetsData, displayVoteCreation, setCurrentEmoteSets, setSelectedEmoteSet, username) {
    setCurrentEmoteSets(emoteSetsData);
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
                setSelectedEmoteSet(emoteSet);
                
                const moderatorSection = document.getElementById('moderator-emote-sets');
                if (moderatorSection) {
                    moderatorSection.style.display = 'none';
                }
                const backButton = document.getElementById('mod-back-button');
                if (backButton) {
                    backButton.style.display = 'none';
                }
                
                displayVoteCreation(emoteSet, username);
            });
        }
        container.appendChild(parentDiv);
    }
}