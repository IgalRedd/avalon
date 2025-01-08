const host = window.location.hostname;
// Need to do this for port since if its default port an empty string with : would break the URL
const port = window.location.port ? `:${window.location.port}` : '';
const socket = new WebSocket(`ws://${host}` + port + "/lobby?test=abc");

window.onload = function() {

    let form = document.getElementById("newGameForm");
    form.addEventListener("submit", function(event) {
        event.preventDefault();
    }
);

}

socket.addEventListener('message', (message) => {
    let data = message.data.split(';');
    let params = data[0].split(' ');

    if (params[0] !== "API") {
        return;
    }

    switch(params[1]) {
        case "new_game": 
            // Create the p tag with the data
            let game = JSON.parse(data[1]);
            let pTag = document.createElement("p");
            pTag.innerHTML = `${game._name} : ${game._cur_players} / ${game._max_players}`;

            // Add it to the list
            document.getElementById('games').appendChild(pTag);
            break;
    }
});

function isValidUsername(username) {
    // Trim the username
    username = username.trim();

    // Check username for invalid characters
    if (username.includes('<') || username.includes('>') || username.includes(';') || username.includes(':')) {
        return false;
    }

    // Check username for invalid length
    if (username.length >= 16 || username.length === 0) {
        return false;
    }

    return true;
}


function newGame() {
    let username = document.getElementById('username').value;
    const errorMessageElement = document.getElementById('error-message');

    // Clear any previous error messages
    errorMessageElement.innerHTML = '';

    // Use the validation function
    if (!isValidUsername(username)) {
        if (username.trim().length != 0) {
            errorMessageElement.innerHTML = "Error: '<', '>', ':', and ';' symbols are not accepted.";
            return
        }
        else {
        errorMessageElement.innerHTML = "Error: Username cannot be empty or longer than 16 characters.";
        return;
        }
    }

    document.getElementById('newGameForm').submit();
}