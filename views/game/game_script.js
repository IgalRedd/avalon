let playerParty = [];
let currentMission = 0;

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

    let missionSelectDiv = document.getElementById('mission-selection');
    missionSelectDiv.style.left = "33vh";
    missionSelectDiv.style.top = "28vh";

    let winningDiv = document.getElementById('winner-div');
    winningDiv.style.left = '22vh';
    winningDiv.style.top = '28vh';
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

function missionVote(vote) {
    if (!playerParty.includes(document.getElementById("username").value)) {
        return;
    }

    socket.send("API mission_vote;" + vote);

    document.getElementById("party-info").style.display = 'none';
    document.getElementById("non-party-info").innerHTML = `You have voted to ${vote ? "approve" : "reject"}`;

}

function assassinate(name) {
    // TODO: verify ur assassin?
    socket.send("API assassinate;" + name);
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
                    case periods[2]:
                        if (playerParty.includes(document.getElementById("username").value)) {
                            if (document.getElementById('party-info').style.display != 'none') {
                                missionVote(true);
                            }
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

            case "party_accepted":

                document.getElementById("party-selection").style.display = 'none';
                document.getElementById("mission-selection").style.display = 'flex';

                if (!playerParty.includes(document.getElementById("username").value)) {
                    document.getElementById("party-info").style.display = 'none';
                    document.getElementById("non-party-info").innerHTML = "Party members are voting on mission, please wait";
                }

                else {
                    document.getElementById("non-party-info").innerHTML = "Please vote to Accept or Reject the mission";
                    document.getElementById("party-info").style.display = 'inline-block';
                }

                break;
            
            case "mission_voted":
                let args = data[1].split(',');

                let missions = document.querySelectorAll("p[data-mission]");

                for (let i = 0; i < missions.length; i++) {
                    if (missions[i].getAttribute("data-mission") == currentMission.toString()) {
                        let text = `<span style='color: #1c8c21;'>${args[2]}</span> vs <span style='color: #ad0505;'>${args[1]}</span><br>`;
                        for (let j = 0; j < playerParty.length; j++) {
                            text += `${playerParty[j]}<br>`;
                        }
                        missions[i].innerHTML = text;
                        break;
                    }
                }

                let missionDisplays = document.querySelectorAll("div[data-mission]");

                for (let i = 0; i < missionDisplays.length; i++) {
                    if (missionDisplays[i].getAttribute("data-mission") == currentMission.toString()) {
                        if (args[0] == "true") {
                            missionDisplays[i].classList.add("mission-passed");
                        }
                        else {
                            missionDisplays[i].classList.add("mission-failed");
                        }
                    }
                }

                currentMission += 1;

                playerParty = [];

                document.getElementById("party-selection").style.display = 'flex';
                document.getElementById("mission-selection").style.display = 'none';
                document.getElementById("party-members").innerHTML = "";
                document.getElementById("selection").innerHTML = "";

                if (username == leaderName && args[3] != 'true') {
                    socket.send("API give_new_leader;");   
                }

                break;

            case "game_finished":
                removeLeader();

                document.getElementById('timer').innerHTML = '';

                let passedArgs = data[1].split('@');
                let dictionary = JSON.parse(passedArgs[1]);
                const evils = ["Oberon", "Mordred", "Morgana", "MinionsofMordred", "Assassin"];

                let players = document.querySelectorAll('.players');
                for (let i = 0; i < players.length; i++) {
                    if (evils.includes(dictionary[players[i].innerHTML].card)) {
                        players[i].classList.add('evil-card');
                    }
                }

                document.getElementById('party-selection').style.display = 'none';

                document.getElementById('winner-div').style.display = 'flex';
                if (passedArgs[0] == 'G') {
                    document.getElementById('evil-explainer').style.display = 'inline-block';

                    // If player is assassin then he can click on people to choose as Merlin
                    if (dictionary[document.getElementById('username').value].card == "Assassin") {
                        for (let i = 0; i < players.length; i++) {
                            players[i].classList.add('clickable');
                            players[i].onclick = () => {assassinate(players[i].innerHTML)};
                        }
                    }   
                } else {
                    document.getElementById('winnerText').style.display = 'inline-block';
                    document.getElementById('winnerText').style.color = '#ad0505';
                    document.getElementById('winnerText').innerHTML = "Evil won!"
                    document.getElementById('leave-button').style.display = 'inline-block';
                }

                break;
            
            case "assassinate":
                removeLeader(); // To make everyone unclickable for the assassin

                let names = data[1].split(',');

                // If assassin got it right
                if (names[0] == names[1]) {
                    document.getElementById('winnerText').style.display = 'inline-block';
                    document.getElementById('winnerText').style.color = '#ad0505';
                    document.getElementById('winnerText').innerHTML = "Evil won!"
                    document.getElementById('leave-button').style.display = 'inline-block';
                    document.getElementById('assassinate-text').innerHTML = `Merlin was ${names[1]} <br>Assassin chose: ${names[0]}`;
                    return;
                }

                document.getElementById('winnerText').style.display = 'inline-block';
                document.getElementById('winnerText').style.color = '#1c8c21';
                document.getElementById('winnerText').innerHTML = "Good won!"
                document.getElementById('leave-button').style.display = 'inline-block';
                document.getElementById('assassinate-text').innerHTML = `Merlin was ${names[1]} <br>Assassin chose: ${names[0]}`;
                return;
        }
    });
}