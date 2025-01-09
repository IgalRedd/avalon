const host = window.location.hostname;
// Need to do this for port since if its default port an empty string with : would break the URL
const port = window.location.port ? `:${window.location.port}` : '';

let socket = null;

window.onload = function () {
    let h1_text = document.getElementById('banner').textContent;
    h1_text = h1_text.slice(0, -7); // -7 to remove the 's Game text from the h1

    let username = document.getElementById('username');

    socket = new WebSocket(`ws://${host + port}/pregame?lobby=${h1_text}&username=${username.value}`);

    socket.addEventListener('message', (message) => {
        // TODO: someone leaves, change of owner, updating new players
        let data = message.data.split(';');
        let params = data[0].split(' ');
    
        if (params[0] !== "API") {
            return;
        }

        switch(params[1]) {
            case "player_joined":
                let current_text = document.getElementById('other_players').innerHTML;
                let new_text = '';
                if (current_text.trim() == "Other players:") {
                    new_text = current_text + data[1];
                } else {
                    new_text = current_text + `, ${data[1]}`;
                }
                document.getElementById('other_players').innerHTML = new_text;
                break;

            case "remove_user":
                // To avoid the Other players: 
                let players = document.getElementById('other_players').innerHTML.slice(15);
                players = players.split(', ');
                players = players.filter(str => str !== data[1]);
                document.getElementById('other_players').innerHTML = `Other players: ${players.join(', ')}`;
                break;
        }
    });
};