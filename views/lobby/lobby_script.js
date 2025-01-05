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
            let pTag = document.createElement("p");
            pTag.innerHTML = `${game._name} : ${game._cur_players} / ${game._max_players}`;

            // Add it to the list
            document.getElementById('games').appendChild(pTag);
            break;
    }
});


function newGame() {
    // TODO: do some processing on the username (recommend to extract this to another function to reuse for joining)
    // The rest of this assumes that the whole thing passed and username is valid

    document.getElementById('newGameForm').submit();
}