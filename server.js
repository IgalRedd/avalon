const express = require('express');
const ws = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const PORT = 8000;

const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const server = http.createServer(app);
const wss = new ws.Server({ server:server });

/*
 * This will handle API calls
 * All API calls will be in the format of: API <name>;<data>
 */

// note: get a better URL parser and when the websocket for the pregame connects it should send the room + name (use the onload function to make the websocket connect => we cna know the name)
wss.on('connection', (socket, request) => {
    // URL parser, add the dummy URL to properly parse the arguements
    let url = new URL(request.url, 'http://dummy.ca');
    
    switch(url.pathname) {
        case "/lobby":
            socket.room = "lobby";
            break;
        
        case "/pregame":
            socket.room = "pregame";
            socket.lobby = url.searchParams.get('lobby');
            socket.user = url.searchParams.get('username');
            break;
    }

    socket.on('message', (message) => {
        let data = message.toString().split(';');
        let params = data[0].split(' ');
    
        if (params[0] !== "API") {
            return;
        }

        switch(params[1]) {
            case "update_player_numbers":
                // Get the game index
                let args = data[1].split(',');
                let index = searchArray(args[0], notStartedGames);

                if (index == -1) {
                    return;
                }

                // Get actual game and set the new max
                let game = notStartedGames[index];
                game.max_players = args[1];

                // Tell the lobby players about it
                wss.clients.forEach((client) => {
                    // Update lobby players
                    if (client.room == "lobby") {
                        client.send("API update_player_numbers;" + [game.name, game.cur_players, game.max_players].join(','))
                    } else if (client.room == "pregame" && client.lobby == game.name) {
                        // Update the other players in the pregame
                        client.send("API update_player_count;" + [game.cur_players, game.max_players].join(','));
                    }
                });
                break;

            case "add_card":
                break;
            case "remove_card":
                break;
        }
    });

    socket.on('close', () => {
        // TODO: kick sockets out of arrays
        if (socket.room == "pregame") {
            let index = searchArray(socket.lobby, notStartedGames);
            
            // Game doesn't exist so stop
            if (index == -1) {
                return;
            }

            let userIndex = storedUsernames.indexOf(socket.user);
            storedUsernames.splice(userIndex, 1);

            //TO DO: Ensure that if host leaves, game does not crash (for now host is permantly stuck in lobby)

            let game = notStartedGames[index];
            // If this is true we need to delete the game
            if (game.cur_players == 1) {
                wss.clients.forEach((client) => {
                    if (client.room == 'lobby') {
                        client.send("API remove_game;" + game.name);
                    }
                });

                notStartedGames.splice(index, 1);
                return;
            }

            if (game.removePlayer(socket.user)) {
                // Update the clients in the pregame lobby to update player list
                wss.clients.forEach((client) => {
                    if (client.room == 'pregame' && client.lobby == socket.lobby) {
                        client.send("API remove_user;" + socket.user);
                    } else if (client.room == 'lobby') {
                        // Update the lobby players with the correct count of players in the pregame
                        client.send("API update_player_numbers;" + [game.name, game.cur_players, game.max_players].join(','))
                    }
                });
            }
            
        }
    });
});

function isValidUsername(username) {
    // Trim the username
    username = username.trim();

    // Check username for invalid characters
    if (username.includes('<') || username.includes('>') || username.includes(';') || username.includes(':')) {
        return "Error: '<', '>', ':' and ';' symbols are not accepted.";
    }

    // Check username for invalid length
    if (username.length >= 16 || username.length === 0) {
        return "Error: Username cannot be empty or longer than 16 characters.";
    }

    // Check for duplicate usernames
    if (storedUsernames.includes(username)) {
        return "Error: Username already in use, please try again.";
    }

    return "";
}


function lobbyEJS(res, errorMessage = "") {
    return res.render('lobby/lobby', { unreadyGames: notStartedGames, errorMessage: errorMessage });
}

