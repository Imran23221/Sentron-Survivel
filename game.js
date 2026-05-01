const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let playerName = "Pilot";
let gameActive = false;
let isPaused = false;
let score = 0;
let difficulty = 1;
let selectedShipSrc = 'rocket.png';
const shipImg = new Image();

// Game Objects
let player = { x: canvas.width/2, y: canvas.height/2, size: 38, angle: 0 };
let enemies = [];
let particles = [];
let mouse = { x: canvas.width/2, y: canvas.height/2 };

// Logic Timers
let lastPulse = 0, lastSuper = 0, lastScoreTime = 0;
let nextBossTime = 0, flashEffect = { timer: 0, color: '#fff', size: 0 };

// --- MENU FLOW ---
function showLogin() {
    document.getElementById('rulesOverlay').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
}

function goToShipSelect() {
    const val = document.getElementById('playerInput').value.trim();
    playerName = val || "Pilot";
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('shipMenu').style.display = 'flex';
    logActivity("LOGGED IN");
}

function pickShip(src, id) {
    selectedShipSrc = src;
    document.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(id).classList.add('selected');
}

function startGame(level) {
    difficulty = level;
    shipImg.src = selectedShipSrc;
    document.getElementById('shipMenu').style.display = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    score = 0;
    enemies = [];
    particles = [];
    gameActive = true;
    isPaused = false;
    lastPulse = Date.now();
    lastSuper = Date.now();
    lastScoreTime = Date.now();
    nextBossTime = Date.now() + 45000;
    
    logActivity(`MISSION START: ${playerName}`);
    requestAnimationFrame(gameLoop);
}

// PAUSE LOGIC
function togglePause() {
    if (!gameActive) return;
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'flex' : 'none';
    if (!isPaused) requestAnimationFrame(gameLoop);
    logActivity(isPaused ? "PAUSED" : "RESUMED");
}

window.addEventListener('keydown', e => {
    if (e.key === "Escape") togglePause();
});

function gameOver() {
    gameActive = false;
    document.getElementById('finalScoreDisplay').innerText = score;
    document.getElementById('gameOverScreen').style.display = 'flex';
    logActivity(`DIED at Score: ${score}`);
}

function backToMenu() {
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('shipMenu').style.display = 'flex';
}

// --- GAMEPLAY MECHANICS ---
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => {
    if (!gameActive || isPaused) return;
    if (e.button === 0) triggerPulse(false);
    if (e.button === 2) triggerPulse(true);
});
window.addEventListener('contextmenu', e => e.preventDefault());

function spawnEnemy(isBoss = false) {
    const size = isBoss ? 110 : 30;
    const speed = isBoss ? 0.9 : (1.6 + (difficulty * 0.7));
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -size : canvas.width + size;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? -size : canvas.height + size;
    }
    enemies.push({ x, y, size, speed, isBoss, rot: Math.random() * Math.PI });
}

function triggerPulse(isSuper) {
    const now = Date.now();
    const cd = isSuper ? 25000 : 6000;
    const last = isSuper ? lastSuper : lastPulse;
    const range = isSuper ? 600 : 300;

    if (now - last >= cd) {
        flashEffect = { timer: 25, color: isSuper ? '#ffff00' : '#00f2ff', size: range };
        enemies = enemies.filter(en => {
            const dist = Math.hypot(player.x - en.x, player.y - en.y);
            if (dist < range) {
                if (en.isBoss && !isSuper) return true;
                return false;
            }
            return true;
        });
        if (isSuper) lastSuper = now; else lastPulse = now;
    }
}

function update() {
    if (!gameActive || isPaused) return;

    player.x += (mouse.x - player.x) * 0.12;
    player.y += (mouse.y - player.y) * 0.12;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;

    if (Date.now() - lastScoreTime > 1000) {
        score++;
        lastScoreTime = Date.now();
        document.getElementById('scr').innerText = score;
    }

    const pWait = Math.max(0, Math.ceil((6000 - (Date.now() - lastPulse))/1000));
    const sWait = Math.max(0, Math.ceil((25000 - (Date.now() - lastSuper))/1000));
    document.getElementById('pCharge').innerText = pWait === 0 ? "READY" : pWait + "S";
    document.getElementById('sCharge').innerText = sWait === 0 ? "READY" : sWait + "S";

    if (Math.random() < 0.04 + (difficulty * 0.01)) spawnEnemy(false);
    if (Date.now() > nextBossTime) { spawnEnemy(true); nextBossTime = Date.now() + 45000; }

    enemies.forEach((en, i) => {
        const d = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x) / d) * en.speed;
        en.y += ((player.y - en.y) / d) * en.speed;
        if (d < (player.size * 0.7) + (en.size * 0.7)) gameOver();
    });
}

function draw() {
    ctx.fillStyle = 'rgba(0, 5, 15, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    enemies.forEach(en => {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.rotate(en.rot);
        ctx.shadowBlur = en.isBoss ? 20 : 10;
        ctx.shadowColor = en.isBoss ? '#bc13fe' : '#ff0044';
        ctx.fillStyle = en.isBoss ? '#bc13fe' : '#ff0044';
        if (en.isBoss) ctx.fillRect(-en.size/2, -en.size/2, en.size, en.size);
        else {
            ctx.beginPath(); ctx.moveTo(0, -en.size/2); ctx.lineTo(en.size/2, en.size/2); ctx.lineTo(-en.size/2, en.size/2); ctx.fill();
        }
        ctx.restore();
    });

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.shadowBlur = 15; ctx.shadowColor = '#00f2ff';
    ctx.drawImage(shipImg, -player.size, -player.size, player.size*2, player.size*2);
    ctx.restore();

    if (flashEffect.timer > 0) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, flashEffect.size * (1 - flashEffect.timer/25), 0, Math.PI*2);
        ctx.strokeStyle = flashEffect.color;
        ctx.lineWidth = flashEffect.timer;
        ctx.stroke();
        flashEffect.timer--;
    }
}

function gameLoop() {
    update();
    draw();
    if (gameActive && !isPaused) requestAnimationFrame(gameLoop);
}

async function logActivity(action) {
    try {
        await fetch("https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log", {
            method: "POST", mode: "cors", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ "player": playerName, "action": action })
        });
    } catch (e) { }
}