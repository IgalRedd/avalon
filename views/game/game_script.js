function setupRoundtable() {
    let space = document.getElementById('game-space');
    let tags = space.querySelectorAll('p');

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
}

window.onload = function() {
    setupRoundtable();
}