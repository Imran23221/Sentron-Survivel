// --- CONFIGURATION & STATE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let playerName = "Unknown";
let gameActive = false;
let isPaused = false;
let score = 0;
let difficulty = 1;
let highScore = localStorage.getItem('sentronHigh') || 0;

let selectedShipSrc = 'rocket.png';
const shipImg = new Image();

// Game Objects
let player = { x: canvas.width/2, y: canvas.height/2, size: 38, angle: 0, targetX: 0, targetY: 0 };
let enemies = [];
let particles = [];
let mouse = { x: canvas.width/2, y: canvas.height/2 };

// Cooldowns
let lastPulse = 0;
let lastSuper = 0;
let lastScoreTime = 0;
let nextBossTime = Date.now() + 60000;

// Visual Effects
let screenShake = 0;
let flashEffect = { timer: 0, color: '#fff', size: 0 };

// --- MENU LOGIC ---
function goToShipSelect() {
    const val = document.getElementById('playerInput').value.trim();
    playerName = val || "Pilot";
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('shipMenu').style.display = 'flex';
    logActivity("AUTHENTICATED");
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
    
    // Reset Stats
    score = 0;
    enemies = [];
    particles = [];
    gameActive = true;
    lastPulse = Date.now();
    lastSuper = Date.now();
    lastScoreTime = Date.now();
    
    logActivity(`STARTED MISSION [DIFF: ${level}]`);
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    screenShake = 30;
    
    // Update Score UI
    document.getElementById('finalScoreDisplay').innerText = score;
    let rank = "RECRUIT";
    if (score > 100) rank = "VETERAN";
    if (score > 500) rank = "ACE";
    document.getElementById('rankText').innerText = `RANK: ${rank}`;
    
    document.getElementById('gameOverScreen').style.display = 'flex';
    logActivity(`MISSION FAILED - SCORE: ${score}`);
}

function backToMenu() {
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('shipMenu').style.display = 'flex';
}

// --- INPUTS ---
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => {
    if (!gameActive) return;
    if (e.button === 0) triggerPulse(false);
    if (e.button === 2) triggerPulse(true);
});
window.addEventListener('contextmenu', e => e.preventDefault());

// --- CORE LOGIC ---
function spawnEnemy(isBoss = false) {
    const size = isBoss ? 110 : 30;
    const speed = isBoss ? 0.8 : (1.5 + (difficulty * 0.7));
    const hp = isBoss ? 5 : 1;
    
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? -size : canvas.width + size;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? -size : canvas.height + size;
    }
    enemies.push({ x, y, size, speed, hp, isBoss, rot: Math.random() * Math.PI });
}

function triggerPulse(isSuper) {
    const now = Date.now();
    const cd = isSuper ? 25000 : 6000;
    const last = isSuper ? lastSuper : lastPulse;
    const range = isSuper ? 600 : 300;

    if (now - last >= cd) {
        flashEffect = { timer: 25, color: isSuper ? '#ffff00' : '#00f2ff', size: range };
        screenShake = 15;
        
        enemies = enemies.filter(en => {
            const dist = Math.hypot(player.x - en.x, player.y - en.y);
            if (dist < range) {
                if (en.isBoss && !isSuper) return true; // Normal pulse can't kill boss
                createExplosion(en.x, en.y, en.isBoss ? 40 : 10);
                return false;
            }
            return true;
        });

        if (isSuper) lastSuper = now; else lastPulse = now;
        logActivity(isSuper ? "SUPERNOVA DEPLOYED" : "PULSE EMITTED");
    }
}

function createExplosion(x, y, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: Math.random() > 0.5 ? '#ff0044' : '#ffaa00'
        });
    }
}

function update() {
    if (!gameActive) return;

    // Smooth Follow Physics
    player.x += (mouse.x - player.x) * 0.12;
    player.y += (mouse.y - player.y) * 0.12;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;

    // Score Tick
    if (Date.now() - lastScoreTime > 1000) {
        score++;
        lastScoreTime = Date.now();
        document.getElementById('scr').innerText = score;
    }

    // HUD Updates
    const pWait = Math.max(0, Math.ceil((6000 - (Date.now() - lastPulse))/1000));
    const sWait = Math.max(0, Math.ceil((25000 - (Date.now() - lastSuper))/1000));
    document.getElementById('pCharge').innerText = pWait === 0 ? "READY" : pWait + "S";
    document.getElementById('sCharge').innerText = sWait === 0 ? "READY" : sWait + "S";

    // Spawning
    if (Math.random() < 0.03 + (difficulty * 0.015)) spawnEnemy(false);
    if (Date.now() > nextBossTime) {
        spawnEnemy(true);
        nextBossTime = Date.now() + 45000;
    }

    // Enemy AI & Collision
    enemies.forEach((en, i) => {
        const d = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x) / d) * en.speed;
        en.y += ((player.y - en.y) / d) * en.speed;
        en.rot += 0.02;

        if (d < (player.size * 0.7) + (en.size * 0.7)) {
            gameOver();
        }
    });

    // Particle Physics
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    });

    if (screenShake > 0) screenShake *= 0.9;
}

function draw() {
    ctx.fillStyle = 'rgba(0, 5, 15, 0.3)'; // Motion Blur
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (screenShake > 1) {
        ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    }

    // Draw Particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;

    // Draw Enemies
    enemies.forEach(en => {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.rotate(en.rot);
        ctx.shadowBlur = en.isBoss ? 20 : 10;
        ctx.shadowColor = en.isBoss ? '#bc13fe' : '#ff0044';
        ctx.fillStyle = en.isBoss ? '#bc13fe' : '#ff0044';
        
        if (en.isBoss) {
            ctx.strokeRect(-en.size/2, -en.size/2, en.size, en.size);
            ctx.fillRect(-en.size/4, -en.size/4, en.size/2, en.size/2);
        } else {
            ctx.beginPath();
            ctx.moveTo(0, -en.size/2);
            ctx.lineTo(en.size/2, en.size/2);
            ctx.lineTo(-en.size/2, en.size/2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    });

    // Draw Player
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f2ff';
    ctx.drawImage(shipImg, -player.size, -player.size, player.size*2, player.size*2);
    ctx.restore();

    // Pulse Effect
    if (flashEffect.timer > 0) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, flashEffect.size * (1 - flashEffect.timer/25), 0, Math.PI*2);
        ctx.strokeStyle = flashEffect.color;
        ctx.lineWidth = flashEffect.timer;
        ctx.stroke();
        flashEffect.timer--;
    }

    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    if (gameActive) requestAnimationFrame(gameLoop);
}

async function logActivity(action) {
    try {
        await fetch("https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log", {
            method: "POST", mode: "cors", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ "player": playerName, "action": action })
        });
    } catch (e) { }
}