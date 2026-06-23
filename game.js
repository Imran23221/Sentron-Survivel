// --- CORE SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === SENTRON CONFIG & CHEAT STATE ===
let playerName = "Pilot";
let hasTrailAbility = false; 
let isInvincible = false;     // CHEAT 2: Godmode
let slowMotion = false;       // CHEAT 3: Enemies half-speed
let zeroCooldown = false;     // CHEAT 4: Unlimited pulses
let shipTrail = []; 

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

// --- DEVELOPER REGISTRATION FUNCTION ---
function setPlayerName(inputName) {
    playerName = inputName;
    
    // Reset all matrix states back to default before validating
    hasTrailAbility = false;
    isInvincible = false;
    slowMotion = false;
    zeroCooldown = false;

    // OPTION 1: Ultimate Dev Override (All systems active!)
    if (playerName === "BLUE_PHOENIX") {
        hasTrailAbility = true;
        isInvincible = true;
        slowMotion = true;
        zeroCooldown = true;
        logActivity("DEVELOPER CHEAT CODE ACTIVATED");
    } 
    // OPTION 2: Individual Armor Matrix
    else if (playerName === "PHOENIX_ARMOR") {
        isInvincible = true;
        logActivity("DEVELOPER MATRIX: INVINCIBILITY");
    } 
    // OPTION 3: Individual Time Manipulation Matrix
    else if (playerName === "CHRONO_BREAK") {
        slowMotion = true;
        logActivity("DEVELOPER MATRIX: CHRONO SLOW");
    } 
    // OPTION 4: Individual Singularity Recharge Matrix
    else if (playerName === "SINGULARITY_CORE") {
        zeroCooldown = true;
        logActivity("DEVELOPER MATRIX: ZERO CD");
    } 
    // OPTION 5: Individual Magnet Matrix (Score boost only)
    else if (playerName === "VORTEX_MAGNET") {
        logActivity("DEVELOPER MATRIX: PASSIVE MULTIPLIER");
    }
    // OPTION 6: Individual Phoenix Trail Matrix
    else if (playerName === "PHOENIX_TRAIL") {
        hasTrailAbility = true;
        logActivity("DEVELOPER MATRIX: ENERGY TRAIL");
    }
}

// --- MENU NAVIGATION ---
function showLogin() {
    document.getElementById('rulesOverlay').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
    
    // --- FIXES THE 12 CHARACTER LIMIT ---
    const inputField = document.getElementById('playerInput');
    if (inputField) inputField.setAttribute('maxlength', '30');
    // ------------------------------------
}

function goToShipSelect() {
    const val = document.getElementById('playerInput').value.trim();
    
    // Process name through developer cheat checkpoint
    setPlayerName(val || "Pilot");
    
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
    shipTrail = []; // Reset old trails
    gameActive = true;
    isPaused = false;
    lastPulse = Date.now();
    lastSuper = Date.now();
    lastScoreTime = Date.now();
    nextBossTime = Date.now() + 45000;

    // Hide survival HUD, show classic HUD
    document.getElementById('survivalHUD').style.display      = 'none';
    document.getElementById('powerupBar').style.display       = 'none';
    document.getElementById('powerupBar-label').style.display = 'none';
    document.querySelector('.ui-layer').style.display = 'block';
    
    logActivity(`MISSION START: ${playerName}`);
    requestAnimationFrame(gameLoop);
}

// --- SYSTEM HANDLERS ---
function togglePause() {
    if (!gameActive && !survivalActive) return;
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'flex' : 'none';
    
    // Logs the exact pause/resume interaction state to dashboard
    logActivity(isPaused ? "GAME PAUSED" : "GAME RESUMED");
    
    if (!isPaused) {
        if (survivalActive) requestAnimationFrame(survivalLoop);
        else requestAnimationFrame(gameLoop);
    }
}

window.addEventListener('keydown', e => {
    if (e.key === "Escape") togglePause();
    // Survival movement + shoot
    if (survivalActive && !isPaused) {
        if (e.key === 'ArrowLeft'  || e.key === 'a') sKeys.left  = true;
        if (e.key === 'ArrowRight' || e.key === 'd') sKeys.right = true;
        if (e.key === 'ArrowUp'    || e.key === 'w') sKeys.up    = true;
        if (e.key === 'ArrowDown'  || e.key === 's') sKeys.down  = true;
        if (e.key === ' ') { e.preventDefault(); survivalShoot(); }
        if (e.key >= '1' && e.key <= '4') usePowerUp(parseInt(e.key) - 1);
    }
});
window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') sKeys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd') sKeys.right = false;
    if (e.key === 'ArrowUp'    || e.key === 'w') sKeys.up    = false;
    if (e.key === 'ArrowDown'  || e.key === 's') sKeys.down  = false;
});

function gameOver() {
    gameActive = false;
    shakeAmt = 15; // Small jolt on death
    document.getElementById('finalScoreDisplay').innerText = score;
    document.getElementById('gameOverScreen').style.display = 'flex';
    logActivity(`MISSION FAILED - SCORE: ${score}`);
}

function backToMenu() {
    document.getElementById('gameOverScreen').style.display      = 'none';
    document.getElementById('survivalOverScreen').style.display  = 'none';
    document.getElementById('survivalHUD').style.display         = 'none';
    document.getElementById('powerupBar').style.display          = 'none';
    document.getElementById('powerupBar-label').style.display    = 'none';
    document.querySelector('.ui-layer').style.display            = 'none';
    document.getElementById('shipMenu').style.display            = 'flex';
    survivalActive = false;
    gameActive = false;
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
    if (survivalActive) return; // Survival uses keyboard/touch only
    if (!gameActive || isPaused) return;
    if (e.button === 0) triggerPulse(false);
    if (e.button === 2) triggerPulse(true);
});
window.addEventListener('contextmenu', e => e.preventDefault());

