let playerParty = [];
let currentMission = 0; // TODO: add this to form adn dynmaically get it

// Set yourself as the leader
function makeLeader() {
    let username = document.getElementById('username').value;
    let leaderName = document.getElementById('leader').value;
    let players = document.querySelectorAll('.players');

    for (let i = 0; i < players.length; i++) {
        if (players[i].innerHTML == leaderName) {
            players[i].style.fontWeight = 'bold';
        }

        if (username == leaderName) {
            players[i].onclick = () => {click(players[i].innerHTML)};
            players[i].classList.add("clickable");
        }
    }

    if (username == leaderName) {
        document.getElementById("confirm-party").style.display = 'inline-block';
    }
}

// Remove yourself as a leader
function removeLeader() {
    let players = document.querySelectorAll('.players');

    // Remove clickability
    for (let i = 0; i < players.length; i++) {
        players[i].style.fontWeight = 'normal';
        players[i].onclick = null;
        players[i].classList.remove("clickable");
    }

    document.getElementById("confirm-party").style.display = 'none';
}

function click(name) {
    let username = document.getElementById('username').value;
    let leaderName = document.getElementById('leader').value;

    if (playerParty.includes(name)) {
        let index = playerParty.indexOf(name);
        playerParty.splice(index, 1);

        // Remove from HTML
        let partyHTML = document.getElementById('party-members').children;
        for (let i = 0; i < partyHTML.length; i++) {
            if (name == partyHTML[i].innerHTML) {
                partyHTML[i].remove();
                break;
            }
        }

        if (username == leaderName) {
            socket.send("API remove_player_party;" + name);
        }
        return;
    }

    let missionSize = parseInt(document.getElementById('missionRounds').value.split(',')[currentMission]);
    if (playerParty.length >= missionSize) {
        return; // Party size too big, can't add
    }

    playerParty.push(name);
    let partyHTML = document.getElementById('party-members');
    let pTag = document.createElement('p');
    pTag.innerHTML = name;
    partyHTML.appendChild(pTag);

    if (username == leaderName) {
        socket.send("API add_player_party;" + name);
    }
}

function confirmParty() {
    let missionSize = parseInt(document.getElementById('missionRounds').value.split(',')[currentMission]);
    let username = document.getElementById('username').value;
    let leaderName = document.getElementById('leader').value;

    if (missionSize != playerParty.length || username != leaderName) {
        return;
    }

    socket.send("API party_confirmed;" + playerParty.join(','));
}

function setupRoundtable() {
    let space = document.getElementById('game-space');
    let tags = space.querySelectorAll('.players');

    // Even angles across all tags
    let angle = (Math.PI * 2) / tags.length;
    const rad = 35; // In view-height

    for (let i = 0; i < tags.length; i++) {
        let x = Math.cos(angle * i) * rad * 1.05;
        let y = Math.sin(angle * i) * rad * 1.05;

        // x + rad because left is from very left so + rad to go to circle midpoint then + x from there
        tags[i].style.left = `${x + rad}vh`;
        tags[i].style.top = `${y + rad}vh`;
    }

    let partySelectDiv = document.getElementById('party-selection');
    partySelectDiv.style.left = "33vh";
    partySelectDiv.style.top = "28vh";
}

// To begin voting on the party
function startVote() {
    removeLeader();

    document.getElementById('voting-buttons').style.display = 'inline-block'
}

function partyVote(vote) {
    socket.send("API party_vote;" + vote);

    document.getElementById('voting-buttons').style.display = 'none';
    let voteText = document.getElementById('selection');
    voteText.style.display = 'inline-block';
    
    if (vote) {
        voteText.innerHTML = "Accepted";
        voteText.style.color = '#1c8c21';
    } else {
        voteText.innerHTML = "Rejected";
        voteText.style.color = '#ad0505';
    }
}

const host = window.location.hostname;
// Need to do this for port since if its default port an empty string with : would break the URL
const port = window.location.port ? `:${window.location.port}` : '';

let socket = null;

window.onload = function() {
    currentMission = parseInt(document.getElementById('currentRound').value);

    setupRoundtable();
    makeLeader();

    let owner = document.getElementById('owner').value;
    socket = new WebSocket(`ws://${host + port}/game?lobby=${owner}&username=${username}`);

    socket.addEventListener('message', (message) => {
        let data = message.data.split(';');
        let params = data[0].split(' ');
    
        if (params[0] !== "API") {
            return;
        }

        let username = document.getElementById('username').value;
        let leaderName = document.getElementById('leader').value;
        switch(params[1]) {
            case "add_player_party":
                if (username == leaderName) {
                    return;
                }
                click(data[1]);
                break;

            case "remove_player_party":
                if (username == leaderName) {
                    return;
                }
                click(data[1]);
                break;

            case "start_vote":
                startVote();
                break;

            case "timer_update":
                document.getElementById('timer').innerHTML = data[1];
                break;

            case "timeout":
                const periods = ["Discussion", "PartyVoting", "MissionVoting"];
                switch (data[1]) {
                    case periods[0]:
                        // Leader couldn't decide on a party fast enough
                        if (username == leaderName) {
                            socket.send("API give_new_leader;");
                        }
                        break;

                    case periods[1]:
                        if (document.getElementById('voting-buttons').style.display != 'none') {
                            partyVote(true); // Default accept
                        }
                        break;
                }
                break;
        
            case "new_leader":
                // Set new leader
                document.getElementById('leader').value = data[1];
                // Remove old leader and set new one
                removeLeader();
                makeLeader();
                break;

            case "party_rejected":
                // Set new leader
                document.getElementById('leader').value = data[1];
                // Remove old leader and set new one
                removeLeader();
                makeLeader();

                // Clear out the vote, party and party display
                document.getElementById('selection').innerHTML = '';
                playerParty = [];
                document.getElementById('party-members').innerHTML = '';

                document.getElementById('informative').innerHTML = "Party rejected!";
                // After 15 seconds remove the text
                setTimeout(() => {
                    document.getElementById('informative').innerHTML = '';
                }, 15000);
                break;
        }
    });
}