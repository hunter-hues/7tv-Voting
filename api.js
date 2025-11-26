console.log("api.js loaded successfully");

export async function getUser(username) {
    try {
        const response = await fetch(`/users/${username}`);
        if(!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch(error) {
        console.error('Error fetching user:', error);
        return null; // Return null instead of undefined
    }
}

export async function getEmoteSets(sevenTV_id) {  
    try {
        const emoteSetsData = await fetch(`/emotes/emote_sets/${sevenTV_id}`);  
        if (!emoteSetsData.ok) {
            throw new Error(`HTTP error! status: ${emoteSetsData.status}`);
        }
        const emoteSets = await emoteSetsData.json();
        return emoteSets;
    } catch (error) {
        console.error('Error in getEmoteSets:', error);
        throw error;
    }
}

export async function getEmotesFromSet(emoteSetId) {
    try {
        const emoteSetData = await fetch(`/emotes/set/${emoteSetId}/emotes`);
        if (!emoteSetData.ok) {
            throw new Error(`HTTP error! status: ${emoteSetData.status}`);
        }
        const emotes = await emoteSetData.json();
        return emotes;
    } catch (error) {
        console.error ('Error in getEmotesFromSet', error);
        throw error;
    }
}

export function getEmoteImgUrl(id, size) {
    return `https://cdn.7tv.app/emote/${id}/${size}x`;
}

export async function createNeutralVote(votingEventId, emoteId) {
    try {
        const checkResponse = await fetch(`/votes/check?voting_event_id=${votingEventId}&emote_id=${emoteId}`);
        const checkResult = await checkResponse.json();
        
        if (checkResult.vote_exists) {
            console.log(`Vote already exists for emote ${emoteId}:`, checkResult.current_vote);
            return; 
        }
        
        const response = await fetch('/votes/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                voting_event_id: votingEventId,
                emote_id: emoteId,
                vote_choice: 'neutral'
            })
        });
        
        const result = await response.json();
        if (!result.success) {
            console.log('Neutral vote creation result:', result.message);
        }
    } catch (error) {
        console.error('Error creating neutral vote:', error);
    }
}

export async function createNeutralVotesInBackground(votingEventId, emotes) {
    console.log(`Creating neutral votes for ${emotes.length} emotes in background...`);
    
    // Process in background without blocking UI
    for (const emote of emotes) {
        createNeutralVote(votingEventId, emote.id); // No await!
    }
    
    console.log('Background neutral vote creation started');
        // After all neutral votes are created, refresh the UI
        setTimeout(async () => {
            try {
                const updatedVoteData = await getVoteCounts(votingEventId);
                // Update all neutral buttons to show as active
                document.querySelectorAll('.vote-neutral').forEach(button => {
                    button.classList.remove('inactive');
                    button.classList.add('active');
                    // Update the count text too
                    const emoteId = button.closest('.emote-div').id;
                    button.textContent = `idc (${updatedVoteData.vote_counts[emoteId]?.neutral || 0})`;
                });
            } catch (error) {
                console.error('Error updating button states:', error);
            }
        }, 2000); // Wait 2 seconds for background votes to complete
}



export async function getVoteCounts(eventId) {
    try {
        const response = await fetch(`/votes/${eventId}/counts`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error in getVoteCounts:', error);
        throw error;
    }
}