function spawnEnemy(isBoss = false) {
    const size = isBoss ? 110 : 30;
    
    // --- CHEAT APPLIED: CHRONO BREAK (HALF SPEED) ---
    let baseSpeed = (1.6 + (difficulty * 0.7));
    if (slowMotion) {
        baseSpeed = baseSpeed * 0.5;
    }
    const speed = isBoss ? (slowMotion ? 0.45 : 0.9) : baseSpeed;
    
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

    // --- CHEAT APPLIED: SINGULARITY CORE (ZERO COOLDOWN OVERRIDE) ---
    if (zeroCooldown || (now - last >= cd)) {
        flashEffect = { timer: 25, color: isSuper ? '#ffff00' : '#00f2ff', size: range };
        shakeAmt = isSuper ? 10 : 5; // MODERATE SHAKE

        enemies = enemies.filter(en => {
            const dist = Math.hypot(player.x - en.x, player.y - en.y);
            if (dist < range) {
                if (en.isBoss && !isSuper) return true;
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

    // --- BLUE PHOENIX TRAIL TRACKING ---
    if (hasTrailAbility) {
        shipTrail.push({ x: player.x, y: player.y });
        if (shipTrail.length > 40) {
            shipTrail.shift(); // Keep trail length locked
        }
    } else {
        shipTrail = [];
    }

    // Score loop
    if (Date.now() - lastScoreTime > 1000) {
        // --- CHEAT APPLIED: VORTEX PASSED TICK MODIFIER ---
        score += (playerName === "BLUE_PHOENIX" || playerName === "VORTEX_MAGNET") ? 10 : 1;
        lastScoreTime = Date.now();
        document.getElementById('scr').innerText = score;
    }

    // HUD Cooldowns
    const pWait = zeroCooldown ? 0 : Math.max(0, Math.ceil((6000 - (Date.now() - lastPulse))/1000));
    const sWait = zeroCooldown ? 0 : Math.max(0, Math.ceil((25000 - (Date.now() - lastSuper))/1000));
    document.getElementById('pCharge').innerText = pWait === 0 ? "READY" : pWait + "S";
    document.getElementById('sCharge').innerText = sWait === 0 ? "READY" : sWait + "S";

    // Enemy Spawning
    if (Math.random() < 0.04 + (difficulty * 0.015)) spawnEnemy(false);
    if (Date.now() > nextBossTime) { spawnEnemy(true); nextBossTime = Date.now() + 45000; }

    // Enemy Logic
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];
        const d = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x) / d) * en.speed;
        en.y += ((player.y - en.y) / d) * en.speed;
        en.rot += 0.02;
        
        // --- TRAIL INTERSECTION CHECK ---
        if (hasTrailAbility) {
            let enemyEliminated = false;
            for (let j = 0; j < shipTrail.length; j++) {
                let point = shipTrail[j];
                if (point.x > en.x - en.size/2 && point.x < en.x + en.size/2 &&
                    point.y > en.y - en.size/2 && point.y < en.y + en.size/2) {
                    enemyEliminated = true;
                    break;
                }
            }
            if (enemyEliminated) {
                createShatter(en.x, en.y, en.isBoss ? '#bc13fe' : '#ff0044', en.isBoss);
                enemies.splice(i, 1);
                
                // --- CHEAT APPLIED: BONUS ELIMINATION MODIFIER ---
                score += 300; 
                document.getElementById('scr').innerText = score;
                logActivity("TRAIL ELIMINATED SENTRON");
                continue; 
            }
        }

        // Standard Player Collision
        if (d < (player.size * 0.7) + (en.size * 0.7)) {
            // --- CHEAT APPLIED: PHOENIX ARMOR (INVINCIBILITY CHECK) ---
            if (isInvincible) {
                createShatter(en.x, en.y, en.isBoss ? '#bc13fe' : '#ff0044', en.isBoss);
                enemies.splice(i, 1); // Crush them on touch instead of taking damage!
                score += 300;
                document.getElementById('scr').innerText = score;
                logActivity("ARMOR CRUSHED SENTRON");
            } else {
                gameOver();
            }
        }
    }

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

    // --- DRAW GLOWING PHOENIX TRAIL EFFECT ---
    if (gameActive && hasTrailAbility && shipTrail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "#00d2ff"; 
        ctx.shadowColor = "#0066ff";
        ctx.shadowBlur = 15; 
        ctx.lineWidth = 8; 
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        ctx.moveTo(shipTrail[0].x, shipTrail[0].y);
        for (let i = 1; i < shipTrail.length; i++) {
            ctx.lineTo(shipTrail[i].x, shipTrail[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

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
    const url = "https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log";
    
    // Format the data exactly how the original Centron backend reads it
    const pName = typeof playerName !== 'undefined' && playerName ? playerName : "Pilot";
    const currentScore = typeof score !== 'undefined' ? score : 0;
    
    // This creates a standard form-encoded body string
    const formBody = `player=${encodeURIComponent(pName)}&action=${encodeURIComponent(action)}&score=${encodeURIComponent(currentScore)}`;
    
    fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { 
            "Content-Type": "application/x-www-form-urlencoded" 
        },
        body: formBody
    }).catch(err => {}); 
}


// =============================================================================
// =============================================================================
//
//   ███████ ██    ██ ██████  ██    ██ ██ ██    ██  █████  ██
//   ██      ██    ██ ██   ██ ██    ██ ██ ██    ██ ██   ██ ██
//   ███████ ██    ██ ██████  ██    ██ ██ ██    ██ ███████ ██
//        ██ ██    ██ ██   ██  ██  ██  ██  ██  ██  ██   ██ ██
//   ███████  ██████  ██   ██   ████   ██   ████   ██   ██ ███████
//
//   SURVIVAL MODE — Side-scrolling Blitz Shooter
//   Controls : Arrow Left/Right or A/D to move
//              Space to shoot (auto-fires while held)
//              Keys 1-4 to activate stored power-ups
//   Rules    : Enemies drop from the top and shoot back
//              Kill bosses (every 10 kills) to earn coins
//              Collect power-up drops and re-use them with coins
//
// =============================================================================
// =============================================================================

let survivalActive = false;
const sKeys = { left: false, right: false, up: false, down: false, space: false };

// --- Survival Player ---
let sPlayer = {
    x: 0, y: 0,
    w: 52, h: 52,
    speed: 6,
    lives: 3,
    invincTimer: 0,
};

// --- Survival Collections ---
let sBullets    = [];   // player bullets
let sEnemies    = [];   // enemy ships
let sEBullets   = [];   // enemy bullets
let sPowerDrops = [];   // power-up pickups on field
let sCoinDrops  = [];   // coin pickups on field
let sParticles  = [];   // survival-only particles

// --- Survival State ---
let sScore      = 0;
let sCoins      = 0;
let sWave       = 1;
let sKills      = 0;
let sBossActive = false;
const KILLS_PER_BOSS = 10;

// --- Power-up Inventory (4 slots) ---
let puSlots = [null, null, null, null];

// --- Active Power-up Effects ---
let puEffects = {
    rapidFire:  { active: false, timer: 0 },
    shield:     { active: false, timer: 0 },
    laserBeam:  { active: false, timer: 0 },
    tripleShot: { active: false, timer: 0 },
    bombBlast:  { active: false, timer: 0 },
    timeSlow:   { active: false, timer: 0 },
};

// --- Shoot Timing ---
let sLastShot   = 0;
const S_SHOOT_DELAY = 220; // ms between shots (halved by rapidFire)

// --- Star Field (scrolling BG) ---
const sStars = [];
for (let i = 0; i < 140; i++) {
    sStars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.3,
        spd: Math.random() * 1.2 + 0.3,
        bright: Math.random() * 0.6 + 0.4,
    });
}