// Args should be just [<username>]
function pregameEJS(res, args) {
    let username = args[0].trim(); // Trim the username
    let errorMessage = isValidUsername(args[0]);

    if (errorMessage != "") {
        return lobbyEJS(res, errorMessage);
    }

    storedUsernames.push(username);

    let game = new GameAttributes(username);
    // Add the game to the list
    notStartedGames.push(game);

    // Inform the players in the lobby of the new game
    wss.clients.forEach((client) => {
        if (client.room == "lobby") {
            client.send("API new_game;" + JSON.stringify(game));
        }
    });
  
    return res.render('pregame/pregame', {game: game, myUsername: args[0]})
}

function joinGameEJS(res, args) {
    let username = args[0].trim(); // Trim the username
    let errorMessage = isValidUsername(args[0]);

    if (errorMessage != "") {
        return lobbyEJS(res, errorMessage);
    }

    // update the lobby, update the person's game, load in the thing
    let index = searchArray(args[1], notStartedGames);
    let game = notStartedGames[index];
    
    if (!game.addPlayer(args[0])) {
        lobbyEJS(res, "Error: Game is full");
        return;
    }

    storedUsernames.push(username);

    wss.clients.forEach((client) => {
        // Update the players in the pregame with the new player
        if (client.room == "pregame" && client.lobby == args[1]) {
            client.send("API player_joined;" + args[0]);
        } else if (client.room == 'lobby') {
            // Update lobby players with the new correct count
            client.send("API update_player_numbers;" + [game.name, game.cur_players, game.max_players].join(','))
        }
    });

    return res.render('pregame/pregame', {game: game, myUsername: args[0]});

}


// Function to just handle routing of EJS files
// Expects files in the form of: <name>.ejs
// Takes in an array of args to pass onto the EJS resolver
function resolveEJS(pathName, res, args) {
    // TODO: update this to work with subdirectories?
    switch (pathName) {
        case "views/lobby/lobby.ejs":
            lobbyEJS(res);
            return false;

        case "views/pregame/pregame.ejs":
            pregameEJS(res, args);
            return false;

        case "views/pregame/joingame.ejs":
            joinGameEJS(res, args);
            return false;
        
        default:
            return true;
    }
}

// TODO: handle refreshes, specifically check if games have been deleted

app.get('/*', (req, res) => {
    // Security to prevent anyone from accessing your own files or the server
    if (req.path.includes('..') || req.path.includes('server.js')) {
        res.status(403);
        return res.send("Illegal access to resource.");
    }

    let filePath = "./views" + req.path;
    
    try {
        // This is done to check for bad files or 
        // improper paths and to upgrade a / => /lobby.ejs for easier handling
        let stats = fs.statSync(filePath);
        // If an error occured or the file is a directory that isn't /
        if (stats.isDirectory() && filePath != "./views/") {
            res.status(404);
            return res.send("Attempting to access unknown files");
        }

        // Change it to make the logic easier later
        if (filePath == "./views/") {
            filePath = "./views/lobby/lobby.ejs";
        }

        // This means we know its a file that we have!
        stats = fs.statSync(filePath);

        // Check for any errors and by this point we should be certain the path is a file
        if (!stats.isFile()) {
            res.status(404);
            return res.send("Attempting to access unknown files");
        }

        // If its an EJS file we need to render it, otherwise send the actual file
        if (!filePath.includes(".ejs")) {
            let absPath = path.resolve(filePath);

            try {
                return res.sendFile(absPath);
            } catch (err) {
                console.log(`Error in sending file: ${filePath}.\nError is: ${err}`)
                res.status(500);
                return res.send("Error in sending files...");
            }
        }

        if (resolveEJS(filePath.slice(2), res, [])) {
            res.status(404);
            return res.send("Attempting to access unknown files");
        }
    } catch (err) {
        res.status(404);
        return res.send("Attempting to access unknown files");
    }
});

