const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let selectedShipSrc = 'rocket.png'; // Default ship

function selectShip(src, id) {
    selectedShipSrc = src;
    
    // Remove 'selected' border from all and add to the clicked one
    document.querySelectorAll('.ship-choice').forEach(img => img.classList.remove('selected'));
    document.getElementById(id).classList.add('selected');
}

const rocketImg = new Image(); rocketImg.src = 'rocket.png';

let player = { x: canvas.width/2, y: canvas.height/2, vx: 0, vy: 0, size: 30 };
let mouse = { x: canvas.width/2, y: canvas.height/2 };
let enemies = [], pulses = [], score = 0, gameActive = false, isPaused = false;
let highScore = localStorage.getItem('sentronHigh') || 0;
let lastPulseTime = 0, lastSuperTime = Date.now(), nextBossTime = Date.now() + 180000;
let difficulty = 1;

window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', firePulse);
window.addEventListener('keydown', e => { if(e.key === 'Escape') togglePause(); });

function initGame(level) {
    difficulty = level;
    rocketImg.src = selectedShipSrc;
    document.getElementById('startMenu').style.display = 'none';
    
    // Only start if the image is actually loaded
    if (rocketImg.complete) {
        gameActive = true;
        animate();
    } else {
        rocketImg.onload = function() {
            gameActive = true;
            animate();
        };
    }
}

function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'block' : 'none';
    if (!isPaused) animate();
}

function firePulse() {
    if (!gameActive || isPaused) return;

    let now = Date.now();
    let superReady = now - lastSuperTime > 30000;
    let normalReady = now - lastPulseTime > 7000;

    // RULE: You can fire if the Super is ready OR if the Normal pulse is ready
    if (superReady || normalReady) {
        
        // Decide if this specific blast is a Super
        let isSuper = superReady;

        pulses.push({ 
            x: player.x, 
            y: player.y, 
            r: 0, 
            maxR: isSuper ? 800 : 180, 
            isSuper: isSuper 
        });

        // Update the timers
        lastPulseTime = now;
        if (isSuper) lastSuperTime = now;
        
    }
}

function spawnEnemy(isBoss = false) {
    let x, y, side = Math.floor(Math.random() * 4);
    if (side === 0) { x = Math.random() * canvas.width; y = -100; }
    else if (side === 1) { x = Math.random() * canvas.width; y = canvas.height + 100; }
    else if (side === 2) { x = -100; y = Math.random() * canvas.height; }
    else { x = canvas.width + 100; y = Math.random() * canvas.height; }
    
    enemies.push({ x, y, size: isBoss ? 80 : 20, speed: isBoss ? 0.7 : (1.4 + Math.random() * difficulty), hp: isBoss ? 30 : 1, isBoss });
}

function animate() {
    if (!gameActive || isPaused) return;
    ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Smooth Glide Movement
    let dx = mouse.x - player.x, dy = mouse.y - player.y;
    player.vx += dx * 0.05; player.vy += dy * 0.05;
    player.vx *= 0.85; player.vy *= 0.85; // Friction prevents jitter
    player.x += player.vx; player.y += player.vy;

    // --- ROCKET DRAWING START ---
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
    ctx.drawImage(rocketImg, -30, -30, 60, 60);
    ctx.restore();
    // --- ROCKET DRAWING END ---

    // 3. Spawning Logic (Continue with your enemy code below)
    ctx.restore();

    // Spawn Timing
    if (Math.random() < 0.02 * difficulty) spawnEnemy();
    if (Date.now() > nextBossTime) { spawnEnemy(true); nextBossTime = Date.now() + 240000; }

    // Pulse Logic
    pulses.forEach((p, pi) => {
        p.r += p.isSuper ? 12 : 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.strokeStyle = p.isSuper ? '#fffb00' : '#00f2ff';
        ctx.lineWidth = 4; ctx.stroke();
        
        enemies.forEach((en, ei) => {
            if (Math.hypot(p.x - en.x, p.y - en.y) < p.r + en.size) {
                en.hp--;
                if (en.hp <= 0) { enemies.splice(ei, 1); score += en.isBoss ? 1000 : 20; }
            }
        });
        if (p.r > p.maxR) pulses.splice(pi, 1);
    });

    // Enemy Logic
    enemies.forEach((en, i) => {
        let ex = player.x - en.x, ey = player.y - en.y, dist = Math.hypot(ex, ey);
        en.x += (ex/dist) * en.speed; en.y += (ey/dist) * en.speed;

        ctx.fillStyle = en.isBoss ? '#ff00ff' : '#ff1a1a';
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(en.x, en.y, en.size, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;

        if (dist < player.size + en.size) {
            gameActive = false;
            document.getElementById('gameOver').style.display = 'block';
            document.getElementById('finalScr').innerText = Math.floor(score);
            if (score > highScore) localStorage.setItem('sentronHigh', Math.floor(score));
        }
    });

    // Update Indicators & Timers
    score += 0.05;
    document.getElementById('scr').innerText = Math.floor(score);
    document.getElementById('hscr').innerText = Math.floor(highScore);

    // Pulse Timer Logic
    let pulseElapsed = Date.now() - lastPulseTime;
    let pInd = document.getElementById('pCharge');
    if (pulseElapsed > 7000) {
        pInd.innerText = "READY";
        pInd.style.color = "#00f2ff";
    } else {
        pInd.innerText = ((7000 - pulseElapsed) / 1000).toFixed(1) + "s";
        pInd.style.color = "#ff0055";
    }

    // Super Timer Logic
    let superElapsed = Date.now() - lastSuperTime;
    let sInd = document.getElementById('sCharge');
    if (superElapsed > 30000) {
        sInd.innerText = "READY";
        sInd.style.color = "#fffb00";
    } else {
        sInd.innerText = Math.ceil((30000 - superElapsed) / 1000) + "s";
        sInd.style.color = "#fffb00";
    }

    requestAnimationFrame(animate);
}

