const host = window.location.hostname;
// Need to do this for port since if its default port an empty string with : would break the URL
const port = window.location.port ? `:${window.location.port}` : '';
const socket = new WebSocket(`ws://${host}` + port);

socket.addEventListener('message', (message) => {
    ; // Nothing yet
});


function newGame() {
    // TODO: do some processing on the username (recommend to extract this to another function to reuse for joining)
    // The rest of this assumes that the whole thing passed and username is valid

    document.getElementById('newGameForm').submit();
}