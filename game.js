let playerName = "Pilot"; // This stores the name from the prompt later
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let selectedShipSrc = 'rocket.png';
const rocketImg = new Image();
rocketImg.src = 'rocket.png';

let player = { x: canvas.width/2, y: canvas.height/2, size: 35, angle: 0 };
let mouse = { x: canvas.width/2, y: canvas.height/2 };
let enemies = [];
let gameActive = false, isPaused = false;
let activityLog = [];
let score = 0, difficulty = 1;
let highScore = localStorage.getItem('sentronHigh') || 0;

let lastPulse = Date.now(), lastSuper = Date.now();
let lastScoreUpdate = 0; 
let nextBoss = Date.now() + 180000; 
let flashColor = null, flashTimer = 0, isSuperActive = false;


function selectShip(src, id) {
    selectedShipSrc = src;
    document.querySelectorAll('.ship-choice').forEach(img => img.classList.remove('selected'));
    document.getElementById(id).classList.add('selected');
    logActivity("Ship selected: " + id)
}

window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => {
    if (!gameActive || isPaused) return;
    if (e.button === 0) triggerPulse(false); 
    if (e.button === 2) triggerPulse(true);  
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => { if(e.key === 'Escape') togglePause(); });

function initGame(level) {
    const modes = {1: "EASY", 2: "MEDIUM", 3: "HARD"};
    difficulty = level;
    logActivity("System Initialized: " + modes[difficulty] + " MODE");
    rocketImg.src = selectedShipSrc;
    document.getElementById('startMenu').style.display = 'none';
    gameActive = true;
    score = 0;
    lastScoreUpdate = Date.now(); 
    document.getElementById('hscr').innerText = Math.floor(highScore);
    animate();
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'block' : 'none';
    if (isPaused) {
        logActivity("SYSTEM PAUSED: Tactical Break");
    } else {
        logActivity("SYSTEM RESUMED: Combat Continuing");
    }
}

function spawnEnemy(isBoss = false) {
    if (isBoss) {
        logActivity("BOSS DETECTED: SENTRON ELITE UNIT");
    }
    const size = isBoss ? 95 : 28;
    const speed = isBoss ? 0.7 : 1.3 + (difficulty * 0.8);
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -size : canvas.width + size;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? -size : canvas.height + size;
    }
    enemies.push({ x, y, size, speed, isBoss });
}

function triggerPulse(isSuper) {
    if (isSuper) {
    logActivity("Super Pulse Activated!");
} else {
    logActivity("Pulse Activated!");
}
    const now = Date.now();
    const cooldown = isSuper ? 30000 : 7000;
    const lastTime = isSuper ? lastSuper : lastPulse;
    const range = isSuper ? 550 : 280;

    if (now - lastTime >= cooldown) {
        enemies = enemies.filter(en => {
            const dist = Math.hypot(player.x - en.x, player.y - en.y);
            if (dist < range) {
                if (en.isBoss && !isSuper) return true; 
                // Removed score addition here so pulse doesn't give points
                return false;
            }
            return true;
        });

        flashColor = isSuper ? "#ffff00" : "#00f2ff";
        flashTimer = 30; 
        isSuperActive = isSuper;
        if (isSuper) lastSuper = now; else lastPulse = now;
    }
}

// This function runs when the user clicks "Continue" on the Rules box
function closeRules() {
    let nameInput = prompt("ENTER PILOT IDENTIFICATION:", "Pilot");
    playerName = nameInput ? nameInput : "Guest";
    
    // 1. Hide the rules
    document.getElementById('rulesOverlay').style.display = 'none';
    
    // 2. SHOW the Start Menu (This prevents the freeze!)
    // Make sure 'startMenu' matches the ID in your HTML
    document.getElementById('startMenu').style.display = 'block';
    
    logActivity("JOINED THE BATTLE"); 
}


function update() {
    if (!gameActive || isPaused) return;

    let now = Date.now();

    // STRICT SURVIVAL SCORE: Exactly 1 point per 1 second
    if (now - lastScoreUpdate >= 500
    ) {
        score += 1;
        lastScoreUpdate = now;
    }
    
    player.x += (mouse.x - player.x) * 0.12 + (Math.random() - 0.5) * 5;
    player.y += (mouse.y - player.y) * 0.12 + (Math.random() - 0.5) * 5;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;

    document.getElementById('pCharge').innerText = (now - lastPulse >= 7000) ? "READY" : Math.ceil((7000 - (now - lastPulse))/1000) + "s";
    document.getElementById('sCharge').innerText = (now - lastSuper >= 30000) ? "READY" : Math.ceil((30000 - (now - lastSuper))/1000) + "s";
    
    if (now > nextBoss) { spawnEnemy(true); nextBoss = now + 180000; }
    if (Math.random() < 0.04 + (difficulty * 0.02)) spawnEnemy();

    enemies.forEach(en => {
        const dist = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x) / dist) * en.speed;
        en.y += ((player.y - en.y) / dist) * en.speed;
        if (dist < player.size * 0.8 + en.size) {
    gameActive = false;
    logActivity("CRITICAL: PLAYER ELIMINATED - Score: " + score); // Add this!
    }
    });

    document.getElementById('scr').innerText = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('sentronHigh', highScore);
        document.getElementById('hscr').innerText = highScore;
    }
    
    if (!gameActive) document.getElementById('gameOver').style.display = 'block';
}

function draw() {
    ctx.fillStyle = '#000510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (flashTimer > 0) {
        ctx.save();
        let maxRange = isSuperActive ? 600 : 320;
        let progress = 1 - (flashTimer / 30);
        ctx.shadowBlur = 15;
        ctx.shadowColor = flashColor;
        ctx.strokeStyle = flashColor;
        for (let i = 1; i <= 5; i++) {
            let ringP = progress * (1 + i * 0.2); 
            if (ringP > 1) ringP = 1;
            ctx.beginPath();
            ctx.arc(player.x, player.y, maxRange * ringP, 0, Math.PI * 2);
            ctx.lineWidth = 6 * (1 - ringP);
            ctx.globalAlpha = 1 - ringP;
            ctx.stroke();
        }
        ctx.restore();
        flashTimer--;
    }

    enemies.forEach(en => {
        ctx.beginPath();
        ctx.arc(en.x, en.y, en.size, 0, Math.PI*2);
        ctx.shadowBlur = 25;
        ctx.shadowColor = en.isBoss ? "#bc13fe" : "#ff0000"; // Purple Boss vs Red Neon
        ctx.fillStyle = en.isBoss ? "#bc13fe" : "#ff0000";
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.drawImage(rocketImg, -player.size, -player.size, player.size*2, player.size*2);
    ctx.restore();
}

function animate() {
    update();
    draw();
    if (gameActive) requestAnimationFrame(animate);
}
// This function sends the data to your Python Logger
async function logActivity(action) {
    try {
        await fetch("https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log", {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                "player": playerName, 
                "action": action 
            })
        });
    } catch (e) {
        console.log("Logger is offline or Port 8001 is Private.");
    }
}
function quitGame() {
    logActivity("SESSION TERMINATED: User Quit");
    
    // This part actually "quits" by reloading the game
    setTimeout(() => {
        location.reload();
    }, 500); // 500ms delay so the log has time to send!
}