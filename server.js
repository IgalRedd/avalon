const express = require('express');
const ws = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 8000;

const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');

const server = http.createServer(app);
const wss = new ws.Server({ server: server });

/*
 * This will handle API calls
 * All API calls will be in the format of: API <name>:<data>
 */
wss.on('connect', (socket) => {
    wss.on('message', (message) => {
        ; // Nothing yet, this will handle API calls
    });
});



function lobbyEJS(res) {
    return res.render('lobby', {});
}

// Function to just handle routing of EJS files
// Expects files in the form of: <name>.ejs
function resolveEJS(pathName, res) {
    // TODO: update this to work with subdirectories?
    switch (pathName) {
        case "views/lobby.ejs":
            lobbyEJS(res);
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
            filePath = "./views/lobby.ejs";
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

        if (resolveEJS(filePath.slice(2), res)) {
            res.status(404);
            return res.send("Attempting to access unknown files");
        }
    } catch (err) {
        res.status(404);
        return res.send("Attempting to access unknown files");
    }
});

server.listen(PORT, () => {
    console.log("Server is up!");
});