// --- Power-up Definitions ---
const POWER_UP_DEFS = [
    { type:'rapidFire',  icon:'⚡', label:'RAPID FIRE', cost:2, color:'#ffff00', duration:8000  },
    { type:'shield',     icon:'🛡', label:'SHIELD',     cost:3, color:'#00f2ff', duration:0     },
    { type:'laserBeam',  icon:'🔴', label:'LASER',      cost:4, color:'#ff0044', duration:5000  },
    { type:'tripleShot', icon:'🔱', label:'TRIPLE',     cost:2, color:'#bc13fe', duration:7000  },
    { type:'bombBlast',  icon:'💥', label:'BOMB',       cost:3, color:'#ff8800', duration:0     },
    { type:'timeSlow',   icon:'⏱', label:'SLOW-MO',    cost:3, color:'#00ffaa', duration:6000  },
];

// =============================================================================
// SURVIVAL — START
// =============================================================================
function startSurvival() {
    shipImg.src = selectedShipSrc;

    // Hide classic overlays
    document.getElementById('shipMenu').style.display       = 'none';
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('survivalOverScreen').style.display = 'none';
    document.querySelector('.ui-layer').style.display       = 'none';

    // Show survival HUD
    document.getElementById('survivalHUD').style.display       = 'flex';
    document.getElementById('powerupBar').style.display        = 'flex';
    document.getElementById('powerupBar-label').style.display  = 'block';

    // Reset all state
    survivalActive = true;
    gameActive     = false;
    isPaused       = false;

    sPlayer.x = canvas.width / 2;
    sPlayer.y = canvas.height - 100;
    sPlayer.lives = 3;
    sPlayer.invincTimer = 0;

    sBullets = []; sEnemies = []; sEBullets = [];
    sPowerDrops = []; sCoinDrops = []; sParticles = [];

    sScore = 0; sCoins = 0; sWave = 1; sKills = 0;
    sBossActive = false;
    sLastShot = Date.now();

    puSlots = [null, null, null, null];
    Object.keys(puEffects).forEach(k => { puEffects[k].active = false; puEffects[k].timer = 0; });

    // Randomise star positions
    sStars.forEach(s => {
        s.x = Math.random() * canvas.width;
        s.y = Math.random() * canvas.height;
    });

    updateSurvivalHUD();
    renderPowerUpBar();
    spawnSurvivalWave();

    logActivity(`SURVIVAL START: ${playerName}`);
    requestAnimationFrame(survivalLoop);
}

// =============================================================================
// SURVIVAL — WAVE SPAWNING
// =============================================================================
function spawnSurvivalWave() {
    // Reasonable enemy count: starts at 3, caps at 10 by wave 8+
    const count = Math.min(3 + Math.floor(sWave * 0.9), 10);
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            if (!survivalActive) return;
            spawnSurvivalEnemy(false);
        }, i * 900);  // stagger spawns so they don't flood at once
    }
}

