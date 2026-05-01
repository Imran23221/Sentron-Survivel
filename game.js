// --- CORE SETUP ---
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

let player = { x: canvas.width/2, y: canvas.height/2, size: 38, angle: 0 };
let enemies = [];
let particles = []; // SHATTER EFFECT ARRAY
let mouse = { x: canvas.width/2, y: canvas.height/2 };

let lastPulse = 0, lastSuper = 0, lastScoreTime = 0;
let nextBossTime = 0, flashEffect = { timer: 0, color: '#fff', size: 0 };
let shakeAmt = 0; // GENTLE SHAKE

// --- MENU NAVIGATION ---
function showLogin() {
    document.getElementById('rulesOverlay').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
}

function goToShipSelect() {
    const val = document.getElementById('playerInput').value.trim();
    playerName = val || "Pilot";
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('shipMenu').style.display = 'flex';
    logActivity("PILOT LOGGED IN");
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

// --- SYSTEM HANDLERS ---
function togglePause() {
    if (!gameActive) return;
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'flex' : 'none';
    if (!isPaused) requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', e => {
    if (e.key === "Escape") togglePause();
});

function gameOver() {
    gameActive = false;
    shakeAmt = 15; // Small jolt on death
    document.getElementById('finalScoreDisplay').innerText = score;
    document.getElementById('gameOverScreen').style.display = 'flex';
    logActivity(`MISSION FAILED - SCORE: ${score}`);
}

function backToMenu() {
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('shipMenu').style.display = 'flex';
}

// --- SHATTER & PARTICLES ---
function createShatter(x, y, color, isBoss) {
    const count = isBoss ? 50 : 12;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 4 + 2,
            life: 1.0,
            color: color
        });
    }
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
        shakeAmt = isSuper ? 10 : 5; // MODERATE SHAKE

        enemies = enemies.filter(en => {
            const dist = Math.hypot(player.x - en.x, player.y - en.y);
            if (dist < range) {
                if (en.isBoss && !isSuper) return true;
                // TRIANGLE SHATTERS HERE
                createShatter(en.x, en.y, en.isBoss ? '#bc13fe' : '#ff0044', en.isBoss);
                return false;
            }
            return true;
        });

        if (isSuper) lastSuper = now; else lastPulse = now;
        logActivity(isSuper ? "SUPERNOVA" : "PULSE");
    }
}

function update() {
    if (!gameActive || isPaused) return;

    // Smooth movement
    player.x += (mouse.x - player.x) * 0.12;
    player.y += (mouse.y - player.y) * 0.12;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;

    // Score loop
    if (Date.now() - lastScoreTime > 1000) {
        score++;
        lastScoreTime = Date.now();
        document.getElementById('scr').innerText = score;
    }

    // HUD Cooldowns
    const pWait = Math.max(0, Math.ceil((6000 - (Date.now() - lastPulse))/1000));
    const sWait = Math.max(0, Math.ceil((25000 - (Date.now() - lastSuper))/1000));
    document.getElementById('pCharge').innerText = pWait === 0 ? "READY" : pWait + "S";
    document.getElementById('sCharge').innerText = sWait === 0 ? "READY" : sWait + "S";

    // Enemy Spawning
    if (Math.random() < 0.04 + (difficulty * 0.015)) spawnEnemy(false);
    if (Date.now() > nextBossTime) { spawnEnemy(true); nextBossTime = Date.now() + 45000; }

    // Enemy Logic
    enemies.forEach((en, i) => {
        const d = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x) / d) * en.speed;
        en.y += ((player.y - en.y) / d) * en.speed;
        en.rot += 0.02;
        if (d < (player.size * 0.7) + (en.size * 0.7)) gameOver();
    });

    // Particle Logic
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    });

    // Fade shake
    if (shakeAmt > 0) shakeAmt *= 0.9;
}

function draw() {
    ctx.fillStyle = 'rgba(0, 5, 15, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // APPLY GENTLE SHAKE
    if (shakeAmt > 0.1) {
        ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    }

    // Draw Particles (Shatter fragments)
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Draw Enemies (Triangles)
    enemies.forEach(en => {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.rotate(en.rot);
        ctx.shadowBlur = en.isBoss ? 20 : 10;
        ctx.shadowColor = en.isBoss ? '#bc13fe' : '#ff0044';
        ctx.fillStyle = en.isBoss ? '#bc13fe' : '#ff0044';
        if (en.isBoss) ctx.fillRect(-en.size/2, -en.size/2, en.size, en.size);
        else {
            ctx.beginPath(); 
            ctx.moveTo(0, -en.size/2); 
            ctx.lineTo(en.size/2, en.size/2); 
            ctx.lineTo(-en.size/2, en.size/2); 
            ctx.fill();
        }
        ctx.restore();
    });

    // Draw Player
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.shadowBlur = 15; ctx.shadowColor = '#00f2ff';
    ctx.drawImage(shipImg, -player.size, -player.size, player.size*2, player.size*2);
    ctx.restore();

    // Pulse Circle
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
    if (gameActive && !isPaused) requestAnimationFrame(gameLoop);
}

async function logActivity(action) {
    try {
        // Replace this URL with your actual Codespace URL
        const url = "https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log";
        
        await fetch(url, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                "player": playerName, 
                "action": action,
                "score": score // Sending the score for the dashboard
            })
        });
    } catch (e) {}
}