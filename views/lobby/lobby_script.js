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

    // Variables used in a lot of the switches
    let names = document.getElementById('games').querySelectorAll('p');
    let args = [];

    switch(params[1]) {
        case "new_game": 
            // Create the p tag with the data
            let game = JSON.parse(data[1]);
            
            let divTag = document.createElement("div");
            divTag.classList.add('specific_game');

            let pTag = document.createElement("p");
            pTag.innerHTML = `${game._name} : ${game._cur_players} / ${game._max_players}`;

            let button = document.createElement("button");
            button.textContent = 'Join';
            button.onclick = () => joinGame(game._name);

            divTag.appendChild(pTag);
            divTag.appendChild(button);

            // Add it to the list
            document.getElementById('games').appendChild(divTag);
            break;

        case "remove_game":
            // Find the game to remove
            for (let i = 0; i < names.length; i++) {
                let name = names[i].innerHTML;
                if (name.split(' : ')[0] == data[1]) {
                    names[i].parentElement.remove();
                    return;
                }
            }
            break;
        
        case "update_player_numbers":
            args = data[1].split(',');

            // Find the game to remove
            for (let i = 0; i < names.length; i++) {
                // Find the game with the matching name
                let name = names[i].innerHTML;
                if (name.split(' : ')[0].trim() === args[0].trim()) {
                    // Change the tag's data to the new values (name won't change but player counts will)
                    names[i].innerHTML = `${args[0]} : ${args[1]} / ${args[2]}`;
                    return;
                }
            }
            break;

        case "new_owner":
            args = data[1].split(',');

            for (let i = 0; i < names.length; i++) {
                let name = names[i].innerHTML;
                // Check if it matches old owner
                if (name.split(' : ')[0].trim() === args[1].trim()) {
                    let playerCount = name.split(' : ')[1].split(' / ');
                    // Set new owner + decrement the player count by 1
                    names[i].innerHTML = `${args[0]} : ${parseInt(playerCount[0]) - 1} / ${playerCount[1]}`;
                    return;
                }
            }
            break;
    }
});

function isValidUsername(username) {
    // Trim the username
    username = username.trim();

    // Check username for invalid characters
    if (username.includes('<') || username.includes('>') || username.includes(';') || username.includes(':')
        || username.includes('@') || username.includes(',') || username.includes(' ') || username.includes('\n') || username.includes('\r')) {
        return "Error: '<', '>', ':', ';', @, space, and newline characters are not accepted.";
    }

    // Check username for invalid length
    if (username.length >= 16 || username.length == 0) {
        return "Error: Username cannot be empty or longer than 16 characters.";
    }

    return "";
}


function newGame() {
    let username = document.getElementById('username').value;
    const errorMessageElement = document.getElementById('error-message');

    // Ensure username is valid
    let err = isValidUsername(username);
    if (err != '') {
        errorMessageElement.innerHTML = err;
        return;
    }

    document.getElementById('newGameForm').submit();
}

function joinGame(game_name) {
    // Grab username
    let own_username = document.getElementById('username').value;
    const errorMessageElement = document.getElementById('error-message');

    // Ensure username is valid
    let err = isValidUsername(own_username);
    if (err != '') {
        errorMessageElement.innerHTML = err;
        return;
    }
    
    // Fill out hidden form values
    document.getElementById('own_username').value = own_username;
    document.getElementById('joining_username').value = game_name;

    // Submit it
    document.getElementById('joinGameForm').submit();
}