function spawnSurvivalEnemy(isBoss) {
    const w = isBoss ? 84 : 36;
    const h = isBoss ? 84 : 36;
    const x = Math.random() * (canvas.width - w * 2) + w;
    const baseSpd = isBoss ? 0.85 : 1.3 + sWave * 0.18;
    const spd     = puEffects.timeSlow.active ? baseSpd * 0.45 : baseSpd;
    const hp      = isBoss ? 18 + sWave * 4 : 1;

    // FIX #2 — Enemy shooting rates significantly reduced:
    // Regular enemies: shoot every 3.5–6s (was 1.7–2.9s)
    // Boss: shoots every 2.2s with 1 bullet (was 0.7s with 3 bullets)
    sEnemies.push({
        x, y: -h / 2 - 10,
        w, h,
        speed: spd,
        baseSpeed: baseSpd,
        isBoss,
        hp, maxHp: hp,
        rot: 0,
        lastShot: Date.now() + Math.random() * 3000,
        shootInterval: isBoss ? 2200 : 3500 + Math.random() * 2500,
        color: isBoss ? '#bc13fe' : '#ff0044',
        pulseT: 0,
    });
}

// =============================================================================
// SURVIVAL — SHOOTING
// =============================================================================
function survivalShoot() {
    const now   = Date.now();
    const delay = puEffects.rapidFire.active ? S_SHOOT_DELAY * 0.38 : S_SHOOT_DELAY;
    if (now - sLastShot < delay) return;
    sLastShot = now;

    if (puEffects.laserBeam.active) {
        triggerLaser();
        return;
    }

    const angles = puEffects.tripleShot.active ? [-20, 0, 20] : [0];
    angles.forEach(deg => {
        const rad = deg * Math.PI / 180;
        sBullets.push({
            x: sPlayer.x + Math.sin(rad) * 10,
            y: sPlayer.y - sPlayer.h / 2,
            vx: Math.sin(rad) * 7,
            vy: -14,
            r: 4,
            color: '#00f2ff',
            trail: [],
        });
    });
}

function triggerLaser() {
    // Instant column hit — damage everything in ±35px of player x
    for (let i = sEnemies.length - 1; i >= 0; i--) {
        const en = sEnemies[i];
        if (Math.abs(en.x - sPlayer.x) < en.w / 2 + 35) {
            en.hp -= en.hp; // one-shot
            if (en.hp <= 0) killSurvivalEnemy(i);
        }
    }
    // Visual pulse stored in sBullets as a special type
    sBullets.push({ type: 'laser', x: sPlayer.x, life: 1 });
}

