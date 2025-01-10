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

            case "update_cards":
                
                break;
        }
    });

    // Initialize total card count
    updateTotalCardCount();
};

// Changes the max size of allowed players and notifies the server too
function changeMaxsize(new_max_size) {
    // TODO: i imagine we'll eventually display this info in the pregame so change it there

    // Gets the name of the game owner from the H1 tag
    let game_owner = document.getElementById('username').value;

    if (game_owner != document.getElementById('owner').value) {
        return;
    }

    // Update the hidden input with the new max size
    document.getElementById('max_players').value = new_max_size;

    // Update the displayed max lobby size in the UI
    document.getElementById('max-lobby-size').innerHTML = new_max_size;

    // Notify the server about the new max size
    socket.send("API update_player_numbers;" + [game_owner, new_max_size].join(','));
}


// Function to update card count while considering the max lobby size
function updateCardCount(cardName, change) {
    const maxPlayers = parseInt(document.getElementById('max_players').value);
    let totalCards = 0;
    
    // Calculate the current total of selected cards
    document.querySelectorAll('.card-count').forEach(countDisplay => {
        const [current] = countDisplay.innerHTML.split('/').map(Number);
        totalCards += current;
    });
    
    // Get the current card's count element and its current value
    let countId = cardName.toLowerCase().replace(/\s+/g, '-') + '-count';
    let countDisplay = document.getElementById(countId);
    let [current, max] = countDisplay.innerHTML.split('/').map(Number);
    
    // Calculate the new total cards if this change is applied
    const newTotalCards = totalCards + change;
    
    // Check if the new total would exceed the max lobby size
    if (newTotalCards <= maxPlayers && current + change >= 0 && current + change <= max) {
        countDisplay.innerHTML = `${current + change}/${max}`;
    } else {
        return; // Prevent adding cards if the limit is exceeded
    }
    
    // Recalculate the total card count after the change
    totalCards = 0; // Reset the total cards
    document.querySelectorAll('.card-count').forEach(countDisplay => {
        const [current] = countDisplay.innerHTML.split('/').map(Number);
        totalCards += current;
    });
    
    // Update the total card count display
    document.getElementById('total-count-display').innerHTML = totalCards;
}

// Function to update total card count display
function updateTotalCardCount() {
    let totalCards = 0;
    document.querySelectorAll('.card-count').forEach(countDisplay => {
        const [current] = countDisplay.innerHTML.split('/').map(Number);
        totalCards += current;
    });
    
    // Update the total card count in the display
    document.getElementById('total-count-display').innerHTML = totalCards;
}