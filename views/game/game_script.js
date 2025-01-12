let playerParty = [];
let currentMission = 0; // TODO: add this to form adn dynmaically get it

// Set yourself as the leader
function makeLeader() {
    let players = document.querySelectorAll('.players');

    for (let i = 0; i < players.length; i++) {
        players[i].onclick = () => {click(players[i].innerHTML)};
        players[i].classList.add("clickable");
    }

    document.getElementById("confirm-party").style.display = 'inline-block';
}

// Remove yourself as a leader
function removeLeader() {
    let players = document.querySelectorAll('.players');

    // Remove clickability
    for (let i = 0; i < players.length; i++) {
        players[i].onclick = null;
        players[i].classList.remove("clickable");
    }

    document.getElementById("confirm-party").style.display = 'none';
}

function click(name) {
    let username = document.getElementById('username').value;
    let leaderName = document.getElementById('leader').value;

    if (username != leaderName) {
        return;
    }

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

        // TODO: send to server to tell others
        return;
    }

    let missionSize = parseInt(document.getElementById('missionRounds').value.split(',')[currentMission]);
    console.log(missionSize);
    if (playerParty.length >= missionSize) {
        return; // Party size too big, can't add
    }

    playerParty.push(name);
    let partyHTML = document.getElementById('party-members');
    let pTag = document.createElement('p');
    pTag.innerHTML = name;
    partyHTML.appendChild(pTag);
    // TODO: inform server + add it to HMTL
}

function confirmParty() {
    let missionSize = parseInt(document.getElementById('missionRounds').value.split(',')[currentMission]);
    let username = document.getElementById('username').value;
    let leaderName = document.getElementById('leader').value;

    if (missionSize != playerParty.length || username != leaderName) {
        return;
    }

    ; // TODO: send to server and wait for it to tell us to start the voting
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

window.onload = function() {
    setupRoundtable();

    let username = document.getElementById('username').value;
    let leaderName = document.getElementById('leader').value;
    if (username == leaderName) {
        makeLeader();

        let players = document.querySelectorAll('.players');
        for (let i = 0; i < players.length; i++) {
            // Searches for you to bold your name
            if (username == players[i].innerHTML) {
                players[i].style.fontWeight = 'bold';
                break;
            }
        }
    }
}