// =============================================================================
// SURVIVAL — UPDATE
// =============================================================================
function survivalUpdate() {
    if (!survivalActive || isPaused) return;

    // Player movement (all 4 directions)
    if (sKeys.left  && sPlayer.x - sPlayer.w / 2 > 0)                      sPlayer.x -= sPlayer.speed;
    if (sKeys.right && sPlayer.x + sPlayer.w / 2 < canvas.width)            sPlayer.x += sPlayer.speed;
    if (sKeys.up    && sPlayer.y - sPlayer.h / 2 > 70)                      sPlayer.y -= sPlayer.speed;
    if (sKeys.down  && sPlayer.y + sPlayer.h / 2 < canvas.height - 90)      sPlayer.y += sPlayer.speed;

    // Auto-shoot while space held
    if (sKeys.space) survivalShoot();

    // Invincibility cooldown
    if (sPlayer.invincTimer > 0) sPlayer.invincTimer--;

    // Power-up timers
    Object.keys(puEffects).forEach(k => {
        if (puEffects[k].active && puEffects[k].timer > 0) {
            puEffects[k].timer -= 16;
            if (puEffects[k].timer <= 0) {
                puEffects[k].active = false;
                puEffects[k].timer  = 0;
            }
        }
    });

    // Apply timeSlow to existing enemies
    sEnemies.forEach(en => {
        en.speed = puEffects.timeSlow.active ? en.baseSpeed * 0.45 : en.baseSpeed;
    });

    // ---- Player bullets ----
    for (let i = sBullets.length - 1; i >= 0; i--) {
        const b = sBullets[i];

        // Laser visual — instant, remove after one frame
        if (b.type === 'laser') { b.life -= 0.15; if (b.life <= 0) sBullets.splice(i, 1); continue; }

        // Store trail for glow effect
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 8) b.trail.shift();

        b.x += b.vx;
        b.y += b.vy;

        if (b.y < -20) { sBullets.splice(i, 1); continue; }

        // Bullet vs enemies
        let hit = false;
        for (let j = sEnemies.length - 1; j >= 0; j--) {
            const en = sEnemies[j];
            if (b.x > en.x - en.w/2 && b.x < en.x + en.w/2 &&
                b.y > en.y - en.h/2 && b.y < en.y + en.h/2) {
                en.hp--;
                if (en.hp <= 0) killSurvivalEnemy(j);
                hit = true;
                break;
            }
        }
        if (hit) { sBullets.splice(i, 1); }
    }

    // ---- Enemies ----
    for (let i = sEnemies.length - 1; i >= 0; i--) {
        const en = sEnemies[i];
        en.y     += en.speed;
        en.rot   += 0.025;
        en.pulseT = (en.pulseT || 0) + 0.08;

        // Reached bottom — lose a life
        if (en.y > canvas.height + en.h) {
            sEnemies.splice(i, 1);
            survivalTakeDamage();
            continue;
        }

        // Enemy fires
        const now = Date.now();
        if (now - en.lastShot > en.shootInterval) {
            en.lastShot = now;
            fireEnemyBullet(en);
        }

        // Enemy touches player
        if (sPlayer.invincTimer === 0 &&
            Math.abs(en.x - sPlayer.x) < (en.w + sPlayer.w) / 2 * 0.75 &&
            Math.abs(en.y - sPlayer.y) < (en.h + sPlayer.h) / 2 * 0.75) {
            createSurvivalParticles(en.x, en.y, en.color, en.isBoss);
            sEnemies.splice(i, 1);
            if (puEffects.shield.active) {
                puEffects.shield.active = false;
                createSurvivalParticles(sPlayer.x, sPlayer.y, '#00f2ff', false);
            } else {
                survivalTakeDamage();
            }
        }
    }

    // ---- Enemy bullets ----
    for (let i = sEBullets.length - 1; i >= 0; i--) {
        const b = sEBullets[i];
        b.x += b.vx; b.y += b.vy;

        if (b.y > canvas.height + 10 || b.x < -10 || b.x > canvas.width + 10) {
            sEBullets.splice(i, 1); continue;
        }

        // Hit player
        if (sPlayer.invincTimer === 0 &&
            b.x > sPlayer.x - sPlayer.w / 2 && b.x < sPlayer.x + sPlayer.w / 2 &&
            b.y > sPlayer.y - sPlayer.h / 2 && b.y < sPlayer.y + sPlayer.h / 2) {
            sEBullets.splice(i, 1);
            if (puEffects.shield.active) {
                puEffects.shield.active = false;
                createSurvivalParticles(sPlayer.x, sPlayer.y, '#00f2ff', false);
            } else {
                survivalTakeDamage();
            }
        }
    }

    // ---- Power-up drops ----
    for (let i = sPowerDrops.length - 1; i >= 0; i--) {
        const d = sPowerDrops[i];
        d.y   += 1.6;
        d.rot  = (d.rot || 0) + 0.04;
        if (d.y > canvas.height + 30) { sPowerDrops.splice(i, 1); continue; }
        if (Math.abs(d.x - sPlayer.x) < 34 && Math.abs(d.y - sPlayer.y) < 34) {
            addToInventory(d.pu);
            sPowerDrops.splice(i, 1);
        }
    }

    // ---- Coin drops ----
    for (let i = sCoinDrops.length - 1; i >= 0; i--) {
        const c = sCoinDrops[i];
        c.y   += 1.4;
        c.rot  = (c.rot || 0) + 0.09;
        if (c.y > canvas.height + 20) { sCoinDrops.splice(i, 1); continue; }
        if (Math.abs(c.x - sPlayer.x) < 30 && Math.abs(c.y - sPlayer.y) < 30) {
            sCoins++;
            sCoinDrops.splice(i, 1);
            createSurvivalParticles(c.x, c.y, '#ffaa00', false);
            updateSurvivalHUD();
            renderPowerUpBar();
        }
    }

    // ---- Survival particles ----
    for (let i = sParticles.length - 1; i >= 0; i--) {
        const p = sParticles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.018;
        if (p.life <= 0) sParticles.splice(i, 1);
    }

    // ---- Scroll stars ----
    sStars.forEach(s => {
        s.y += s.spd;
        if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
    });

    // ---- Passive score ----
    sScore += 0.025;

    // ---- Wave clear check — only enemies matter, drops can still be on field ----
    if (!sBossActive && sEnemies.length === 0) {
        sWave++;
        sKills = 0;
        updateSurvivalHUD();
        setTimeout(() => { if (survivalActive) spawnSurvivalWave(); }, 2200);
    }

    updateSurvivalHUD();
}

// =============================================================================
// SURVIVAL — ENEMY BULLET FIRE
// No aimbot — enemies shoot downward with a random spread cone.
// Bosses fire a 3-bullet spread (left/center/right) but still downward,
// so the player can dodge by reading the pattern rather than being tracked.
// =============================================================================
function fireEnemyBullet(en) {
    const spd = en.isBoss ? 4.2 : 3.0;

    if (en.isBoss) {
        // Boss: 3-shot spread aimed loosely downward — dodgeable by moving sideways
        [-0.35, 0, 0.35].forEach(offset => {
            sEBullets.push({
                x: en.x, y: en.y + en.h / 2,
                vx: offset * spd * 2 + (Math.random() - 0.5) * 0.5,
                vy: spd,
                r: 6,
                color: '#ff00ff',
            });
        });
    } else {
        // Regular enemy: shoots mostly straight down with a wide random spread
        // Slight lean toward player X but heavily jittered — not a lock-on
        const leanX = (sPlayer.x - en.x) / canvas.width * 1.5; // weak lean, max ~1.5px/frame
        const jitter = (Math.random() - 0.5) * 2.8;
        sEBullets.push({
            x: en.x, y: en.y + en.h / 2,
            vx: leanX + jitter,
            vy: spd,
            r: 4,
            color: '#ff6600',
        });
    }
}

