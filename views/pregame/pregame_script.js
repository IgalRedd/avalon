const host = window.location.hostname;
// Need to do this for port since if its default port an empty string with : would break the URL
const port = window.location.port ? `:${window.location.port}` : '';

let socket = null;

let goodCount = 2;
let evilCount = 1;
const cardRatios = {5:[2,3], 6:[2,4], 7:[3,4], 8:[3,5], 9:[3,6], 10:[4,6]};
// Merlin, Percival and Assassin are not included as they are mandatory base cards for any given game
const goodCards = ["ServantsofArthur"];
const evilCards = ["Oberon", "Mordred", "Morgana", "MinionsofMordred"];

function removePlayer(to_remove) {
    let names_array = document.getElementById('player-div').querySelectorAll('p');

    for (let i = 0; i < names_array.length; i++) {
        if (names_array[i].innerHTML == to_remove) {
            names_array[i].parentElement.remove();
            break;
        }
    }

    let counterText = document.getElementById('counter-display').innerHTML.split(' / ');
    document.getElementById('counter-display').innerHTML = `${parseInt(counterText[0]) - 1} / ${counterText[1]}`;
}

// Moved to this function for easier reading of event handler
// Adds the radio buttons to change size and the start button
function addButtons() {
    let btn_div = document.createElement('div');
    btn_div.setAttribute('id', 'lobby-size-controls');

    let btn_pTag = document.createElement("p");
    btn_pTag.innerHTML = "Select Lobby Size:";
    btn_div.appendChild(btn_pTag);

    let second_btn_div = document.createElement('div');
    btn_div.appendChild(second_btn_div);

    for (let i = 5; i < 11; i++) {
        let label = document.createElement('label');

        // Create the radio input element
        let input = document.createElement('input');
        input.type = 'radio';
        input.name = 'lobbySize';
        input.value = i;
        input.setAttribute('onchange', `changeMaxsize(${i})`);

        // Only for first one
        if (i == 5) {
            input.checked = true;
        }
        
        // Append the input to the label
        label.appendChild(input);
        label.appendChild(document.createTextNode(`${i} Players`));

        second_btn_div.appendChild(label);
        second_btn_div.appendChild(document.createElement("br"));
    }

    // Display the start game button
    let start_btn = document.createElement("button");
    start_btn.textContent = "Start Game"
    start_btn.onclick = () => {startGame()};
    btn_div.appendChild(start_btn);

    // Finally add it to the body
    document.getElementById('body').appendChild(btn_div);
}

// Moved to this function for easier reading of event handler
// Adds the buttons for the cards and makes them functional
function addCardUI() {
    let buttonable = document.querySelectorAll(".buttonable");

    for (let i = 0; i < buttonable.length; i++) {
        let cardDiv = document.createElement("div");
        cardDiv.classList.add("card-buttons");

        let plusButton = document.createElement("button");
        plusButton.onclick = () => {updateCardCount(buttonable[i].innerHTML, 1)};
        plusButton.setAttribute("type", "button");
        plusButton.textContent = "+";

        let minusButton = document.createElement("button");
        minusButton.onclick = () => {updateCardCount(buttonable[i].innerHTML, -1)};
        minusButton.setAttribute("type", "button");
        minusButton.textContent = "-";

        cardDiv.appendChild(plusButton);
        cardDiv.appendChild(minusButton);
        buttonable[i].after(cardDiv);
    }
}

