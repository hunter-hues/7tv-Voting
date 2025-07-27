console.log("JS is connected");

const usernameInput = document.querySelector('#username');
const fetchButton = document.querySelector('#fetch-emotes');
fetchButton.addEventListener('click', function(event) {
    const username = usernameInput.value;
    console.log(username);
});