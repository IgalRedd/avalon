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
            socket.starting = false;
            break;
        
        case "/game":
            socket.room = "game"
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

        let index = -1;
        let game = null;
        switch(params[1]) {
            case "update_player_numbers":
                // Get the game index
                let args = data[1].split(',');
                index = searchArray(args[0], notStartedGames);

                if (index == -1) {
                    return;
                }

                // Get actual game and set the new max
                game = notStartedGames[index];
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
           
            case "kick_player":
                // TODO: make this more intuitive, like displaying the fact that they got kicked
                wss.clients.forEach((client) => {
                    if (client.room == "pregame" && client.user == data[1]) {
                        client.send("API leave;");
                        return;
                    }
                });
                break;

            case "start_game":
                index = searchArray(data[1], notStartedGames);

                if (index == -1) {
                    return;
                }

                game = notStartedGames[index];
                if (!game.startGame()) {
                    return;
                }

                // By this point we have a valid game that is full
                // TODO: check cards as well

                // Set the socket to be started
                socket.starting = true;
                // Update arrays
                runningGames.push(game);
                notStartedGames.splice(index, 1);

                // Update the other players
                wss.clients.forEach((client) => {
                    if (client.room == "pregame" && client.lobby == data[1]) {
                        client.starting = true;
                        client.send("API start_game;");
                    } else if (client.room = "lobby") {
                        client.send("API remove_game;" + data[1]);
                    }
                });

            case "card_update":
                let cardArgs = data[1].split(',');
                index = searchArray(cardArgs[2], notStartedGames);

                // TODO: enforce that the addCard worked

                if (index == -1) {
                    return;
                }

                if (cardArgs[1] == "1") {
                    notStartedGames[index].addCard(cardArgs[0]);
                }

                if (cardArgs[1] == "-1") {
                    notStartedGames[index].removeCard(cardArgs[0]);
                }

                wss.clients.forEach((client) => {
                    if (client.room == "pregame" && client.lobby == cardArgs[2]) {
                        client.send("API update_cards;" + cardArgs.join(','));
                    }
                });
                break;

            case "add_player_party":
                wss.clients.forEach((client) => {
                    if (client.room == "game" && client.lobby == socket.lobby) {
                        client.send("API add_player_party;" + data[1]);
                    }
                });
                break;

            case "remove_player_party":
                wss.clients.forEach((client) => {
                    if (client.room == "game" && client.lobby == socket.lobby) {
                        client.send("API remove_player_party;" + data[1]);
                    }
                });
                break;

            case "party_confirmed":
                let players = data[1].split(',');

                index = searchArray(socket.lobby, runningGames);
                game = runningGames[index]; 

                game.missionPlayers = players;

                game._newTime = partyVoteTime;
                game._currentPeriod = periods[1];

                wss.clients.forEach((client) => {
                    if (client.room == "game" && client.lobby == socket.lobby) {
                        client.send("API start_vote;");
                    }
                });
                break;

            case "give_new_leader":
                index = searchArray(socket.lobby, runningGames);
                game = runningGames[index];

                game.nextLeader();

                wss.clients.forEach((client) => {
                    if (client.room == "game" && client.lobby == socket.lobby) {
                        client.send("API new_leader;" + game._leader);
                    }
                });
                break;

            case "party_vote":
                index = searchArray(socket.lobby, runningGames);
                game = runningGames[index];

                let vote = (data[1] == 'true' ? "approve" : "reject");
                // Check if the final vote was the deciding one
                let rtn = game.vote(vote); 
                if (rtn == '') {
                    return;
                }

                if (rtn == "Rejected") {
                    game.nextLeader();
                }
                else {
                    game._newTime = missionVoteTime;
                    game._currentPeriod = periods[2];
                }
        
                wss.clients.forEach((client) => {
                    if (client.room == "game" && client.lobby == socket.lobby) {
                        if (rtn == "Rejected") {
                            client.send("API party_rejected;" + game._leader);
                        }
                        else {
                            client.send("API party_accepted;");
                        }
                    }
                });
                break;

            case "mission_vote":
                index = searchArray(socket.lobby, runningGames);
                game = runningGames[index];

                let missionVote = (data[1] == 'true' ? "approve" : "reject");

                let missionReturn = game.missionVote(missionVote);

                if (missionReturn == '') {
                    return;
                }

                wss.clients.forEach((client) => {
                    if (client.room == "game" && client.lobby == socket.lobby) {
                        client.send("API mission_voted;" + missionReturn.join(','));
                    }
                });

                if (game.evilWon() || game.goodWon()) {
                    clearInterval(game.interval);

                    let winner = game.evilWon() ? 'E' : 'G';
                    wss.clients.forEach((client) => {
                        if (client.room == "game" && client.lobby == socket.lobby) {
                            client.send("API game_finished;" + [winner, JSON.stringify(game._characterSelected)].join('@'));
                        }
                    });

                    if (winner == 'E') {
                        runningGames.splice(index, 1);
                        // TODO: remove names from list?
                    }
                }

                break;
            
            case "assassinate":
                index = searchArray(socket.lobby, runningGames);
                game = runningGames[index];
                
                let merlinName = Object.keys(game._characterSelected).find(key => game._characterSelected[key].card == "Merlin");
                wss.clients.forEach((client) => {
                    if (client.room == "game" && client.lobby == socket.lobby) {
                        client.send("API assassinate;" + [data[1], merlinName].join(','));
                    }
                });

                runningGames.splice(index, 1);
                // TODO: remove names?

                break;
        }
    });

    socket.on('close', () => {
        // TODO: kick sockets out of arrays
        if (socket.room == "pregame") {
            // If they're closing the socket because of the game starting don't do anything
            if (socket.starting) {
                return;
            }

            let index = searchArray(socket.lobby, notStartedGames);
            // Game doesn't exist so stop
            if (index == -1) {
                return;
            }

            let userIndex = storedUsernames.indexOf(socket.user);
            storedUsernames.splice(userIndex, 1);

            let game = notStartedGames[index];
            // If this is true we need to delete the game
            if (game.cur_players == 1) {
                notStartedGames.splice(index, 1);

                wss.clients.forEach((client) => {
                    if (client.room == 'lobby') {
                        client.send("API remove_game;" + game.name);
                    }
                });

                
                return;
            }
            
            // Remove player
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
            } else if (game.name == socket.user) {
                // Remove owner ; this'll only be called if number of players > 1 as that check is above
                let old_owner = game._name;
                game.newOwner();
                wss.clients.forEach((client) => {
                    // Update the new owner in the pregame and in lobby
                    if (client.room == 'pregame' && client.lobby == old_owner) {
                        // Set the new owner
                        client.lobby = game.name;
                        client.send("API new_owner;" + [game.name, old_owner].join(','));
                    } else if (client.room == 'lobby') {
                        client.send("API new_owner;" + [game.name, old_owner].join(','));
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
    if (username.length >= 16 || username.length == 0) {
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

// Args should be [<username of joiner>, <username of host>]
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

// Args should be [<your username>, <host username>]
function gameEJS(res, args) {
    // TODO: make the connection and this work together, so far we're under the assumption when this is called the game successfully started
    let index = searchArray(args[1], runningGames);

    // This is with the TODO and ensure the game is running when this is called
    if (index == -1) {
        console.log("couldn't find game");
        res.status(404);
        return res.send("Attempting to access unknown files");
    }

    let game = runningGames[index];
    res.render('game/game', {game: game, myUsername: args[0], leader: game._leader});
}


// Function to just handle routing of EJS files
// Expects files in the form of: <name>.ejs
// Takes in an array of args to pass onto the EJS resolver
function resolveEJS(pathName, res, args) {
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

        case "views/game/game.ejs":
            gameEJS(res, args);
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
        
        case '/game/game':
            if (resolveEJS('views/game/game.ejs', res, [req.body.username, req.body.owner])) {
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
const cardNames = ["Merlin", "Percival", "Assasin", "Oberon", "Mordred", "Morgana", "ServantsofArthur", "MinionsofMordred"];
const evilCardNames = ["Oberon", "Mordred", "Morgana", "MinionsofMordred"];
const goodCardNames = ["Merlin", "Percival","ServantsofArthur"];
// First element is EVIL, second is GOOD
const cardRatios = {5:[2,3], 6:[2,4], 7:[3,4], 8:[3,5], 9:[3,6], 10:[4,6]};

// How much time is for discussion and to confirm a party
const discussionTime = 180;
// How much time everyone has to accept and reject a party
const partyVoteTime = 30;
// How much time the people in the party have to vote on the mission
const missionVoteTime = 30;
// How much more time each new mission gets
const scaleUpTime = 10;

const periods = ["Discussion", "PartyVoting", "MissionVoting"];

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

        this._missionRounds = [];
        this._missionPlayers = [];
        this._missionStatus = [];
        this._missionVotes = [];

        // Leader starts as host
        this._leader = name;

        this._currentRound = 0;

        // Empty until game starts
        // This'll match names of players to cards
        this._characterSelected = {};

        this._votes = [];

        // Time left is the current period
        this._timeLeft;
        this._newTime = -1;
        // What we are doing right now, (eg: discussion, vote...)
        this._currentPeriod;

        // To store the interval
        this.interval = null;

        // This is an array of 'E', 'G' for evil and good wins
        this.history = [];
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

    get evilCards() {
        return this._evilCards;
    }

    set max_players(new_max) {
        if (new_max >= 5 && new_max <= 10) {
            this._max_players = new_max;
            this._currentCardRatio = cardRatios[this._max_players];
        }
    }

    set missionPlayers(players) {
        this._missionPlayers = players;
    }

    // This function is called every 1s to update the timer and inform if something needs to happen
    timerHandler() {
        let msg = '';

        if (this._newTime != -1) {
            this._timeLeft = this._newTime;
            this._newTime = -1;
        }

        if (this._timeLeft == -1) {
            // Time ran out so inform the clients
            wss.clients.forEach((client) => {
                if (client.room == "game" && client.lobby == this._name) {
                    client.send("API timeout;" + this._currentPeriod);
                }
            });

            return;
        }

        // Get message
        switch(this._currentPeriod) {
            case "Discussion":
                msg = `Time Left: ${this._timeLeft} seconds for discussion`;
                break;

            case "PartyVoting":
                msg = `Time Left: ${this._timeLeft} seconds for party voting`;
                break;
            
            case "MissionVoting":
                msg = `Time Left: ${this._timeLeft} seconds for mission voting`
        }

        this._timeLeft -= 1;

        wss.clients.forEach((client) => {
            if (client.room == "game" && client.lobby == this._name) {
                client.send("API timer_update;" + msg);
            }
        });
    }

    // Function to choose the random evils and goods
    startGame() {
        // Check if the game is ready to start
        if (this._cur_players != this._max_players 
            && this._goodCards.length == this._currentCardRatio[1]
            && this._evilCards.length == this._currentCardRatio[0]) {
            return false;
        }
        // These lists are equal by assumption above since the ratio of good + evil = max
        let player_list = [this._name].concat(this.current_players);
        let card_list = this._goodCards.concat(this._evilCards);

        while (player_list.length > 0) {
            // Pick random card and player
            let randPlayer = Math.floor(Math.random() * player_list.length);
            let randCard = Math.floor(Math.random() * card_list.length);

            // Assign it
            let player = player_list[randPlayer];
            let card = card_list[randCard];
            this._characterSelected[player] = {
                card: card,
                className: goodCardNames.includes(card) ? 'good' : 'evil' // Assign class based on card type
            };

            // Decrement the list as we've assigned that player
            player_list.splice(randPlayer, 1);
            card_list.splice(randCard, 1);
        }

        // Call missionFormat() after the game starts missionRounds is updated
        this.missionFormat();

        // - 1 to account for the extra second it takes to load it
        this._timeLeft = discussionTime - 1;
        this._currentPeriod = periods[0];

        // Call the timer handler every second
        this.interval = setInterval(() => {this.timerHandler()}, 1000);

        return true;
    }

    addCard(cardName) {
        if (!cardNames.includes(cardName)) {
            return false;
        }

        // Check to see if desired added card is an evil card
        if (evilCardNames.includes(cardName)) {
            if (this._currentCardRatio[0] <= this._evilCards.length) {
                return false;
            }
            else {
                this._evilCards.push(cardName);
            }
        }

        // Check to see if desired added card is an good card
        if (goodCardNames.includes(cardName)) {
            if (this._currentCardRatio[1] <= this._goodCards.length) {
                    return false;
            }
            else {
                this._goodCards.push(cardName);
            }
        }

        //TO DO: force constraints on limited characters

        return true;
    }

    removeCard(cardName) {

        if (!cardNames.includes(cardName)) {
            return false;
        }

        if (evilCardNames.includes(cardName)) {
            let index = this._evilCards.indexOf(cardName);

            if (index == -1) {
                return false;
            }

            this._evilCards.splice(index, 1);

            return true;
        }

        if (goodCardNames.includes(cardName)) {
            let index = this._goodCards.indexOf(cardName);

            if (index == -1) {
                return false;
            }

            this._goodCards.splice(index, 1);

            return true;
        }

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
        // Check if this is a player in the players list
        if (this.current_players.includes(to_remove)) {
            // Removes the player
            let index = this.current_players.indexOf(to_remove);
            this.current_players.splice(index, 1);

            this._cur_players -= 1;

            return true;
        }

        return false;
    }

    // Changes the owner of the game and updates the information
    // This is effectively removePlayer for the owner
    // Note: cur_players must be > 1. This is taken for granted
    newOwner() {
        // Set new owner
        this._name = this.current_players[0];
        // Remove chosen new owner from play
        this.current_players.splice(0, 1);
        this._cur_players -= 1;
    }

    missionFormat() {
        if (this.max_players == 5) {
            this._missionRounds = [2, 3, 2, 3, 3];
        } else if (this.max_players == 6) {
            this._missionRounds = [2, 3, 4, 3, 4];
        } else if (this.max_players >= 7 && this.max_players <= 10) {
            this._missionRounds = [3, 4, 4, 5, 5];
        }
    }

    vote(vote) {
        this._votes.push(vote);

        if (this._votes.length != this._max_players) {
            return '';
        }

        return this.partyVote(this._votes) ? "Approved" : "Rejected";
    }

    partyVote(votes) {
        // votes is an array of "approve" or "reject" strings, which are determined by individual players choosing to either confirm or reject the proposed team for a mission
        let approvalVotes = 0;
        let rejectionVotes = 0;
    
        // Loop through the votes array and count approval and rejection votes
        // Implementing it this way allows votes to come in in any order without having to sort.
        for (let vote of votes) {
            if (vote === "approve") {
                approvalVotes++;
            } else if (vote === "reject") {
                rejectionVotes++;
            }
        }
    
        this._votes = [];
        // Return false if rejection votes are strictly greater than approval votes (need majority to pass)
        if (rejectionVotes > approvalVotes) {
            return false;
        }
    
        return true;
    }

    missionVote(vote) {
        this._missionVotes.push(vote);

        if (this._missionVotes.length != this._missionPlayers.length) {
            return "";
        }

        return this.missionSuccess(this._missionVotes, this._currentRound);
    }

    missionSuccess(votes, currentRound) {
        let approvalVotes = 0;
        let rejectionVotes = 0;
    
        for (let vote of votes) {
            if (vote === "approve") {
                approvalVotes++;
            } else if (vote === "reject") {
                rejectionVotes++;
            }
        }
    
        this._currentRound += 1;

        this._missionVotes = [];

        // Return false if 
        if (rejectionVotes >= 1 && currentRound != 3) {
            this.history.push('E');
            let bool = this.evilWon() || this.goodWon();
            return [false, rejectionVotes, approvalVotes, bool];
        }
        else if (rejectionVotes >=2 && currentRound == 3) {
            this.history.push('E');
            let bool = this.evilWon() || this.goodWon();
            return [false, rejectionVotes, approvalVotes, bool];
        }
    
        this.history.push('G');
        let bool = this.evilWon() || this.goodWon();
        return [true, rejectionVotes, approvalVotes, bool];

    }

    nextLeader() {
        // If leader is host
        if (this._leader == this._name) {
            this._leader = this.current_players[0];

            // After setting a new leader the discussion period is started again
            this._newTime = discussionTime + scaleUpTime * this._currentRound;
            this._currentPeriod = periods[0];
            return;
        }

        let index = this.current_players.indexOf(this._leader);
        index = (index + 1) % this.current_players.length;

        // Wrap around
        if (index == 0) {
            this._leader = this._name;

            // After setting a new leader the discussion period is started again
            this._newTime = discussionTime + scaleUpTime * this._currentRound;
            this._currentPeriod = periods[0];
            return;
        } 

        this._leader = this.current_players[index];

        // After setting a new leader the discussion period is started again
        this._newTime = discussionTime + scaleUpTime * this._currentRound;
        this._currentPeriod = periods[0];
    }

    evilWon() {
        return this.history.filter(win => win == 'E').length >= 3;
    }

    goodWon() {
        return this.history.filter(win => win == 'G').length >= 3;
    }

}