window.onload = function () {
    let owner = document.getElementById('owner').value;
    let username = document.getElementById('username').value;

    socket = new WebSocket(`ws://${host + port}/pregame?lobby=${owner}&username=${username}`);

    socket.addEventListener('message', (message) => {
        let data = message.data.split(';');
        let params = data[0].split(' ');
    
        if (params[0] !== "API") {
            return;
        }

        switch(params[1]) {
            case "player_joined":
                // Handling adding the new player
                let parent_div = document.getElementById('player-div');
                // Create the elements
                let new_div = document.createElement("div");
                new_div.classList.add("individual-player");

                let new_img = document.createElement("img");
                new_img.setAttribute("src", "/pregame/kick.png");
                new_img.setAttribute("alt", "Kick");
                new_img.setAttribute("width", "32");
                new_img.setAttribute("height", "32");
                new_div.appendChild(new_img);
                // Add clickable kick button if the player is the owner
                if (document.getElementById('username').value == document.getElementById('owner').value) {
                    new_img.classList.add("clickable");
                    new_img.onclick = () => {kickPlayer(data[1])};
                }

                let new_pTag = document.createElement("p");
                new_pTag.innerHTML = data[1];
                new_pTag.classList.add("player-display");
                new_div.appendChild(new_pTag);

                parent_div.appendChild(new_div);

                // Updating the counter
                let counterText = document.getElementById('counter-display').innerHTML.split(' / ');
                document.getElementById('counter-display').innerHTML = `${parseInt(counterText[0]) + 1} / ${counterText[1]}`;
                break;

            case "remove_user":
                // Remove the player from list
                console.log("removing....");
                removePlayer(data[1]);
                break;

            case "update_player_count":
                let values = data[1].split(',');
                document.getElementById('counter-display').innerHTML = `${values[0]} / ${values[1]}`;
                document.getElementById("max_players").value = values[1];
                updateCards();
                break;

            case "new_owner":
                let new_owner = data[1].split(',')[0];
                // Remove the new owner from the player list
                removePlayer(new_owner);

                // Update properties
                document.getElementById('owner_display').innerHTML = new_owner;
                document.getElementById('banner').innerHTML = `${new_owner}'s Game`;
                document.getElementById('owner').value = new_owner;

                // Some updates only the owner needs to see
                if (document.getElementById('username').value == new_owner) {
                    // To display buttons for the card UI
                    addCardUI();

                    // To display the buttons an owner should see
                    addButtons();

                    // Also make all images for the kick button clickable
                    let players = document.querySelectorAll(".individual-player");
                    
                    for (let i = 0; i < players.length; i++) {
                        // CSS property append
                        players[i].querySelector('img').classList.add('clickable');
                        // Make it so the onclick functions
                        let playerName = players[i].querySelector('p').innerHTML;
                        players[i].querySelector('img').onclick = () => {kickPlayer(playerName)};
                    }
                }

                break;

            case "leave":
                leave();
                break;

            case "start_game":
                startGame();
            
            case "update_cards":
                // If you are the host don't recurse otherwise it'll add as much as it can
                if (document.getElementById("owner").value == document.getElementById("username").value) {
                    return;
                }
                let cardArgs = data[1].split(',');
                let change = parseInt(cardArgs[1]);

                updateCardCount(cardArgs[0], change);
                
                break;
        }
    });

    // We need to set up the evil and good counts from scratch because newly joined players won't display properly
    let displays = document.querySelectorAll('[data-count]');
    for (let i = 0; i < displays.length; i++) {
        let count = parseInt(displays[i].innerHTML.split('/')[0]);
        let cardName = displays[i].getAttribute("data-count");

        // Increment counters
        if (goodCards.includes(cardName)) {
            goodCount += count;
        } else if (evilCards.includes(cardName)) {
            evilCount += count;
        }
    }

    updateCards();
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

    updateCards();

    // Notify the server about the new max size
    socket.send("API update_player_numbers;" + [game_owner, new_max_size].join(','));
}


function kickPlayer(name) {
    socket.send("API kick_player;" + name);
}

// Had to make this a function to stop a race condition where the socket closing would 
// be slower than the HTTP GET can send the lobby back, meaning it'd erroniously show 
// the game as still active
function leave() {
    socket.close();
    document.getElementById('leaveGame').submit();
}


function startGame() {
    let num_players = document.getElementById('counter-display').innerHTML.split(' / ')[0];
    num_players = parseInt(num_players);

    let myUsername = document.getElementById('username').value;
    let hostUsername = document.getElementById('owner').value;

    let maxSize = parseInt(document.getElementById('max_players').value);

    if (maxSize == num_players && (goodCount + evilCount) == maxSize) {
        // Set the values for the form
        document.getElementById('lobbyHost').value = hostUsername;
        document.getElementById('myUsername').value = myUsername;

        // Only the host need inform the server
        if (myUsername == hostUsername) {
            socket.send("API start_game;" + document.getElementById('owner').value);
        }
        socket.close();

        document.getElementById('startGame').submit();
    }
}

// Function to update card count while considering the max lobby size
function updateCardCount(cardName, change) {
    const maxPlayers = parseInt(document.getElementById('max_players').value);

    let countDisplay = document.querySelector(`[data-count=${cardName}]`);

    let currentAmount = parseInt(countDisplay.innerHTML.split("/")[0]);
    let maxAmount = parseInt(countDisplay.innerHTML.split("/")[1]);

    // Can't remove empty nor can you add full
    if ((currentAmount == 0 && change == -1)
        || (currentAmount >= maxAmount && change == 1)) {
        return;
    }

    // Bad cards case
    if (evilCards.includes(cardName)) {
        // Check card ratios for evil to ensure balanced game
        if (cardRatios[maxPlayers][0] <= evilCount && change == 1) {
            return;
        }

        currentAmount += change;
        evilCount += change;

        countDisplay.innerHTML = `${currentAmount}/${maxAmount}`;
    }

    // Good cards case
    if (goodCards.includes(cardName)) {
        // Check card ratios for good to ensure balanced game
        if (cardRatios[maxPlayers][1] <= goodCount && change == 1) {
            return;
        }

        currentAmount += change;
        goodCount += change;

        countDisplay.innerHTML = `${currentAmount}/${maxAmount}`;
    }

    updateCards();

    if (document.getElementById("owner").value == document.getElementById("username").value) {
        socket.send("API card_update;" + [cardName, change, document.getElementById('owner').value].join(","));
    }

}

// Function to update total card count display
function updateCards() {
    const maxSize = parseInt(document.getElementById('max_players').value); 

    document.getElementById("good-count").innerHTML = `Good Count: ${goodCount} / ${cardRatios[maxSize][1]}`;
    document.getElementById("evil-count").innerHTML = `Evil Count: ${evilCount} / ${cardRatios[maxSize][0]}`;

}