// =============================================================================
// SURVIVAL — KILL ENEMY
// =============================================================================
function killSurvivalEnemy(idx) {
    const en = sEnemies[idx];
    createSurvivalParticles(en.x, en.y, en.color, en.isBoss);
    sScore += en.isBoss ? 500 : 100;
    sKills++;

    if (en.isBoss) {
        // Drop 5 coins
        for (let c = 0; c < 5; c++) {
            sCoinDrops.push({
                x: en.x + (Math.random() - 0.5) * 70,
                y: en.y + (Math.random() - 0.5) * 20,
                rot: 0,
            });
        }
        // Guaranteed power-up drop
        dropPowerUp(en.x, en.y);
        sBossActive = false;
        shakeAmt = 18;
        logActivity(`SURVIVAL BOSS KILLED - WAVE: ${sWave}`);
    } else {
        // 45% chance of power-up drop
        if (Math.random() < 0.45) dropPowerUp(en.x, en.y);

        // Spawn boss every KILLS_PER_BOSS kills
        if (sKills > 0 && sKills % KILLS_PER_BOSS === 0 && !sBossActive) {
            sBossActive = true;
            setTimeout(() => { if (survivalActive) spawnSurvivalEnemy(true); }, 800);
            logActivity(`SURVIVAL BOSS INCOMING - WAVE: ${sWave}`);
        }
    }

    sEnemies.splice(idx, 1);
    updateSurvivalHUD();
}

// =============================================================================
// SURVIVAL — POWER-UP DROP
// =============================================================================
function dropPowerUp(x, y) {
    const def = POWER_UP_DEFS[Math.floor(Math.random() * POWER_UP_DEFS.length)];
    sPowerDrops.push({ x, y, rot: 0, pu: { ...def, firstUse: true } });
}

// =============================================================================
// SURVIVAL — TAKE DAMAGE
// =============================================================================
function survivalTakeDamage() {
    if (sPlayer.invincTimer > 0) return;
    sPlayer.lives--;
    sPlayer.invincTimer = 110;
    shakeAmt = 14;
    createSurvivalParticles(sPlayer.x, sPlayer.y, '#ff0044', false);

    if (sPlayer.lives <= 0) {
        endSurvival();
    } else {
        updateSurvivalHUD();
    }
}

// =============================================================================
// SURVIVAL — END
// =============================================================================
function endSurvival() {
    survivalActive = false;
    document.getElementById('survivalHUD').style.display      = 'none';
    document.getElementById('powerupBar').style.display       = 'none';
    document.getElementById('powerupBar-label').style.display = 'none';
    document.getElementById('survFinalWave').innerText  = sWave;
    document.getElementById('survFinalScore').innerText = Math.floor(sScore);
    document.getElementById('survivalOverScreen').style.display = 'flex';
    logActivity(`SURVIVAL END - WAVE: ${sWave} SCORE: ${Math.floor(sScore)}`);
}

// =============================================================================
// SURVIVAL — POWER-UP INVENTORY
// =============================================================================
function addToInventory(pu) {
    for (let i = 0; i < 4; i++) {
        if (!puSlots[i]) {
            puSlots[i] = { ...pu };
            renderPowerUpBar();
            return;
        }
    }
    // All slots full — replace slot 0
    puSlots[0] = { ...pu };
    renderPowerUpBar();
}

// =============================================================================
// FIX #1 — POWER-UP USE
// Original bug: slot was never cleared after use, so first-use flag was consumed
// but the slot lingered with firstUse=false and would silently fail if player
// couldn't afford the coin cost. Now: instant/one-shot powers (bombBlast, shield,
// laserBeam) clear the slot after activation. Timed powers (rapidFire, tripleShot,
// timeSlow) keep the slot so players can reuse with coins, matching the design intent.
// =============================================================================
function usePowerUp(idx) {
    const pu = puSlots[idx];
    if (!pu) return;

    // Check coin cost for reuse (first use is always free)
    if (!pu.firstUse) {
        if (sCoins < pu.cost) return;
        sCoins -= pu.cost;
    }

    // Mark first use consumed
    pu.firstUse = false;

    activatePowerUp(pu);

    // One-shot powers: clear the slot after use so the next drop fills it
    if (pu.type === 'bombBlast' || pu.type === 'shield' || pu.type === 'laserBeam') {
        puSlots[idx] = null;
    }

    renderPowerUpBar();
    updateSurvivalHUD();
    logActivity(`POWER-UP USED: ${pu.label}`);
}

function activatePowerUp(pu) {
    if (pu.type === 'bombBlast') {
        sEBullets = [];
        for (let i = sEnemies.length - 1; i >= 0; i--) {
            if (!sEnemies[i].isBoss) {
                createSurvivalParticles(sEnemies[i].x, sEnemies[i].y, sEnemies[i].color, false);
                sEnemies.splice(i, 1);
            } else {
                sEnemies[i].hp -= 5;
                if (sEnemies[i].hp <= 0) killSurvivalEnemy(i);
            }
        }
        shakeAmt = 20;
        return;
    }
    if (pu.type === 'shield') {
        puEffects.shield.active = true;
        return;
    }
    if (puEffects[pu.type]) {
        puEffects[pu.type].active = true;
        puEffects[pu.type].timer  = pu.duration;
    }
}

