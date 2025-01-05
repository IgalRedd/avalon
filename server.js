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
            break;
    }

    socket.on('message', (message) => {
        ; // Nothing yet, this will handle API calls
    });

    socket.on('close', () => {
        // TODO: kick sockets out of arrays
    });
});


function lobbyEJS(res) {
    return res.render('lobby/lobby', {unreadyGames: notStartedGames});
}

// Args should be just [<username>]
function pregameEJS(res, args) {
    // TODO: filter properly the username

    let game = new GameAttributes(args[0]);
    // Add the game to the list
    notStartedGames.push(game);

    // Inform the players in the lobby of the new game
    wss.clients.forEach((client) => {
        if (client.room == "lobby") {
            client.send("API new_game;" + JSON.stringify(game));
        }
    });
        
    return res.render('pregame/pregame', {username: args[0]})
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
        
        default:
            return true;
    }
}

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

class GameAttributes {
    constructor(name) {
        this._name = name;
        this._cur_players = 1;
        this._max_players = 5;
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
}