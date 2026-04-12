const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- GAME STATE ---
let gameRunning = false;
let isPaused = false;
let score = 0;
let highScore = localStorage.getItem('sentronHS') || 0;
let enemies = [];
let powerUps = [];
let pulses = [];

// Settings controlled by Level Buttons
let enemySpawnRate = 0.01;
let enemySpeedMult = 1;

// Timers & Toggles
let pulseReady = true;
let superPulseReady = false;
let nextBossTime = 0;
let shakeTime = 0;

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: 0, vy: 0,
    size: 15, color: '#00ffff'
};

const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

// --- INPUTS ---
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mousedown', () => {
    if (!gameRunning || isPaused) return;

    const statusText = document.getElementById('pulseStatus');

    if (superPulseReady) {
        pulses.push({ x: player.x, y: player.y, r: 0, maxR: 800, color: '#ffd700', power: 50 });
        superPulseReady = false;
        shakeTime = 30;
        statusText.innerText = "PULSE READY";
        statusText.style.color = "#00ffff";
    } else if (pulseReady) {
        pulses.push({ x: player.x, y: player.y, r: 0, maxR: 250, color: '#00ffff', power: 20 });
        pulseReady = false;
        shakeTime = 10;
        statusText.innerText = "RECHARGING...";
        statusText.style.color = "#ff4444";

        setTimeout(() => {
            pulseReady = true;
            if (!superPulseReady) {
                statusText.innerText = "PULSE READY";
                statusText.style.color = "#00ffff";
            }
        }, 5000);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'Escape') togglePause();
});

// --- CORE FUNCTIONS ---
function startGame(difficulty) {
    document.getElementById('menu').style.display = 'none';
    
    // Level Tuning
    if (difficulty === 'easy') { enemySpawnRate = 0.006; enemySpeedMult = 0.7; }
    if (difficulty === 'medium') { enemySpawnRate = 0.012; enemySpeedMult = 1.0; }
    if (difficulty === 'hard') { enemySpawnRate = 0.025; enemySpeedMult = 1.5; }

    score = 0;
    enemies = [];
    powerUps = [];
    pulses = [];
    nextBossTime = Date.now() + 180000; // 3 Minutes until first boss
    gameRunning = true;
    isPaused = false;
    animate();
}

function togglePause() {
    if (!gameRunning) return;
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'block' : 'none';
    if (!isPaused) animate();
}
function quitGame() {
    // 1. Stop the game logic
    gameRunning = false;
    isPaused = false;

    // 2. Hide the pause menu and show the main menu
    document.getElementById('pauseMenu').style.display = 'none';
    document.getElementById('menu').style.display = 'block';

    // 3. Optional: Clear the canvas so it's fresh for the next game
    ctx.fillStyle = '#0a191e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}


function gameOver() {
    gameRunning = false;
    if (Math.floor(score) > highScore) localStorage.setItem('sentronHS', Math.floor(score));
    alert("CONNECTION LOST. Score: " + Math.floor(score));
    location.reload();
}

function animate() {
    if (!gameRunning || isPaused) return;

    // Background
    ctx.fillStyle = 'rgba(10, 25, 30, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Screen Shake
    if (shakeTime > 0) {
        ctx.setTransform(1,0,0,1, Math.random()*10-5, Math.random()*10-5);
        shakeTime--;
    } else {
        ctx.setTransform(1,0,0,1,0,0);
    }

    // 1. Movement (Smooth/No Jitter)
    const dx = mouse.x - player.x;
    const dy = mouse.y - player.y;
    const d = Math.hypot(dx, dy);
    player.vx *= 0.8; player.vy *= 0.8;
    if (d > 2) {
        player.vx += dx * 0.05;
        player.vy += dy * 0.05;
    } else {
        player.x = mouse.x; player.y = mouse.y;
    }
    player.x += player.vx; player.y += player.vy;

    // Draw Player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size, 0, Math.PI*2);
    ctx.fillStyle = player.color;
    ctx.fill();

    // 2. Power-Ups (Golden Squares - Every ~30-40 seconds)
    if (Math.random() < 0.0005) {
        powerUps.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height });
    }
    powerUps.forEach((p, i) => {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(p.x, p.y, 20, 20);
        if (Math.hypot(player.x - (p.x+10), player.y - (p.y+10)) < 25) {
            superPulseReady = true;
            powerUps.splice(i, 1);
            document.getElementById('pulseStatus').innerText = "SUPER PULSE READY!";
            document.getElementById('pulseStatus').style.color = "#ffd700";
        }
    });

    // 3. Boss Spawning (3-5 Minutes)
    if (Date.now() > nextBossTime) {
        enemies.push({ x: -50, y: canvas.height/2, size: 60, speed: 1, color: '#ff00ff', isBoss: true });
        nextBossTime = Date.now() + 180000 + Math.random()*120000;
    }

    // 4. Regular Enemies (Pirates)
    if (Math.random() < enemySpawnRate) {
        enemies.push({
            x: Math.random() < 0.5 ? -20 : canvas.width + 20,
            y: Math.random() * canvas.height,
            size: 10, speed: (2 + Math.random()*2) * enemySpeedMult, color: '#ff4400', isBoss: false
        });
    }

    // 5. Enemy Logic
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;

        // Draw Enemy
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI*2); ctx.fill();

        // Collision with Player
        if (Math.hypot(player.x - e.x, player.y - e.y) < player.size + e.size) gameOver();

        // Collision with Pulses
        pulses.forEach(p => {
            const dist = Math.hypot(p.x - e.x, p.y - e.y);
            if (Math.abs(dist - p.r) < p.power) {
                if (!e.isBoss || p.power > 30) {
                    enemies.splice(i, 1);
                    score += e.isBoss ? 500 : 10;
                }
            }
        });
    }

    // 6. Pulse Logic
    pulses.forEach((p, i) => {
        p.r += 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.stroke();
        if (p.r > p.maxR) pulses.splice(i, 1);
    });

    // 7. UI Update
    score += 0.05;
    document.getElementById('currentScore').innerText = Math.floor(score);
    document.getElementById('highScore').innerText = Math.max(Math.floor(score), highScore);

    requestAnimationFrame(animate);
}