// =============================================================================
// SURVIVAL — RENDER POWER-UP BAR (HTML)
// =============================================================================
function renderPowerUpBar() {
    const bar = document.getElementById('powerupBar');
    bar.innerHTML = '';

    for (let i = 0; i < 4; i++) {
        const pu = puSlots[i];
        const slot = document.createElement('div');
        slot.style.cssText = `
            width:64px; height:64px; border:2px solid ${pu ? pu.color : '#333'};
            border-radius:8px; background:rgba(0,0,0,0.85);
            display:flex; flex-direction:column; align-items:center;
            justify-content:center; cursor:pointer; position:relative;
            transition:0.15s; font-family:'Courier New',monospace;
            opacity:${pu ? (pu.firstUse || sCoins >= pu.cost ? '1' : '0.4') : '0.3'};
            box-shadow:${pu ? `0 0 10px ${pu.color}55` : 'none'};
            pointer-events:auto; user-select:none;
        `;

        if (pu) {
            const costLabel = pu.firstUse ? 'FREE' : `${pu.cost}🪙`;
            const canAfford = pu.firstUse || sCoins >= pu.cost;
            slot.innerHTML = `
                <span style="font-size:1.4rem;">${pu.icon}</span>
                <span style="font-size:0.5rem;color:${pu.color};letter-spacing:1px;">${pu.label}</span>
                <span style="position:absolute;bottom:3px;right:5px;font-size:0.5rem;
                    color:${pu.firstUse ? '#00f2ff' : (canAfford ? '#ffaa00' : '#ff0044')};">
                    ${costLabel}
                </span>
                <span style="position:absolute;top:2px;left:5px;font-size:0.55rem;color:#555;">${i+1}</span>
            `;
            slot.onclick = () => usePowerUp(i);
            slot.title = `${pu.label} — ${pu.firstUse ? 'First use FREE' : `Costs ${pu.cost} coins`} — Press ${i+1}`;
        } else {
            slot.innerHTML = `<span style="font-size:0.65rem;color:#333;">[${i+1}]</span>`;
        }

        bar.appendChild(slot);
    }
}

