const host = window.location.hostname;
// Need to do this for port since if its default port an empty string with : would break the URL
const port = window.location.port ? `:${window.location.port}` : '';

let socket = null;

window.onload = function () {
    let owner = document.getElementById('owner').value;
    let username = document.getElementById('username').value;

    socket = new WebSocket(`ws://${host + port}/pregame?lobby=${owner}&username=${username}`);

    socket.addEventListener('message', (message) => {
        // TODO: someone leaves, change of owner, updating new players
        let data = message.data.split(';');
        let params = data[0].split(' ');
    
        if (params[0] !== "API") {
            return;
        }

        switch(params[1]) {
            case "player_joined":
                // Handling adding the new player
                let current_text = document.getElementById('other_players').innerHTML;
                let new_text = '';
                if (current_text.trim() == "Other players:") {
                    new_text = current_text + data[1];
                } else {
                    new_text = current_text + `, ${data[1]}`;
                }
                document.getElementById('other_players').innerHTML = new_text;

                // Updating the counter
                let counterText = document.getElementById('counter-display').innerHTML.split(' / ');
                document.getElementById('counter-display').innerHTML = `${parseInt(counterText[0]) + 1} / ${counterText[1]}`;
                break;

            case "remove_user":
                // Remove the player from list
                // To avoid the Other players: 
                let players = document.getElementById('other_players').innerHTML.slice(15);
                players = players.split(', ');
                players = players.filter(str => str !== data[1]);
                document.getElementById('other_players').innerHTML = `Other players: ${players.join(', ')}`;

                // Updating the counter
                let counterText2 = document.getElementById('counter-display').innerHTML.split(' / ');
                document.getElementById('counter-display').innerHTML = `${parseInt(counterText2[0]) - 1} / ${counterText2[1]}`;
                break;

            case "update_player_count":
                let values = data[1].split(',');
                document.getElementById('counter-display').innerHTML = `${values[0]} / ${values[1]}`;
                break;
        }
    });
};


// Changes the max size of allowed players and notifies the server too
function changeMaxsize(new_max_size) {
    // TODO: i imagine we'll eventually display this info in the pregame so change it there

    // Gets the name of the game owner from the H1 tag
    let game_owner = document.getElementById('username').value;

    // Update our statistics
    document.getElementById('max_players').value = new_max_size;

    socket.send("API update_player_numbers;" + [game_owner, new_max_size].join(','));
}