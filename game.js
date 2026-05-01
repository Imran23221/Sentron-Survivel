let playerName = "Pilot";
let sessionStarted = false;
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
let score = 0, difficulty = 1;
let highScore = localStorage.getItem('sentronHigh') || 0;

let lastPulse = Date.now(), lastSuper = Date.now();
let lastScoreUpdate = 0; 
let nextBoss = Date.now() + 180000; 
let flashColor = null, flashTimer = 0, isSuperActive = false;

// --- FIX 1: NEON LOGIN LOGIC ---
function finalizeLogin() {
    const input = document.getElementById('playerInput').value;
    playerName = input.trim() !== "" ? input : "Pilot";
    
    // Hide login, show ship selection
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('startMenu').style.display = 'block';
    
    sessionStarted = true;
    logActivity("JOINED THE BATTLE");
}

function selectShip(src, id) {
    selectedShipSrc = src;
    document.querySelectorAll('.ship-choice').forEach(img => img.classList.remove('selected'));
    const element = document.getElementById(id);
    if(element) element.classList.add('selected');
    logActivity("Ship selected: " + id);
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
    document.getElementById('modeMenu').style.display = 'none'; // Ensure modes hide
    gameActive = true;
    score = 0;
    lastScoreUpdate = Date.now(); 
    document.getElementById('hscr').innerText = Math.floor(highScore);
    animate();
}

// --- FIX 2: GAME OVER FUNCTION ---
function gameOver() {
    gameActive = false;
    logActivity("CRITICAL: PLAYER ELIMINATED - Score: " + score);
    
    // Hide game UI elements
    document.getElementById('gameOver').style.display = 'none';
    
    // Return to ship selection (Start Menu)
    document.getElementById('startMenu').style.display = 'block';
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'block' : 'none';
    logActivity(isPaused ? "SYSTEM PAUSED" : "SYSTEM RESUMED");
}

function spawnEnemy(isBoss = false) {
    if (isBoss) logActivity("BOSS DETECTED: SENTRON ELITE UNIT");
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
    const now = Date.now();
    const cooldown = isSuper ? 30000 : 7000;
    const lastTime = isSuper ? lastSuper : lastPulse;
    const range = isSuper ? 550 : 280;

    if (now - lastTime >= cooldown) {
        logActivity(isSuper ? "Super Pulse Activated!" : "Pulse Activated!");
        enemies = enemies.filter(en => {
            const dist = Math.hypot(player.x - en.x, player.y - en.y);
            if (dist < range) {
                if (en.isBoss && !isSuper) return true; 
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

function update() {
    if (!gameActive || isPaused) return;

    let now = Date.now();
    if (now - lastScoreUpdate >= 1000) {
        score += 1;
        lastScoreUpdate = now;
    }
    
    player.x += (mouse.x - player.x) * 0.12;
    player.y += (mouse.y - player.y) * 0.12;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;

    document.getElementById('pCharge').innerText = (now - lastPulse >= 7000) ? "READY" : Math.ceil((7000 - (now - lastPulse))/1000) + "s";
    document.getElementById('sCharge').innerText = (now - lastSuper >= 30000) ? "READY" : Math.ceil((30000 - (now - lastSuper))/1000) + "s";
    
    if (now > nextBoss) { spawnEnemy(true); nextBoss = now + 180000; }
    if (Math.random() < 0.04 + (difficulty * 0.02)) spawnEnemy();

    enemies.forEach(en => {
        const dist = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x) / dist) * en.speed;
        en.y += ((player.y - en.y) / dist) * en.speed;
        
        // --- TRIGGER NEW GAME OVER ---
        if (dist < player.size * 0.8 + en.size) {
            gameOver();
        }
    });

    document.getElementById('scr').innerText = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('sentronHigh', highScore);
        document.getElementById('hscr').innerText = highScore;
    }
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
        ctx.beginPath();
        ctx.arc(player.x, player.y, maxRange * progress, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        flashTimer--;
    }

    enemies.forEach(en => {
        ctx.beginPath();
        ctx.arc(en.x, en.y, en.size, 0, Math.PI*2);
        ctx.fillStyle = en.isBoss ? "#bc13fe" : "#ff0000";
        ctx.fill();
    });

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.drawImage(rocketImg, -player.size, -player.size, player.size*2, player.size*2);
    ctx.restore();
}

function animate() {
    if (gameActive) {
        update();
        draw();
        requestAnimationFrame(animate);
    }
}

async function logActivity(action) {
    try {
        await fetch("https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log", {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ "player": playerName, "action": action })
        });
    } catch (e) {
        console.log("Logger offline.");
    }
}

function quitGame() {
    logActivity("SESSION TERMINATED: User Quit");
    setTimeout(() => { location.reload(); }, 500);
}