// =============================================================================
// SURVIVAL — DRAW
// =============================================================================
function survivalDraw() {
    // Deep space background
    ctx.fillStyle = '#00010a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scrolling stars
    sStars.forEach(s => {
        ctx.save();
        ctx.globalAlpha = s.bright;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    ctx.save();
    // Screen shake
    if (shakeAmt > 0.1) {
        ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
        shakeAmt *= 0.85;
    }

    // --- Survival particles ---
    sParticles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle   = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // --- Coin drops ---
    sCoinDrops.forEach(c => {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur  = 16;
        ctx.fillStyle   = '#ffcc00';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle   = '#7a4400';
        ctx.font        = 'bold 10px Courier New';
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('¢', 0, 1);
        ctx.restore();
    });

    // --- Power-up drops ---
    sPowerDrops.forEach(d => {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        // Pulsing glow box
        ctx.shadowColor = d.pu.color;
        ctx.shadowBlur  = 20 + Math.sin(Date.now() / 200) * 8;
        ctx.strokeStyle = d.pu.color;
        ctx.lineWidth   = 2;
        ctx.strokeRect(-18, -18, 36, 36);
        ctx.fillStyle   = d.pu.color + '22';
        ctx.fillRect(-18, -18, 36, 36);
        ctx.shadowBlur  = 0;
        ctx.font        = '20px Arial';
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.pu.icon, 0, 0);
        ctx.restore();
    });

    // --- Enemy bullets ---
    sEBullets.forEach(b => {
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur  = 14;
        ctx.fillStyle   = b.color;
        // Elongated plasma teardrop
        const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 0.55, b.r * 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // --- Player bullets ---
    sBullets.forEach(b => {
        if (b.type === 'laser') {
            // Laser beam visual
            ctx.save();
            ctx.globalAlpha = b.life;
            ctx.strokeStyle = '#ff0044';
            ctx.lineWidth   = 8;
            ctx.shadowColor = '#ff0044';
            ctx.shadowBlur  = 35;
            ctx.beginPath();
            ctx.moveTo(b.x, canvas.height);
            ctx.lineTo(b.x, 0);
            ctx.stroke();
            // Inner white core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth   = 2;
            ctx.shadowBlur  = 0;
            ctx.beginPath();
            ctx.moveTo(b.x, canvas.height);
            ctx.lineTo(b.x, 0);
            ctx.stroke();
            ctx.restore();
            return;
        }

        // Bullet trail glow
        ctx.save();
        b.trail.forEach((pt, ti) => {
            const alpha = (ti / b.trail.length) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = b.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, b.r * (ti / b.trail.length), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Bullet core
        ctx.shadowColor = b.color;
        ctx.shadowBlur  = 20;
        ctx.fillStyle   = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r * 0.45, b.r * 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle   = b.color;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    });

    // --- Enemies ---
    sEnemies.forEach(en => {
        ctx.save();
        ctx.translate(en.x, en.y);
        ctx.rotate(en.rot);
        const pulse = 1 + Math.sin(en.pulseT) * 0.08;
        ctx.scale(pulse, pulse);
        ctx.shadowColor = en.color;
        ctx.shadowBlur  = en.isBoss ? 35 : 16;
        ctx.fillStyle   = en.color;

        if (en.isBoss) {
            // Boss: 6-sided hexagon
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
                const a = (s / 6) * Math.PI * 2 - Math.PI / 6;
                s === 0
                    ? ctx.moveTo(Math.cos(a) * en.w / 2, Math.sin(a) * en.h / 2)
                    : ctx.lineTo(Math.cos(a) * en.w / 2, Math.sin(a) * en.h / 2);
            }
            ctx.closePath();
            ctx.fill();

            // Inner detail
            ctx.strokeStyle = '#ffffff44';
            ctx.lineWidth   = 2;
            ctx.stroke();

            // HP bar (drawn after rotation reset)
            ctx.rotate(-en.rot);
            ctx.scale(1 / pulse, 1 / pulse);
            const bw = en.w * 1.2;
            ctx.fillStyle   = '#220000';
            ctx.fillRect(-bw / 2, -en.h / 2 - 16, bw, 8);
            ctx.fillStyle   = '#ff00ff';
            ctx.shadowBlur  = 6;
            ctx.fillRect(-bw / 2, -en.h / 2 - 16, bw * (en.hp / en.maxHp), 8);
        } else {
            // Regular enemy: downward-pointing triangle (nose toward player)
            ctx.beginPath();
            ctx.moveTo(0,          en.h / 2);
            ctx.lineTo( en.w / 2, -en.h / 2);
            ctx.lineTo(-en.w / 2, -en.h / 2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    });

    // --- Shield aura ---
    if (puEffects.shield.active) {
        ctx.save();
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00f2ff';
        ctx.shadowBlur  = 24;
        ctx.globalAlpha = 0.55 + Math.sin(Date.now() / 100) * 0.3;
        ctx.beginPath();
        ctx.arc(sPlayer.x, sPlayer.y, sPlayer.w, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // --- Player ship ---
    ctx.save();
    ctx.translate(sPlayer.x, sPlayer.y);
    // no rotation — PNG already faces upward
    ctx.shadowBlur  = 20;
    ctx.shadowColor = sPlayer.invincTimer > 0 ? '#ffff00' : '#00f2ff';
    if (sPlayer.invincTimer > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 55) * 0.5;
    }
    ctx.drawImage(shipImg, -sPlayer.w / 2, -sPlayer.h / 2, sPlayer.w, sPlayer.h);
    ctx.restore();

    // --- Engine thruster ---
    ctx.save();
    const eY = sPlayer.y + sPlayer.h / 2;
    const flicker = 20 + Math.random() * 18;
    const grad = ctx.createLinearGradient(sPlayer.x, eY, sPlayer.x, eY + flicker + 12);
    grad.addColorStop(0,   '#00f2ffdd');
    grad.addColorStop(0.5, '#0044ffaa');
    grad.addColorStop(1,   'transparent');
    ctx.fillStyle   = grad;
    ctx.shadowColor = '#00f2ff';
    ctx.shadowBlur  = 14;
    ctx.beginPath();
    ctx.moveTo(sPlayer.x - 9,  eY);
    ctx.lineTo(sPlayer.x + 9,  eY);
    ctx.lineTo(sPlayer.x + 2,  eY + flicker);
    ctx.lineTo(sPlayer.x - 2,  eY + flicker);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- Active power-up status strips ---
    let stripY = 110;
    Object.entries(puEffects).forEach(([k, v]) => {
        if (!v.active) return;
        const def = POWER_UP_DEFS.find(p => p.type === k);
        if (!def) return;
        const pct = def.duration > 0 ? Math.max(0, v.timer / def.duration) : 1;

        ctx.save();
        ctx.fillStyle   = 'rgba(0,0,0,0.75)';
        ctx.fillRect(18, stripY, 140, 28);
        ctx.strokeStyle = def.color;
        ctx.lineWidth   = 1;
        ctx.strokeRect(18, stripY, 140, 28);
        ctx.font        = '12px Courier New';
        ctx.fillStyle   = def.color;
        ctx.textBaseline = 'middle';
        ctx.fillText(`${def.icon} ${def.label}`, 26, stripY + 14);
        if (def.duration > 0) {
            ctx.fillStyle = def.color + '44';
            ctx.fillRect(90, stripY + 7, 58, 14);
            ctx.fillStyle = def.color;
            ctx.fillRect(90, stripY + 7, 58 * pct, 14);
        }
        ctx.restore();
        stripY += 34;
    });

    ctx.restore(); // end shake
}

// =============================================================================
// SURVIVAL — PARTICLES
// =============================================================================
function createSurvivalParticles(x, y, color, big) {
    const count = big ? 45 : 11;
    for (let i = 0; i < count; i++) {
        sParticles.push({
            x, y,
            vx: (Math.random() - 0.5) * (big ? 10 : 5),
            vy: (Math.random() - 0.5) * (big ? 10 : 5),
            size: Math.random() * (big ? 7 : 3) + 1,
            life: 1.0,
            color,
        });
    }
}

// =============================================================================
// SURVIVAL — HUD UPDATE
// =============================================================================
function updateSurvivalHUD() {
    const hearts = '❤️'.repeat(Math.max(0, sPlayer.lives)) || '💀';
    document.getElementById('sLives').innerText  = hearts;
    document.getElementById('sWave').innerText   = sWave;
    document.getElementById('sCoins').innerText  = sCoins;
    document.getElementById('sScore').innerText  = Math.floor(sScore);
    renderPowerUpBar();
}

// =============================================================================
// SURVIVAL — MAIN LOOP
// =============================================================================
function survivalLoop() {
    survivalUpdate();
    survivalDraw();
    if (survivalActive && !isPaused) requestAnimationFrame(survivalLoop);
}

// =============================================================================
// SURVIVAL — MOBILE TOUCH CONTROLS
// =============================================================================
let _touchX = 0;
canvas.addEventListener('touchstart', e => {
    if (!survivalActive) return;
    _touchX = e.touches[0].clientX;
    survivalShoot();
}, { passive: true });

canvas.addEventListener('touchmove', e => {
    if (!survivalActive) return;
    const dx = e.touches[0].clientX - _touchX;
    sPlayer.x = Math.max(sPlayer.w / 2,
        Math.min(canvas.width - sPlayer.w / 2, sPlayer.x + dx * 0.6));
    _touchX = e.touches[0].clientX;
    survivalShoot();
}, { passive: true });

// Spacebar hold tracking
window.addEventListener('keydown', e => {
    if (e.key === ' ' && survivalActive && !isPaused) sKeys.space = true;
});
window.addEventListener('keyup', e => {
    if (e.key === ' ') sKeys.space = false;
});

// =============================================================================
// RESIZE
// =============================================================================
window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (survivalActive) sPlayer.y = canvas.height - 100;
});