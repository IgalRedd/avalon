const host = window.location.hostname;
// Need to do this for port since if its default port an empty string with : would break the URL
const port = window.location.port ? `:${window.location.port}` : '';
const socket = new WebSocket(`ws://${host}` + port + "/lobby?test=abc");

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
            console.log(`updating nums: ${data[1]}`);
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


function newGame() {
    // TODO: do some processing on the username (recommend to extract this to another function to reuse for joining)
    // The rest of this assumes that the whole thing passed and username is valid

    document.getElementById('newGameForm').submit();
}

function joinGame(game_name) {
    // TODO: same filtering on the username

    // Grab username
    let own_username = document.getElementById('username').value;
    
    // Fill out hidden form values
    document.getElementById('own_username').value = own_username;
    document.getElementById('joining_username').value = game_name;

    // Submit it
    document.getElementById('joinGameForm').submit();
}