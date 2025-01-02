const ejs = require('ejs');
const express = require('express');
const ws = require('ws');
const http = require('http');

const PORT = 8000;

const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');

const server = http.createServer(app);
const wss = new ws.Server({ server: server });

// Temporarily reroute all to the one view
app.all('*', (req, res) => {
    res.render('lobby', {});
});

server.listen(PORT, () => {
    console.log("Server is up!");
});