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

export async function createNeutralVotesInBackground(votingEventId, emotes, userVotes = {}) {
    // Filter out emotes the user has already voted on
    const emotesNeedingVotes = emotes.filter(emote => !userVotes[emote.id]);
    
    if (emotesNeedingVotes.length === 0) {
        console.log(`[BATCH VOTES] All ${emotes.length} emotes already have votes - skipping neutral vote creation`);
        return;
    }
    
    console.log(`[BATCH VOTES] Creating neutral votes for ${emotesNeedingVotes.length} of ${emotes.length} emotes in single batch call`);
    
    // OPTIMIZATION: Batch create all votes in a single API call
    try {
        const batchStartTime = performance.now();
        const response = await fetch('/votes/submit-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                voting_event_id: votingEventId,
                votes: emotesNeedingVotes.map(emote => ({
                    emote_id: emote.id,
                    vote_choice: 'neutral'
                }))
            })
        });
        
        const result = await response.json();
        const batchEndTime = performance.now();
        const batchDuration = batchEndTime - batchStartTime;
        
        if (result.success) {
            console.log(`[BATCH VOTES] Completed in ${batchDuration.toFixed(2)}ms: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
            console.log(`[BATCH VOTES] Saved ${emotesNeedingVotes.length} individual API calls by batching`);
            
            // Update UI immediately
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
        } else {
            console.error('[BATCH VOTES] Failed to create batch votes:', result.message);
        }
    } catch (error) {
        console.error('[BATCH VOTES] Error creating batch votes:', error);
    }
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