app.post('/*', (req, res) => {
    switch(req.path) {
        case '/pregame/new_game':
            if (resolveEJS('views/pregame/pregame.ejs', res, [req.body.username])) {
                res.status(404);
                return res.send("Attempting to access unknown files");
            }   
            break; 

        case '/pregame/join_game':
            if (resolveEJS('views/pregame/joingame.ejs', res, [req.body.username, req.body.joining_username])) {
                res.status(404);
                return res.send("Attempting to access unknown files");
            }   
            break; 

        default:
            res.status(404);
            return res.send("Attempting to access unknown files");  
    }
});

server.listen(PORT, () => {
    console.log("Server is up!");
});


/*
 * Game mechanics managed by the server
 */

runningGames = [];
notStartedGames = [];
storedUsernames = [];
const cardNames = ["Merlin", "Percival", "Assasin", "Oberon", "Mordred", "Morgana", "Loyal Servents of Arthur", "Minions of Mordred"];
// First element is EVIL, second is GOOD
const cardRatios = {5:(2,3), 6:(2,4), 7:(3,4), 8:(3,5), 9:(3,6), 10:(4,6)};

// Searches given array of games (important) by name
// Returns index or -1
function searchArray(gameName, array) {
    for (let i = 0; i < array.length; i++) {
        if (array[i].name == gameName) {
            return i;
        }
    }

    return -1;
}

class GameAttributes {
    constructor(name) {
        this._name = name;
        this._cur_players = 1;
        this._max_players = 5;

        this.current_players = [];

        this._currentCardRatio = cardRatios[this._max_players];

        this._goodCards = ["Merlin", "Percival"];
        this._evilCards = ["Assassin"];
    }

    get currentCardRatio() {
        return this._currentCardRatio;
    }

    get name() {
        return this._name;
    }

    get cur_players() {
        return this._cur_players;
    }

    get max_players() {
        return this._max_players;
    }

    get otherPlayers() {
        return this.current_players;
    }

    set max_players(new_max) {
        if (new_max >= 5 && new_max <= 10) {
            this._max_players = new_max;
            this._currentCardRatio = cardRatios[this._max_players];
        }
    }

    addGoodCard(cardName) {
        if (!cardNames.includes(cardName)) {
            return false;
        }

        if (this._currentCardRatio[1] >= this._goodCards.length) {
            return false;
        }

        this._goodCards.push(cardName);

        return true;
    }

    addEvilCard(cardName) {
        if (!cardNames.includes(cardName)) {
            return false;
        }

        if (this._currentCardRatio[0] >= this._evilCards.length) {
            return false;
        }

        this._evilCards.push(cardName);

        return true;
    }

    removeGoodCard(cardName) {
        if (!cardNames.includes(cardName)) {
            return false;
        }

        if (cardName == "Merlin" || cardName == "Percival") {
            return false;
        }

        let index = this._goodCards.indexOf(cardName);

        if (index == -1) {
            return false;
        }

        this._goodCards.splice(index, 1);

        return true;
    }

    removeEvilCard(cardName) {
        if (!cardNames.includes(cardName)) {
            return false;
        }

        if (cardName == "Assassin") {
            return false;
        }

        let index = this._evilCards.indexOf(cardName);

        if (index == -1) {
            return false;
        }

        this._evilCards.splice(index, 1);

        return true;
    }

    addPlayer(new_name) {
        if (this._cur_players < this._max_players && !this.current_players.includes(new_name)) {
            this._cur_players += 1;
            this.current_players.push(new_name)

            return true;
        }

        return false;
    }

    removePlayer(to_remove) {
        if (this.current_players.includes(to_remove)) {
            // Removes the player
            let index = this.current_players.indexOf(to_remove);
            this.current_players.splice(index, 1);

            this._cur_players -= 1;

            return true;
        }

        return false;
    } 

}