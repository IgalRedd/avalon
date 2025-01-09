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
            let names = document.getElementById('games').querySelectorAll('p');

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
            let names2 = document.getElementById('games').querySelectorAll('p');
            let args = data[1].split(','); // Passed in data is array

            // Find the game to remove
            for (let i = 0; i < names2.length; i++) {
                // Find the game with the matching name
                let name = names2[i].innerHTML;
                if (name.split(' : ')[0].trim() === args[0].trim()) {
                    // Change the tag's data to the new values (name won't change but player counts will)
                    names2[i].innerHTML = `${args[0]} : ${args[1]} / ${args[2]}`;
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

function joinGame(game_name) {
    // Grab username
    let own_username = document.getElementById('username').value;
    const errorMessageElement = document.getElementById('error-message');

    // Clear any previous error messages
    errorMessageElement.innerHTML = '';

    if (!isValidUsername(own_username)) {
        if (own_username.trim().length != 0) {
            errorMessageElement.innerHTML = "Error: '<', '>', ':', and ';' symbols are not accepted.";
            return
        }
        else {
        errorMessageElement.innerHTML = "Error: Username cannot be empty or longer than 16 characters.";
        return;
        }
    }
    
    // Fill out hidden form values
    document.getElementById('own_username').value = own_username;
    document.getElementById('joining_username').value = game_name;

    // Submit it
    document.getElementById('joinGameForm').submit();
}