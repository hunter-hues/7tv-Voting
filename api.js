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
        console.error('Error:', error)
    }
}

export async function getEmoteSets(username) {
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

export function getEmoteImgUrl(id, size) {
    return `https://cdn.7tv.app/emote/${id}/${size}x`;
}