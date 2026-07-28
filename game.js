// --- CORE SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === SENTRON CONFIG & CHEAT STATE ===
let playerName = "Pilot";
let hasTrailAbility = false;
let isInvincible = false;
let slowMotion = false;
let zeroCooldown = false;
let shipTrail = [];

let gameActive = false;
let isPaused = false;
let score = 0;
let difficulty = 1;
let selectedShipSrc = 'rocket.png';
const shipImg = new Image();

let gameLoopId = 0;

let player = { x: canvas.width/2, y: canvas.height/2, size: 38, angle: 0 };
let enemies = [];
let particles = [];
let mouse = { x: canvas.width/2, y: canvas.height/2 };

let lastPulse = 0, lastSuper = 0, lastScoreTime = 0;
let nextBossTime = 0, flashEffect = { timer: 0, color: '#fff', size: 0 };
let shakeAmt = 0;

// --- DEVELOPER REGISTRATION ---
function setPlayerName(inputName) {
    playerName = inputName;
    hasTrailAbility = false;
    isInvincible = false;
    slowMotion = false;
    zeroCooldown = false;

    if (playerName === "BLUE_PHOENIX") {
        hasTrailAbility = true; isInvincible = true; slowMotion = true; zeroCooldown = true;
        logActivity("DEVELOPER CHEAT CODE ACTIVATED");
    } else if (playerName === "PHOENIX_ARMOR") {
        isInvincible = true; logActivity("DEVELOPER MATRIX: INVINCIBILITY");
    } else if (playerName === "CHRONO_BREAK") {
        slowMotion = true; logActivity("DEVELOPER MATRIX: CHRONO SLOW");
    } else if (playerName === "SINGULARITY_CORE") {
        zeroCooldown = true; logActivity("DEVELOPER MATRIX: ZERO CD");
    } else if (playerName === "VORTEX_MAGNET") {
        logActivity("DEVELOPER MATRIX: PASSIVE MULTIPLIER");
    } else if (playerName === "PHOENIX_TRAIL") {
        hasTrailAbility = true; logActivity("DEVELOPER MATRIX: ENERGY TRAIL");
    }
}

// --- MENU NAVIGATION ---
function showLogin() {
    document.getElementById('rulesOverlay').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
    const inputField = document.getElementById('playerInput');
    if (inputField) inputField.setAttribute('maxlength', '30');
}

function goToShipSelect() {
    const val = document.getElementById('playerInput').value.trim();
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
    score = 0; enemies = []; particles = []; shipTrail = [];
    gameActive = true; isPaused = false;
    lastPulse = Date.now(); lastSuper = Date.now();
    lastScoreTime = Date.now(); nextBossTime = Date.now() + 45000;
    document.getElementById('survivalHUD').style.display      = 'none';
    document.getElementById('powerupBar').style.display       = 'none';
    document.getElementById('powerupBar-label').style.display = 'none';
    document.querySelector('.ui-layer').style.display = 'block';
    logActivity(`MISSION START: ${playerName}`);
    const myLoopId = ++gameLoopId;
    requestAnimationFrame(() => gameLoop(myLoopId));
}

// --- SYSTEM HANDLERS ---
function togglePause() {
    if (!gameActive && !survivalActive) return;
    isPaused = !isPaused;
    if (survivalActive) {
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('survivalPauseMenu').style.display = isPaused ? 'flex' : 'none';
        if (!isPaused) closeSurvivalInventory();
    } else {
        document.getElementById('pauseMenu').style.display = isPaused ? 'flex' : 'none';
    }
    logActivity(isPaused ? "GAME PAUSED" : "GAME RESUMED");
    if (!isPaused) {
        if (survivalActive) requestAnimationFrame(() => survivalLoop(survivalLoopId));
        else requestAnimationFrame(() => gameLoop(gameLoopId));
    }
}

window.addEventListener('keydown', e => {
    if (e.key === "Escape") togglePause();
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
    gameActive = false; shakeAmt = 15;
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
    document.getElementById('survivalPauseMenu').style.display   = 'none';
    document.getElementById('survivalInventory').style.display   = 'none';
    document.getElementById('shipMenu').style.display            = 'flex';
    survivalActive = false;
    gameActive = false;
}

// --- SHATTER & PARTICLES ---
function createShatter(x, y, color, isBoss) {
    const count = isBoss ? 50 : 12;
    for (let i = 0; i < count; i++) {
        particles.push({ x, y, vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, size:Math.random()*4+2, life:1.0, color });
    }
}

// --- CLASSIC GAMEPLAY ---
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => {
    if (survivalActive) return;
    if (!gameActive || isPaused) return;
    if (e.button === 0) triggerPulse(false);
    if (e.button === 2) triggerPulse(true);
});
window.addEventListener('contextmenu', e => e.preventDefault());

function spawnEnemy(isBoss = false) {
    const size = isBoss ? 110 : 30;
    let baseSpeed = (1.6 + (difficulty * 0.7));
    if (slowMotion) baseSpeed *= 0.5;
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
    if (zeroCooldown || (now - last >= cd)) {
        flashEffect = { timer:25, color:isSuper?'#ffff00':'#00f2ff', size:range };
        shakeAmt = isSuper ? 10 : 5;
        enemies = enemies.filter(en => {
            const dist = Math.hypot(player.x-en.x, player.y-en.y);
            if (dist < range) {
                if (en.isBoss && !isSuper) return true;
                createShatter(en.x, en.y, en.isBoss?'#bc13fe':'#ff0044', en.isBoss);
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
    player.x += (mouse.x - player.x) * 0.12;
    player.y += (mouse.y - player.y) * 0.12;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;
    if (hasTrailAbility) {
        shipTrail.push({ x:player.x, y:player.y });
        if (shipTrail.length > 40) shipTrail.shift();
    } else { shipTrail = []; }
    if (Date.now() - lastScoreTime > 1000) {
        score += (playerName==="BLUE_PHOENIX"||playerName==="VORTEX_MAGNET") ? 10 : 1;
        lastScoreTime = Date.now();
        document.getElementById('scr').innerText = score;
    }
    const pWait = zeroCooldown ? 0 : Math.max(0, Math.ceil((6000-(Date.now()-lastPulse))/1000));
    const sWait = zeroCooldown ? 0 : Math.max(0, Math.ceil((25000-(Date.now()-lastSuper))/1000));
    document.getElementById('pCharge').innerText = pWait===0 ? "READY" : pWait+"S";
    document.getElementById('sCharge').innerText = sWait===0 ? "READY" : sWait+"S";
    if (Math.random() < 0.04+(difficulty*0.015)) spawnEnemy(false);
    if (Date.now() > nextBossTime) { spawnEnemy(true); nextBossTime = Date.now()+45000; }
    for (let i = enemies.length-1; i >= 0; i--) {
        let en = enemies[i];
        const d = Math.hypot(player.x-en.x, player.y-en.y);
        en.x += ((player.x-en.x)/d)*en.speed;
        en.y += ((player.y-en.y)/d)*en.speed;
        en.rot += 0.02;
        if (hasTrailAbility) {
            let elim = false;
            for (let j = 0; j < shipTrail.length; j++) {
                const pt = shipTrail[j];
                if (pt.x > en.x-en.size/2 && pt.x < en.x+en.size/2 &&
                    pt.y > en.y-en.size/2 && pt.y < en.y+en.size/2) { elim=true; break; }
            }
            if (elim) {
                createShatter(en.x,en.y,en.isBoss?'#bc13fe':'#ff0044',en.isBoss);
                enemies.splice(i,1); score+=300;
                document.getElementById('scr').innerText = score;
                logActivity("TRAIL ELIMINATED SENTRON"); continue;
            }
        }
        if (d < (player.size*0.7)+(en.size*0.7)) {
            if (isInvincible) {
                createShatter(en.x,en.y,en.isBoss?'#bc13fe':'#ff0044',en.isBoss);
                enemies.splice(i,1); score+=300;
                document.getElementById('scr').innerText = score;
                logActivity("ARMOR CRUSHED SENTRON");
            } else { gameOver(); }
        }
    }
    particles.forEach((p,i) => { p.x+=p.vx; p.y+=p.vy; p.life-=0.02; if(p.life<=0)particles.splice(i,1); });
    if (shakeAmt > 0) shakeAmt *= 0.9;
}

function draw() {
    ctx.fillStyle = 'rgba(0,5,15,0.4)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();
    if (shakeAmt > 0.1) ctx.translate((Math.random()-0.5)*shakeAmt,(Math.random()-0.5)*shakeAmt);
    particles.forEach(p => { ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size); });
    ctx.globalAlpha=1;
    if (gameActive && hasTrailAbility && shipTrail.length > 1) {
        ctx.save();
        ctx.beginPath(); ctx.strokeStyle="#00d2ff"; ctx.shadowColor="#0066ff";
        ctx.shadowBlur=15; ctx.lineWidth=8; ctx.lineCap="round"; ctx.lineJoin="round";
        ctx.moveTo(shipTrail[0].x,shipTrail[0].y);
        for (let i=1;i<shipTrail.length;i++) ctx.lineTo(shipTrail[i].x,shipTrail[i].y);
        ctx.stroke(); ctx.restore();
    }
    enemies.forEach(en => {
        ctx.save(); ctx.translate(en.x,en.y); ctx.rotate(en.rot);
        ctx.shadowBlur=en.isBoss?20:10; ctx.shadowColor=en.isBoss?'#bc13fe':'#ff0044'; ctx.fillStyle=en.isBoss?'#bc13fe':'#ff0044';
        if (en.isBoss) ctx.fillRect(-en.size/2,-en.size/2,en.size,en.size);
        else { ctx.beginPath(); ctx.moveTo(0,-en.size/2); ctx.lineTo(en.size/2,en.size/2); ctx.lineTo(-en.size/2,en.size/2); ctx.fill(); }
        ctx.restore();
    });
    ctx.save(); ctx.translate(player.x,player.y); ctx.rotate(player.angle);
    ctx.shadowBlur=15; ctx.shadowColor='#00f2ff';
    ctx.drawImage(shipImg,-player.size,-player.size,player.size*2,player.size*2);
    ctx.restore();
    if (flashEffect.timer > 0) {
        ctx.beginPath(); ctx.arc(player.x,player.y,flashEffect.size*(1-flashEffect.timer/25),0,Math.PI*2);
        ctx.strokeStyle=flashEffect.color; ctx.lineWidth=flashEffect.timer; ctx.stroke(); flashEffect.timer--;
    }
    ctx.restore();
}

function gameLoop(loopId) {
    if (loopId !== gameLoopId) return;
    update(); draw();
    if (gameActive && !isPaused) requestAnimationFrame(() => gameLoop(loopId));
}

async function logActivity(action) {
    const url = "https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log";
    const pName = typeof playerName!=='undefined' && playerName ? playerName : "Pilot";
    const currentScore = typeof score!=='undefined' ? score : 0;
    const formBody = `player=${encodeURIComponent(pName)}&action=${encodeURIComponent(action)}&score=${encodeURIComponent(currentScore)}`;
    fetch(url,{method:"POST",mode:"cors",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:formBody}).catch(()=>{});
}


// =============================================================================
//   SURVIVAL MODE
// =============================================================================

let survivalActive = false;
const sKeys = { left:false, right:false, up:false, down:false, space:false };

let sPlayer = { x:0, y:0, w:52, h:52, speed:6, lives:3, invincTimer:0 };

let sBullets    = [];
let sEnemies    = [];
let sEBullets   = [];
let sPowerDrops = [];
let sCoinDrops  = [];
let sParticles  = [];
let sMines      = [];   // for mineField power-up

let sScore      = 0;
let sCoins      = 0;
let sWave       = 1;
let sKills      = 0;
let sBossActive = false;
let sWaveAdvancing = false;
let sWaveId     = 0;

// --- COMBO SYSTEM ---
// Every 10 kills in a row without TAKING DAMAGE = +1 coin spawned on field.
// Breaking a combo (enemy escaping bottom, or getting hit) NEVER costs a life.
let sComboStreak = 0;
let sComboMult   = 1;
const COMBO_THRESHOLDS = [
    { streak:0,  mult:1   },
    { streak:8,  mult:1.5 },
    { streak:18, mult:2   },
    { streak:32, mult:3   },
];

let sSessionBestScore = 0;
let sSessionBestWave  = 1;
let sToasts = [];
let survivalLoopId = 0;
const KILLS_PER_BOSS = 20;
let sDiscoveredPowerUps = new Set();
let puSlots = [null, null, null, null];

let puEffects = {
    rapidFire:   { active:false, timer:0 },
    shield:      { active:false, timer:0 },
    laserBeam:   { active:false, timer:0 },
    tripleShot:  { active:false, timer:0 },
    bombBlast:   { active:false, timer:0 },
    timeSlow:    { active:false, timer:0 },
    homing:      { active:false, timer:0 },
    scoreBoost:  { active:false, timer:0 },
    extraLife:   { active:false, timer:0 },
    // batch 2
    waveBlast:   { active:false, timer:0 },
    coinMagnet:  { active:false, timer:0 },
    sniperMode:  { active:false, timer:0 },
    freezeField: { active:false, timer:0 },
    bulletWall:  { active:false, timer:0 },
    overcharge:  { active:false, timer:0 },
    // batch 3
    empBlast:      { active:false, timer:0 },
    dualShot:      { active:false, timer:0 },
    lifeSteal:     { active:false, timer:0 },
    turretMode:    { active:false, timer:0 },
    mineField:     { active:false, timer:0 },
    // batch 4 — new
    ricochets:     { active:false, timer:0 },
    goldRush:      { active:false, timer:0 },
    phaseShift:    { active:false, timer:0 },
    chainLightning:{ active:false, timer:0 },
    berserker:     { active:false, timer:0 },
};

let sLastShot = 0;
let sTurretLastShot = 0;
const S_SHOOT_DELAY = 220;

const sStars = [];
for (let i = 0; i < 140; i++) {
    sStars.push({ x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*1.6+0.3, spd:Math.random()*1.2+0.3, bright:Math.random()*0.6+0.4 });
}

// =============================================================================
// POWER-UP DEFINITIONS — full list including all 3 batches
// =============================================================================
const POWER_UP_DEFS = [
    // ── ORIGINAL 9 ────────────────────────────────────────────────────────────
    { type:'rapidFire',  icon:'⚡', label:'RAPID FIRE',  cost:5,  color:'#ffff00', duration:8000  },
    { type:'shield',     icon:'🛡', label:'SHIELD',       cost:6,  color:'#00f2ff', duration:0     },
    { type:'laserBeam',  icon:'🔴', label:'LASER',        cost:7,  color:'#ff0044', duration:5000  },
    { type:'tripleShot', icon:'🔱', label:'TRIPLE SHOT',  cost:5,  color:'#bc13fe', duration:7000  },
    { type:'bombBlast',  icon:'💥', label:'BOMB',         cost:6,  color:'#ff8800', duration:0     },
    { type:'timeSlow',   icon:'⏱', label:'SLOW-MO',      cost:5,  color:'#00ffaa', duration:6000  },
    { type:'homing',     icon:'🎯', label:'HOMING',       cost:8,  color:'#66ff66', duration:9000  },
    { type:'scoreBoost', icon:'✨', label:'2X SCORE',     cost:7,  color:'#ffd700', duration:10000 },
    { type:'extraLife',  icon:'❤️', label:'EXTRA LIFE',  cost:10, color:'#ff3366', duration:0     },
    // ── BATCH 2 ───────────────────────────────────────────────────────────────
    { type:'waveBlast',  icon:'🌊', label:'WAVE BLAST',  cost:5,  color:'#00ccff', duration:0     },
    { type:'coinMagnet', icon:'🧲', label:'MAGNET',       cost:4,  color:'#ffd700', duration:7000  },
    { type:'sniperMode', icon:'💠', label:'SNIPER',       cost:9,  color:'#ff6666', duration:6000  },
    { type:'freezeField',icon:'❄️', label:'FREEZE',       cost:7,  color:'#aaddff', duration:3500  },
    { type:'bulletWall', icon:'🔷', label:'BULLET WALL', cost:6,  color:'#4488ff', duration:5000  },
    { type:'overcharge', icon:'🔋', label:'OVERCHARGE',  cost:8,  color:'#ff44ff', duration:5000  },
    // ── BATCH 3 (NEW) ─────────────────────────────────────────────────────────
    // empBlast: silences all enemies — they cannot shoot for 6 seconds
    { type:'empBlast',   icon:'📡', label:'EMP BLAST',   cost:6,  color:'#ffcc00', duration:6000  },
    // dualShot: fires bullets both upward AND downward simultaneously
    { type:'dualShot',   icon:'↕️', label:'DUAL SHOT',   cost:6,  color:'#ff88ff', duration:7000  },
    // lifeSteal: every kill has a 20% chance to drop a bonus coin directly
    { type:'lifeSteal',  icon:'🩸', label:'LIFE STEAL',  cost:5,  color:'#ff2244', duration:10000 },
    // turretMode: auto-fires at full rate without holding space
    { type:'turretMode', icon:'🗼', label:'TURRET',       cost:7,  color:'#aaffaa', duration:5000  },
    // mineField: scatters 6 proximity mines that explode on enemy contact
    { type:'mineField',     icon:'💣', label:'MINE FIELD',     cost:7,  color:'#ff9900', duration:0     },
    // ── BATCH 4 (NEW) ─────────────────────────────────────────────────────────
    // ricochets: your bullets bounce off the left and right walls (up to 3 times each)
    { type:'ricochets',     icon:'↩️', label:'RICOCHETS',      cost:6,  color:'#88ffee', duration:9000  },
    // goldRush: every enemy killed drops a coin for 8 seconds
    { type:'goldRush',      icon:'💰', label:'GOLD RUSH',      cost:8,  color:'#ffd700', duration:8000  },
    // phaseShift: you become untouchable for 3 seconds (bullets and bodies pass through)
    { type:'phaseShift',    icon:'👻', label:'PHASE SHIFT',    cost:9,  color:'#cc88ff', duration:3000  },
    // chainLightning: each bullet hit chains to up to 2 nearby enemies
    { type:'chainLightning',icon:'🌩', label:'CHAIN BOLT',     cost:9,  color:'#aaff00', duration:7000  },
    // berserker: triples movement speed and auto-fires rapidly for 4 seconds
    { type:'berserker',     icon:'🔥', label:'BERSERKER',      cost:10, color:'#ff4400', duration:4000  },
];

// =============================================================================
// SURVIVAL — DOM INJECTION (survivalPauseMenu + survivalInventory)
// =============================================================================
(function injectSurvivalDOM() {
    if (!document.getElementById('survivalPauseMenu')) {
        const pm = document.createElement('div');
        pm.id = 'survivalPauseMenu';
        pm.className = 'menu-overlay';
        pm.style.display = 'none';
        pm.innerHTML = `
            <div class="terminal-box" style="border-color:#ffaa00;box-shadow:0 0 40px #ffaa00;min-width:340px;">
                <h1 style="color:#ffaa00;">⚡ PAUSED</h1>
                <button class="btn" style="background:#ffaa00;color:#000;" onclick="togglePause()">RESUME</button>
                <button class="btn" style="background:#bc13fe;color:#fff;margin-top:6px;" onclick="openSurvivalInventory()">📦 SHOP / INVENTORY</button>
                <button class="btn" style="margin-top:6px;" onclick="backToMenu()">QUIT</button>
            </div>
        `;
        document.body.appendChild(pm);
    }

    if (!document.getElementById('survivalInventory')) {
        const inv = document.createElement('div');
        inv.id = 'survivalInventory';
        inv.className = 'menu-overlay';
        inv.style.cssText = 'display:none;z-index:2000;';
        inv.innerHTML = `
            <div class="terminal-box" style="border-color:#bc13fe;box-shadow:0 0 40px #bc13fe;
                 min-width:540px;max-width:720px;max-height:90vh;overflow-y:auto;">
                <h2 style="color:#bc13fe;letter-spacing:3px;margin-bottom:4px;">📦 SHOP &amp; INVENTORY</h2>
                <div style="display:flex;justify-content:center;gap:28px;margin:8px 0 16px;flex-wrap:wrap;">
                    <div style="text-align:center;">
                        <span style="font-size:0.55rem;color:#ffaa0099;letter-spacing:3px;display:block;">COINS</span>
                        <span id="invCoins" style="font-size:1.5rem;color:#ffaa00;font-weight:bold;">0</span>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.55rem;color:#ffaa0099;letter-spacing:3px;display:block;">WAVE</span>
                        <span id="invWave" style="font-size:1.5rem;color:#fff;font-weight:bold;">1</span>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.55rem;color:#ffaa0099;letter-spacing:3px;display:block;">STREAK</span>
                        <span id="invStreak" style="font-size:1.5rem;color:#ffaa00;font-weight:bold;">0</span>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.55rem;color:#ffaa0099;letter-spacing:3px;display:block;">MULT</span>
                        <span id="invMult" style="font-size:1.5rem;color:#ffaa00;font-weight:bold;">x1</span>
                    </div>
                </div>

                <p style="color:#ff004488;font-size:0.6rem;letter-spacing:2px;margin-bottom:8px;">ACTIVE SLOTS — press 1-4 in-game to activate</p>
                <div id="invSlots" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;"></div>

                <hr style="border-color:#333;margin:10px 0;">
                <p style="color:#bc13fe88;font-size:0.6rem;letter-spacing:2px;margin-bottom:8px;">BUY POWER-UPS — spend coins to fill a slot</p>
                <div id="inventoryGrid" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;"></div>

                <hr style="border-color:#333;margin:10px 0;">
                <p style="color:#ffaa0055;font-size:0.52rem;letter-spacing:1.5px;line-height:1.6;">
                    💡 Every <b style="color:#ffaa00">10 kills in a row</b> = +1 coin spawned on the field &nbsp;·&nbsp;
                    Breaking a combo costs <b style="color:#00f2ff">NO lives</b>
                </p>
                <button class="btn" style="background:#bc13fe;color:#fff;margin-top:12px;" onclick="closeSurvivalInventory()">CLOSE</button>
            </div>
        `;
        document.body.appendChild(inv);
    }
})();

// =============================================================================
// SURVIVAL — INVENTORY / SHOP
// =============================================================================
function openSurvivalInventory() {
    renderInventoryShop();
    document.getElementById('survivalInventory').style.display = 'flex';
}

function closeSurvivalInventory() {
    document.getElementById('survivalInventory').style.display = 'none';
}

function renderInventoryShop() {
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.innerText=val; };
    set('invCoins',  sCoins);
    set('invWave',   sWave);
    set('invStreak', sComboStreak);
    set('invMult',   `x${sComboMult}`);

    // Active slots
    const slotsEl = document.getElementById('invSlots');
    if (slotsEl) {
        slotsEl.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const pu = puSlots[i];
            const cell = document.createElement('div');
            cell.style.cssText = `
                width:88px;height:88px;border:2px solid ${pu?pu.color:'#333'};
                border-radius:8px;background:rgba(0,0,0,0.9);display:flex;
                flex-direction:column;align-items:center;justify-content:center;
                cursor:${pu?'pointer':'default'};font-family:'Courier New',monospace;
                box-shadow:${pu?`0 0 12px ${pu.color}55`:'none'};
            `;
            if (pu) {
                const costLabel = pu.firstUse ? 'FREE' : `${pu.cost}🪙`;
                const canAfford = pu.firstUse || sCoins >= pu.cost;
                cell.innerHTML = `
                    <span style="font-size:1.6rem;">${pu.icon}</span>
                    <span style="font-size:0.45rem;color:${pu.color};letter-spacing:1px;margin-top:3px;">${pu.label}</span>
                    <span style="font-size:0.42rem;color:#888;margin-top:2px;">SLOT ${i+1} · key ${i+1}</span>
                    <span style="font-size:0.45rem;color:${canAfford?'#ffaa00':'#ff4444'};margin-top:1px;">${costLabel}</span>
                `;
                cell.onclick = () => { usePowerUp(i); renderInventoryShop(); };
            } else {
                cell.innerHTML = `<span style="font-size:0.6rem;color:#333;">[EMPTY ${i+1}]</span>`;
            }
            slotsEl.appendChild(cell);
        }
    }

    // Shop grid — all power-ups listed, greyed if unaffordable
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;
    grid.innerHTML = '';
    POWER_UP_DEFS.forEach(def => {
        const canAfford = sCoins >= def.cost;
        const card = document.createElement('div');
        card.style.cssText = `
            width:100px;padding:10px 6px;border:2px solid ${canAfford?def.color:'#333'};
            border-radius:10px;background:rgba(0,0,0,0.92);
            display:flex;flex-direction:column;align-items:center;gap:4px;
            cursor:${canAfford?'pointer':'not-allowed'};
            opacity:${canAfford?'1':'0.38'};
            box-shadow:${canAfford?`0 0 10px ${def.color}44`:'none'};
            transition:0.15s;font-family:'Courier New',monospace;text-align:center;
        `;
        card.innerHTML = `
            <span style="font-size:1.7rem;">${def.icon}</span>
            <span style="font-size:0.48rem;color:${def.color};letter-spacing:1px;">${def.label}</span>
            <span style="font-size:0.6rem;color:${canAfford?'#ffaa00':'#ff4444'};font-weight:bold;">${def.cost}🪙</span>
        `;
        if (canAfford) {
            card.onclick = () => buyFromInventory(def.type);
            card.onmouseenter = () => card.style.transform='scale(1.06)';
            card.onmouseleave = () => card.style.transform='scale(1)';
        }
        grid.appendChild(card);
    });
}

function buyFromInventory(type) {
    const def = POWER_UP_DEFS.find(d => d.type===type);
    if (!def || sCoins < def.cost) return;
    const emptySlot = puSlots.findIndex(s => s===null);
    if (emptySlot === -1) puSlots[0] = { ...def, firstUse:true };
    else puSlots[emptySlot] = { ...def, firstUse:true };
    sCoins -= def.cost;
    sDiscoveredPowerUps.add(type);
    updateSurvivalHUD(); renderPowerUpBar(); renderInventoryShop();
    logActivity(`SHOP PURCHASE: ${def.label}`);
}

// =============================================================================
// SURVIVAL — START
// =============================================================================
function startSurvival() {
    shipImg.src = selectedShipSrc;
    document.getElementById('shipMenu').style.display             = 'none';
    document.getElementById('gameOverScreen').style.display       = 'none';
    document.getElementById('survivalOverScreen').style.display   = 'none';
    document.querySelector('.ui-layer').style.display             = 'none';
    document.getElementById('survivalPauseMenu').style.display    = 'none';
    document.getElementById('survivalInventory').style.display    = 'none';
    document.getElementById('survivalHUD').style.display          = 'flex';
    document.getElementById('powerupBar').style.display           = 'flex';
    document.getElementById('powerupBar-label').style.display     = 'block';

    survivalActive=true; gameActive=false; isPaused=false;

    sPlayer.x=canvas.width/2; sPlayer.y=canvas.height-100;
    sPlayer.lives=3; sPlayer.invincTimer=0;

    sBullets=[]; sEnemies=[]; sEBullets=[];
    sPowerDrops=[]; sCoinDrops=[]; sParticles=[]; sToasts=[]; sMines=[];

    sScore=0; sCoins=0; sWave=1; sKills=0;
    sBossActive=false; sWaveId=0; sWaveAdvancing=false;
    sComboStreak=0; sComboMult=1;
    sLastShot=Date.now(); sTurretLastShot=Date.now();
    sDiscoveredPowerUps=new Set();
    puSlots=[null,null,null,null];
    Object.keys(puEffects).forEach(k=>{ puEffects[k].active=false; puEffects[k].timer=0; });

    sStars.forEach(s=>{ s.x=Math.random()*canvas.width; s.y=Math.random()*canvas.height; });

    updateSurvivalHUD(); renderPowerUpBar(); spawnSurvivalWave();
    logActivity(`SURVIVAL START: ${playerName}`);
    const myLoopId = ++survivalLoopId;
    requestAnimationFrame(() => survivalLoop(myLoopId));
}

// =============================================================================
// SURVIVAL — WAVE SPAWNING
// Hard cap at 8 enemies per wave. Difficulty comes from enemy STATS
// (speed, HP, type variety) not sheer numbers.
//   Wave 1 : 3–4 enemies
//   Wave 2 : 4–5 enemies
//   Wave 3 : 5–6 enemies
//   Wave 4 : 6–7 enemies
//   Wave 5+: 7–8 enemies (hard cap)
// =============================================================================
function getWaveEnemyCount(wave) {
    const base   = Math.min(2 + wave, 7);          // 3 / 4 / 5 / 6 / 7 / 7 / 7 …
    const spread = Math.floor(Math.random() * 2);  // 0 or +1 random
    return base + spread;
}

function spawnSurvivalWave() {
    const count    = getWaveEnemyCount(sWave);
    const myWaveId = ++sWaveId;
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            if (!survivalActive || sWaveId!==myWaveId) return;
            spawnSurvivalEnemy(false);
        }, i * 1400);
    }
}

// =============================================================================
// SURVIVAL — ENEMY TYPES
// =============================================================================
const ENEMY_TYPE_UNLOCK_WAVE = { diver:2, splitter:3, shielded:4 };

function pickSurvivalEnemyType(wave) {
    const pool = ['grunt'];
    if (wave >= ENEMY_TYPE_UNLOCK_WAVE.diver)    pool.push('diver','diver');
    if (wave >= ENEMY_TYPE_UNLOCK_WAVE.splitter) pool.push('splitter');
    if (wave >= ENEMY_TYPE_UNLOCK_WAVE.shielded) pool.push('shielded');
    return pool[Math.floor(Math.random()*pool.length)];
}

function spawnSurvivalEnemy(isBoss, forcedType) {
    const enemyType = isBoss ? 'boss' : (forcedType||pickSurvivalEnemyType(sWave));
    const sizeByType = { grunt:36, diver:32, splitter:44, shielded:40, boss:84, mini:22 };
    const w = sizeByType[enemyType]||36, h=w;
    const x = Math.random()*(canvas.width-w*2)+w;

    const speedMultByType = { grunt:1, diver:1.35, splitter:0.75, shielded:0.85, boss:1, mini:1.5 };
    const baseSpd = (isBoss ? 0.6 : 0.85+sWave*0.10) * (speedMultByType[enemyType]||1);
    const frozen  = puEffects.timeSlow.active||puEffects.freezeField.active;
    const spd     = frozen ? (puEffects.freezeField.active ? 0 : baseSpd*0.45) : baseSpd;

    let hp;
    if (isBoss) hp = 18+sWave*4;
    else if (enemyType==='mini') hp=1;
    else { const base=Math.max(1,Math.floor(1+(sWave-1)*0.6)); hp=base+({splitter:2,shielded:1}[enemyType]||0); }

    const zigzagCapable = !isBoss && enemyType!=='diver' && enemyType!=='mini';
    const zigzagAmplitude = zigzagCapable ? Math.max(0,(sWave-1)*0.25) : 0;
    const zigzagSpeed     = zigzagCapable ? 0.022+(sWave-1)*0.007+Math.random()*0.012 : 0;

    const colorByType = { grunt:'#ff0044', diver:'#ff6a00', splitter:'#ff00aa', shielded:'#00c8ff', boss:'#bc13fe', mini:'#ff4488' };

    const enemy = {
        x, y:-h/2-10, w, h,
        speed:spd, baseSpeed:baseSpd,
        isBoss, enemyType, hp, maxHp:hp, rot:0,
        lastShot: Date.now()+Math.random()*3000,
        shootInterval: isBoss ? 2200 : 3500+Math.random()*2500,
        color: colorByType[enemyType]||'#ff0044',
        pulseT:0, zigzagAmplitude, zigzagSpeed,
        zigzagT: Math.random()*Math.PI*2, baseX:x,
        silenced: false,   // set true by empBlast
    };

    if (enemyType==='diver') {
        enemy.diverState='falling';
        enemy.diverTriggerY=canvas.height*(0.35+Math.random()*0.15);
        enemy.dashVx=0; enemy.dashVy=0;
    }
    if (enemyType==='shielded') {
        enemy.shieldHp=3+Math.floor(sWave*0.4);
        enemy.shieldMaxHp=enemy.shieldHp;
        enemy.shieldRot=0; enemy.shieldRegenAt=0; enemy.shieldBroken=false;
    }

    sEnemies.push(enemy);
    return enemy;
}

// =============================================================================
// SURVIVAL — SHOOTING
// =============================================================================
function survivalShoot() {
    const now   = Date.now();
    const delay = puEffects.rapidFire.active ? S_SHOOT_DELAY*0.38 : S_SHOOT_DELAY;
    if (now-sLastShot < delay) return;
    sLastShot = now;
    if (puEffects.laserBeam.active) { triggerLaser(); return; }

    // Build angle list based on active power-ups
    let angles = [0];
    if      (puEffects.overcharge.active) angles = [-40,-24,-8,8,24,40];
    else if (puEffects.tripleShot.active) angles = [-20,0,20];

    const bulletColor = puEffects.homing.active ? '#66ff66' : (puEffects.overcharge.active ? '#ff44ff' : '#00f2ff');
    const bulletSpeed = puEffects.overcharge.active ? 20 : 14;

    angles.forEach(deg => {
        const rad = deg*Math.PI/180;
        // Upward bullet (always)
        sBullets.push({
            x:sPlayer.x+Math.sin(rad)*10, y:sPlayer.y-sPlayer.h/2,
            vx:Math.sin(rad)*7, vy:-bulletSpeed,
            r:puEffects.overcharge.active?6:4,
            color:bulletColor, trail:[],
            homing:puEffects.homing.active,
            sniper:puEffects.sniperMode.active,
            dir:'up',
        });
        // Downward bullet (only when dualShot active)
        if (puEffects.dualShot.active) {
            sBullets.push({
                x:sPlayer.x+Math.sin(rad)*10, y:sPlayer.y+sPlayer.h/2,
                vx:Math.sin(rad)*7, vy:bulletSpeed,
                r:4, color:'#ff88ff', trail:[],
                homing:false, sniper:puEffects.sniperMode.active,
                dir:'down',
            });
        }
    });
}

function triggerLaser() {
    for (let i = sEnemies.length-1; i>=0; i--) {
        const en = sEnemies[i];
        if (Math.abs(en.x-sPlayer.x) < en.w/2+35) {
            if (en.shieldHp) en.shieldHp=0;
            en.hp=0; killSurvivalEnemy(i);
        }
    }
    sBullets.push({ type:'laser', x:sPlayer.x, life:1 });
}

// =============================================================================
// SURVIVAL — UPDATE
// =============================================================================
function survivalUpdate() {
    if (!survivalActive || isPaused) return;

    const effectiveSpeed = sPlayer.speed * (puEffects.berserker.active ? 3 : 1);
    if (sKeys.left  && sPlayer.x-sPlayer.w/2>0)                  sPlayer.x-=effectiveSpeed;
    if (sKeys.right && sPlayer.x+sPlayer.w/2<canvas.width)        sPlayer.x+=effectiveSpeed;
    if (sKeys.up    && sPlayer.y-sPlayer.h/2>70)                  sPlayer.y-=effectiveSpeed;
    if (sKeys.down  && sPlayer.y+sPlayer.h/2<canvas.height-90)    sPlayer.y+=effectiveSpeed;

    if (sKeys.space) survivalShoot();

    // Turret mode: auto-fire without holding space
    if (puEffects.turretMode.active) {
        const now = Date.now();
        if (now-sTurretLastShot > S_SHOOT_DELAY*0.55) { sTurretLastShot=now; survivalShoot(); }
    }
    // Berserker: triples speed + rapid auto-fire
    if (puEffects.berserker.active) {
        const now = Date.now();
        if (now-sTurretLastShot > S_SHOOT_DELAY*0.25) { sTurretLastShot=now; survivalShoot(); }
    }
    // Phase shift: render semi-transparent — invincibility handled in survivalTakeDamage

    if (sPlayer.invincTimer > 0) sPlayer.invincTimer--;

    // Tick power-up timers
    Object.keys(puEffects).forEach(k => {
        if (puEffects[k].active && puEffects[k].timer>0) {
            puEffects[k].timer-=16;
            if (puEffects[k].timer<=0) { puEffects[k].active=false; puEffects[k].timer=0; }
        }
    });

    // EMP — silence all existing enemies for the duration
    sEnemies.forEach(en => { en.silenced = puEffects.empBlast.active; });

    // Coin magnet — pull coins toward player
    if (puEffects.coinMagnet.active) {
        sCoinDrops.forEach(c => {
            const dx=sPlayer.x-c.x, dy=sPlayer.y-c.y, dist=Math.hypot(dx,dy)||1;
            c.x+=(dx/dist)*10; c.y+=(dy/dist)*10;
        });
    }

    // ---- Player bullets ----
    for (let i = sBullets.length-1; i>=0; i--) {
        const b = sBullets[i];
        if (b.type==='laser') { b.life-=0.15; if(b.life<=0)sBullets.splice(i,1); continue; }

        b.trail.push({x:b.x,y:b.y});
        if (b.trail.length>8) b.trail.shift();

        // Homing only applies to upward bullets
        if (b.homing && b.dir!=='down' && sEnemies.length>0) {
            let nearest=null, nearestDist=Infinity;
            for (const en of sEnemies) { const d=Math.hypot(en.x-b.x,en.y-b.y); if(d<nearestDist){nearestDist=d;nearest=en;} }
            if (nearest) {
                const dx=nearest.x-b.x, dy=nearest.y-b.y, dist=Math.hypot(dx,dy)||1;
                const spd=Math.hypot(b.vx,b.vy);
                b.vx+=(dx/dist*spd-b.vx)*0.18; b.vy+=(dy/dist*spd-b.vy)*0.18;
            }
        }

        b.x+=b.vx; b.y+=b.vy;

        // Ricochets: bounce off left/right walls up to 3 times
        if (puEffects.ricochets.active) {
            if ((b.x<=0 || b.x>=canvas.width) && (b.bounces||0)<3) {
                b.vx=-b.vx; b.x=Math.max(1,Math.min(canvas.width-1,b.x));
                b.bounces=(b.bounces||0)+1;
            }
        }

        if (b.y<-20||b.y>canvas.height+20||b.x<-20||b.x>canvas.width+20) { sBullets.splice(i,1); continue; }

        let hit=false;
        for (let j=sEnemies.length-1; j>=0; j--) {
            const en=sEnemies[j];
            if (b.x>en.x-en.w/2 && b.x<en.x+en.w/2 && b.y>en.y-en.h/2 && b.y<en.y+en.h/2) {
                const dmg = b.sniper ? 9999 : 1;
                if (b.sniper && en.shieldHp) en.shieldHp=0;
                applyDamageToEnemy(en,j,dmg);
                // Chain Lightning: arc to up to 2 nearby enemies within 140px
                if (puEffects.chainLightning.active) {
                    let chained=0;
                    for (let k=sEnemies.length-1; k>=0 && chained<2; k--) {
                        if (k===j) continue;
                        const ce=sEnemies[k];
                        if (Math.hypot(ce.x-en.x,ce.y-en.y)<140) {
                            createSurvivalParticles(ce.x,ce.y,'#aaff00',false);
                            applyDamageToEnemy(ce,k,1);
                            chained++;
                        }
                    }
                }
                hit=true; break;
            }
        }
        if (hit) sBullets.splice(i,1);
    }

    // ---- Mines ----
    for (let i=sMines.length-1; i>=0; i--) {
        const m=sMines[i];
        m.pulseT=(m.pulseT||0)+0.1;
        for (let j=sEnemies.length-1; j>=0; j--) {
            const en=sEnemies[j];
            if (Math.hypot(en.x-m.x,en.y-m.y) < en.w/2+m.r) {
                createSurvivalParticles(m.x,m.y,'#ff9900',true);
                // Mine explodes: kills the touching enemy + damages nearby enemies
                for (let k=sEnemies.length-1; k>=0; k--) {
                    if (Math.hypot(sEnemies[k].x-m.x, sEnemies[k].y-m.y) < 100) {
                        applyDamageToEnemy(sEnemies[k],k,3);
                    }
                }
                shakeAmt=8; sMines.splice(i,1); break;
            }
        }
    }

    // ---- Enemies ----
    for (let i=sEnemies.length-1; i>=0; i--) {
        const en=sEnemies[i];

        if (puEffects.freezeField.active) en.speed=0;
        else en.speed = puEffects.timeSlow.active ? en.baseSpeed*0.45 : en.baseSpeed;

        if (en.enemyType==='diver') {
            if (en.diverState==='falling') {
                en.y+=en.speed;
                if (en.y>=en.diverTriggerY) {
                    en.diverState='dashing';
                    const dx=sPlayer.x-en.x, dy=sPlayer.y-en.y, dist=Math.hypot(dx,dy)||1;
                    const dashSpeed=en.baseSpeed*3.2;
                    en.dashVx=(dx/dist)*dashSpeed; en.dashVy=(dy/dist)*dashSpeed;
                }
            } else {
                en.x+=en.dashVx*(puEffects.freezeField.active?0:1);
                en.y+=en.dashVy*(puEffects.freezeField.active?0:1);
            }
        } else {
            if (en.zigzagAmplitude>0 && !puEffects.freezeField.active) {
                en.zigzagT+=en.zigzagSpeed;
                en.x=en.baseX+Math.sin(en.zigzagT)*en.zigzagAmplitude*60;
                en.x=Math.max(en.w/2,Math.min(canvas.width-en.w/2,en.x));
            }
            en.y+=en.speed;
        }

        if (en.enemyType==='shielded' && en.shieldBroken && en.shieldRegenAt &&
            Date.now()>en.shieldRegenAt && en.shieldHp<en.shieldMaxHp) {
            en.shieldHp=Math.min(en.shieldMaxHp,en.shieldHp+0.02);
            if (en.shieldHp>=en.shieldMaxHp) en.shieldBroken=false;
        }
        if (en.enemyType==='shielded') en.shieldRot+=0.05;

        en.rot+=0.025; en.pulseT=(en.pulseT||0)+0.08;

        const offBottom = en.y>canvas.height+en.h;
        const offSide   = en.x<-en.w*2||en.x>canvas.width+en.w*2;
        if (offBottom||(en.enemyType==='diver'&&en.diverState==='dashing'&&offSide)) {
            sEnemies.splice(i,1);
            // Enemy escaping ONLY breaks combo — no life lost
            if (offBottom) resetSurvivalCombo();
            continue;
        }

        const now=Date.now();
        if (!en.silenced && now-en.lastShot>en.shootInterval && en.enemyType!=='diver' && en.enemyType!=='mini') {
            en.lastShot=now; fireEnemyBullet(en);
        }

        if (sPlayer.invincTimer===0 &&
            Math.abs(en.x-sPlayer.x)<(en.w+sPlayer.w)/2*0.75 &&
            Math.abs(en.y-sPlayer.y)<(en.h+sPlayer.h)/2*0.75) {
            createSurvivalParticles(en.x,en.y,en.color,en.isBoss);
            sEnemies.splice(i,1);
            if (puEffects.shield.active) { puEffects.shield.active=false; createSurvivalParticles(sPlayer.x,sPlayer.y,'#00f2ff',false); }
            else survivalTakeDamage();
        }
    }

    // ---- Enemy bullets ----
    for (let i=sEBullets.length-1; i>=0; i--) {
        const b=sEBullets[i];
        b.x+=b.vx; b.y+=b.vy;

        // Bullet wall: destroy enemy bullets within 90px of player
        if (puEffects.bulletWall.active && Math.hypot(b.x-sPlayer.x,b.y-sPlayer.y)<90) {
            createSurvivalParticles(b.x,b.y,'#4488ff',false);
            sEBullets.splice(i,1); continue;
        }

        if (b.y>canvas.height+10||b.y<-10||b.x<-10||b.x>canvas.width+10) { sEBullets.splice(i,1); continue; }

        if (sPlayer.invincTimer===0 &&
            b.x>sPlayer.x-sPlayer.w/2 && b.x<sPlayer.x+sPlayer.w/2 &&
            b.y>sPlayer.y-sPlayer.h/2 && b.y<sPlayer.y+sPlayer.h/2) {
            sEBullets.splice(i,1);
            if (puEffects.shield.active) { puEffects.shield.active=false; createSurvivalParticles(sPlayer.x,sPlayer.y,'#00f2ff',false); }
            else survivalTakeDamage();
        }
    }

    // ---- Power-up drops (wave 3 or earlier) ----
    for (let i=sPowerDrops.length-1; i>=0; i--) {
        const d=sPowerDrops[i];
        d.y+=1.6; d.rot=(d.rot||0)+0.04;
        if (d.y>canvas.height+30) { sPowerDrops.splice(i,1); continue; }
        if (Math.abs(d.x-sPlayer.x)<34 && Math.abs(d.y-sPlayer.y)<34) {
            sDiscoveredPowerUps.add(d.pu.type); addToInventory(d.pu); sPowerDrops.splice(i,1);
        }
    }

    // ---- Coin drops ----
    for (let i=sCoinDrops.length-1; i>=0; i--) {
        const c=sCoinDrops[i];
        c.y+=1.4; c.rot=(c.rot||0)+0.09;
        if (c.y>canvas.height+20) { sCoinDrops.splice(i,1); continue; }
        if (Math.abs(c.x-sPlayer.x)<30 && Math.abs(c.y-sPlayer.y)<30) {
            sCoins++; sCoinDrops.splice(i,1);
            createSurvivalParticles(c.x,c.y,'#ffaa00',false);
            updateSurvivalHUD(); renderPowerUpBar();
        }
    }

    // ---- Survival particles ----
    for (let i=sParticles.length-1; i>=0; i--) {
        const p=sParticles[i];
        p.x+=p.vx; p.y+=p.vy; p.life-=0.018;
        if (p.life<=0) sParticles.splice(i,1);
    }

    sStars.forEach(s=>{ s.y+=s.spd; if(s.y>canvas.height){s.y=0;s.x=Math.random()*canvas.width;} });
    sScore+=0.025*(puEffects.scoreBoost.active?2:1);

    // Wave clear
    if (!sBossActive && sEnemies.length===0 && !sWaveAdvancing) {
        sWaveAdvancing=true;
        showSurvivalToast(`WAVE ${sWave} CLEAR`,'#00f2ff');
        sWave++; sKills=0; sWaveId++;
        updateSurvivalHUD();
        setTimeout(()=>{ sWaveAdvancing=false; if(survivalActive)spawnSurvivalWave(); },2200);
    }
    updateSurvivalHUD();
}

// =============================================================================
// SURVIVAL — ENEMY BULLET FIRE
// =============================================================================
function fireEnemyBullet(en) {
    const spd = en.isBoss ? 3.0 : 2.0;
    if (en.isBoss) {
        en.bossAttackIndex=((en.bossAttackIndex||0)+1)%3;
        const pattern=['spread','circle','volley'][en.bossAttackIndex];
        if (pattern==='spread') {
            [-0.35,0,0.35].forEach(offset=>{
                sEBullets.push({x:en.x,y:en.y+en.h/2,vx:offset*spd*2+(Math.random()-0.5)*0.5,vy:spd,r:6,color:'#ff00ff'});
            });
        } else if (pattern==='circle') {
            for (let s=0;s<10;s++) {
                const a=(s/10)*Math.PI*2;
                sEBullets.push({x:en.x,y:en.y,vx:Math.cos(a)*spd*0.85,vy:Math.sin(a)*spd*0.85,r:5,color:'#ff66ff'});
            }
        } else {
            const dx=sPlayer.x-en.x,dy=sPlayer.y-en.y,dist=Math.hypot(dx,dy)||1;
            for (let s=-1;s<=1;s++) {
                sEBullets.push({x:en.x,y:en.y+en.h/2,vx:(dx/dist)*spd*1.4+s*0.6,vy:(dy/dist)*spd*1.4,r:5,color:'#ff0066'});
            }
        }
    } else {
        const leanX=(sPlayer.x-en.x)/canvas.width*1.5;
        sEBullets.push({x:en.x,y:en.y+en.h/2,vx:leanX+(Math.random()-0.5)*2.8,vy:spd,r:4,color:'#ff6600'});
    }
}

// =============================================================================
// SURVIVAL — COMBO / MULTIPLIER
// Every 10 kills in a row = 1 coin spawned at kill position.
// Combo broken = streak resets. NO life is ever deducted for a broken combo.
// =============================================================================
function registerSurvivalKill(ex, ey) {
    sComboStreak++;

    // Drop a coin every 10 kills in a row
    if (sComboStreak % 10 === 0) {
        sCoinDrops.push({ x:ex||sPlayer.x, y:ey||sPlayer.y-40, rot:0 });
        showSurvivalToast(`${sComboStreak} KILL STREAK! +1 🪙`,'#ffaa00');
    }

    const prevMult = sComboMult;
    for (let i=COMBO_THRESHOLDS.length-1; i>=0; i--) {
        if (sComboStreak>=COMBO_THRESHOLDS[i].streak) { sComboMult=COMBO_THRESHOLDS[i].mult; break; }
    }
    if (sComboMult>prevMult) showSurvivalToast(`COMBO x${sComboMult}!`,'#ffaa00');
    return sComboMult;
}

function resetSurvivalCombo() {
    // Only resets the streak — never removes a life
    if (sComboStreak >= 8) showSurvivalToast('COMBO BROKEN','#ff0044');
    sComboStreak=0; sComboMult=1;
}

// =============================================================================
// SURVIVAL — TOAST NOTIFICATIONS
// =============================================================================
function showSurvivalToast(text, color) {
    sToasts.push({ text, color, life:1.0, y:0 });
    if (sToasts.length>4) sToasts.shift();
}

// =============================================================================
// SURVIVAL — DAMAGE APPLICATION
// =============================================================================
function applyDamageToEnemy(en, idx, amount) {
    if (en.shieldHp && en.shieldHp>0) {
        en.shieldHp-=amount; en.shieldRegenAt=Date.now()+4000;
        if (en.shieldHp<=0) { en.shieldHp=0; en.shieldBroken=true; createSurvivalParticles(en.x,en.y,'#00c8ff',false); }
        return;
    }
    en.hp-=amount;
    if (en.hp<=0) killSurvivalEnemy(idx);
}

// =============================================================================
// SURVIVAL — KILL ENEMY
// =============================================================================
function killSurvivalEnemy(idx) {
    const en = sEnemies[idx];
    createSurvivalParticles(en.x,en.y,en.color,en.isBoss);

    const comboMult = registerSurvivalKill(en.x, en.y);
    const boostMult = puEffects.scoreBoost.active ? 2 : 1;
    const baseScore = en.isBoss ? 500 : (en.enemyType==='mini'?40:100);
    sScore += Math.round(baseScore*comboMult*boostMult);
    sKills++;

    // Life Steal: 20% chance to drop a bonus coin on kill
    if (puEffects.lifeSteal.active && Math.random()<0.20) {
        sCoinDrops.push({ x:en.x+(Math.random()-0.5)*30, y:en.y, rot:0 });
    }
    // Gold Rush: every kill drops a coin
    if (puEffects.goldRush.active && !en.isBoss) {
        sCoinDrops.push({ x:en.x+(Math.random()-0.5)*20, y:en.y, rot:0 });
    }

    if (en.isBoss) {
        sCoinDrops.push({ x:en.x, y:en.y, rot:0 }); // exactly 1 coin
        sBossActive=false; shakeAmt=18;
        showSurvivalToast('BOSS DESTROYED','#bc13fe');
        logActivity(`SURVIVAL BOSS KILLED - WAVE: ${sWave}`);
    } else {
        if (en.enemyType==='splitter') {
            for (let s=0;s<2;s++) {
                const mini=spawnSurvivalEnemy(false,'mini');
                if (mini) { mini.x=en.x+(s===0?-24:24); mini.y=en.y; mini.baseX=mini.x; }
            }
        }
        if (sWave<=3 && Math.random()<0.45) dropPowerUp(en.x,en.y);
        if (sKills>0 && sKills%KILLS_PER_BOSS===0 && !sBossActive) {
            sBossActive=true;
            setTimeout(()=>{ if(survivalActive)spawnSurvivalEnemy(true); },800);
            logActivity(`SURVIVAL BOSS INCOMING - WAVE: ${sWave}`);
        }
    }

    sEnemies.splice(idx,1);
    updateSurvivalHUD();
}

// =============================================================================
// SURVIVAL — POWER-UP DROP
// =============================================================================
function dropPowerUp(x, y) {
    const def = POWER_UP_DEFS[Math.floor(Math.random()*POWER_UP_DEFS.length)];
    sPowerDrops.push({ x, y, rot:0, pu:{ ...def, firstUse:true } });
}

// =============================================================================
// SURVIVAL — TAKE DAMAGE
// =============================================================================
function survivalTakeDamage() {
    if (sPlayer.invincTimer>0) return;
    if (puEffects.phaseShift.active) return; // untouchable
    sPlayer.lives--;
    sPlayer.invincTimer=110; shakeAmt=14;
    resetSurvivalCombo(); // taking a hit still breaks the combo
    createSurvivalParticles(sPlayer.x,sPlayer.y,'#ff0044',false);
    if (sPlayer.lives<=0) endSurvival(); else updateSurvivalHUD();
}

// =============================================================================
// SURVIVAL — END
// =============================================================================
function endSurvival() {
    survivalActive=false;
    const isNewBestScore=Math.floor(sScore)>sSessionBestScore;
    const isNewBestWave =sWave>sSessionBestWave;
    if (isNewBestScore) sSessionBestScore=Math.floor(sScore);
    if (isNewBestWave)  sSessionBestWave=sWave;

    document.getElementById('survivalHUD').style.display          = 'none';
    document.getElementById('powerupBar').style.display           = 'none';
    document.getElementById('powerupBar-label').style.display     = 'none';
    document.getElementById('survivalPauseMenu').style.display    = 'none';
    document.getElementById('survivalInventory').style.display    = 'none';
    document.getElementById('survFinalWave').innerText  = sWave;
    document.getElementById('survFinalScore').innerText = Math.floor(sScore);

    const bestEl=document.getElementById('survSessionBest');
    if (bestEl) bestEl.innerText=`SESSION BEST — WAVE ${sSessionBestWave} · SCORE ${sSessionBestScore}`;
    const newBestEl=document.getElementById('survNewBestTag');
    if (newBestEl) newBestEl.style.display=(isNewBestScore||isNewBestWave)?'block':'none';

    document.getElementById('survivalOverScreen').style.display='flex';
    logActivity(`SURVIVAL END - WAVE: ${sWave} SCORE: ${Math.floor(sScore)}`);
}

// =============================================================================
// SURVIVAL — INVENTORY SLOTS
// =============================================================================
function addToInventory(pu) {
    for (let i=0;i<4;i++) { if(!puSlots[i]){puSlots[i]={...pu};renderPowerUpBar();return;} }
    puSlots[0]={...pu}; renderPowerUpBar();
}

function usePowerUp(idx) {
    const pu=puSlots[idx];
    if (!pu) return;
    if (!pu.firstUse) { if(sCoins<pu.cost)return; sCoins-=pu.cost; }
    pu.firstUse=false;
    activatePowerUp(pu);
    const instantTypes=['bombBlast','shield','laserBeam','extraLife','waveBlast','freezeField','empBlast','mineField'];
    if (instantTypes.includes(pu.type)) puSlots[idx]=null;
    renderPowerUpBar(); updateSurvivalHUD();
    logActivity(`POWER-UP USED: ${pu.label}`);
}

function activatePowerUp(pu) {
    switch (pu.type) {
        case 'bombBlast':
            sEBullets=[];
            for (let i=sEnemies.length-1;i>=0;i--) {
                if (!sEnemies[i].isBoss) { createSurvivalParticles(sEnemies[i].x,sEnemies[i].y,sEnemies[i].color,false); sEnemies.splice(i,1); }
                else { sEnemies[i].shieldHp=0; sEnemies[i].hp-=5; if(sEnemies[i].hp<=0)killSurvivalEnemy(i); }
            }
            shakeAmt=20; return;

        case 'shield':
            puEffects.shield.active=true; return;

        case 'extraLife':
            sPlayer.lives++;
            showSurvivalToast('+1 LIFE','#ff3366');
            createSurvivalParticles(sPlayer.x,sPlayer.y,'#ff3366',false); return;

        case 'waveBlast':
            sEBullets=[];
            showSurvivalToast('BULLETS CLEARED!','#00ccff');
            shakeAmt=8; return;

        case 'freezeField':
            puEffects.freezeField.active=true;
            puEffects.freezeField.timer=pu.duration;
            showSurvivalToast('FIELD FROZEN!','#aaddff'); return;

        case 'empBlast':
            puEffects.empBlast.active=true;
            puEffects.empBlast.timer=pu.duration;
            showSurvivalToast('ENEMIES SILENCED!','#ffcc00'); return;

        case 'mineField':
            // Scatter 6 mines at random positions around the field
            for (let m=0;m<6;m++) {
                sMines.push({
                    x: Math.random()*(canvas.width-120)+60,
                    y: Math.random()*(canvas.height*0.65)+80,
                    r: 18, pulseT: Math.random()*Math.PI*2,
                });
            }
            showSurvivalToast('6 MINES DEPLOYED!','#ff9900'); return;

        case 'phaseShift':
            puEffects.phaseShift.active=true;
            puEffects.phaseShift.timer=pu.duration;
            showSurvivalToast('PHASE SHIFT! UNTOUCHABLE','#cc88ff'); return;

        case 'goldRush':
            puEffects.goldRush.active=true;
            puEffects.goldRush.timer=pu.duration;
            showSurvivalToast('GOLD RUSH! ALL KILLS DROP COINS','#ffd700'); return;

        case 'berserker':
            puEffects.berserker.active=true;
            puEffects.berserker.timer=pu.duration;
            showSurvivalToast('BERSERKER MODE!','#ff4400'); return;

        default:
            if (puEffects[pu.type]) { puEffects[pu.type].active=true; puEffects[pu.type].timer=pu.duration; }
    }
}

// =============================================================================
// SURVIVAL — RENDER POWER-UP BAR (HTML)
// =============================================================================
function renderPowerUpBar() {
    const bar=document.getElementById('powerupBar');
    bar.innerHTML='';
    for (let i=0;i<4;i++) {
        const pu=puSlots[i];
        const slot=document.createElement('div');
        slot.style.cssText=`
            width:64px;height:64px;border:2px solid ${pu?pu.color:'#333'};
            border-radius:8px;background:rgba(0,0,0,0.85);
            display:flex;flex-direction:column;align-items:center;
            justify-content:center;cursor:pointer;position:relative;
            transition:0.15s;font-family:'Courier New',monospace;
            opacity:${pu?(pu.firstUse||sCoins>=pu.cost?'1':'0.4'):'0.3'};
            box-shadow:${pu?`0 0 10px ${pu.color}55`:'none'};
            pointer-events:auto;user-select:none;
        `;
        if (pu) {
            const costLabel=pu.firstUse?'FREE':`${pu.cost}🪙`;
            const canAfford=pu.firstUse||sCoins>=pu.cost;
            slot.innerHTML=`
                <span style="font-size:1.4rem;">${pu.icon}</span>
                <span style="font-size:0.5rem;color:${pu.color};letter-spacing:1px;">${pu.label}</span>
                <span style="position:absolute;bottom:3px;right:5px;font-size:0.5rem;
                    color:${pu.firstUse?'#00f2ff':(canAfford?'#ffaa00':'#ff0044')};">
                    ${costLabel}
                </span>
                <span style="position:absolute;top:2px;left:5px;font-size:0.55rem;color:#555;">${i+1}</span>
            `;
            slot.onclick=()=>usePowerUp(i);
            slot.title=`${pu.label} — ${pu.firstUse?'First use FREE':`Costs ${pu.cost} coins`} — Press ${i+1}`;
        } else {
            slot.innerHTML=`<span style="font-size:0.65rem;color:#333;">[${i+1}]</span>`;
        }
        bar.appendChild(slot);
    }
}

// =============================================================================
// SURVIVAL — DRAW
// =============================================================================
function survivalDraw() {
    ctx.fillStyle='#00010a';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    sStars.forEach(s=>{
        ctx.save(); ctx.globalAlpha=s.bright; ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); ctx.restore();
    });

    ctx.save();
    if (shakeAmt>0.1) { ctx.translate((Math.random()-0.5)*shakeAmt,(Math.random()-0.5)*shakeAmt); shakeAmt*=0.85; }

    // Freeze field overlay
    if (puEffects.freezeField.active) {
        ctx.save(); ctx.fillStyle='#aaddff0a'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
    }

    // EMP overlay
    if (puEffects.empBlast.active) {
        ctx.save(); ctx.fillStyle='#ffcc0008'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
    }

    // Bullet wall ring
    if (puEffects.bulletWall.active) {
        ctx.save();
        ctx.strokeStyle='#4488ff'; ctx.lineWidth=2; ctx.shadowColor='#4488ff'; ctx.shadowBlur=16;
        ctx.globalAlpha=0.3+Math.sin(Date.now()/120)*0.15;
        ctx.beginPath(); ctx.arc(sPlayer.x,sPlayer.y,90,0,Math.PI*2); ctx.stroke();
        ctx.restore();
    }

    sParticles.forEach(p=>{
        ctx.globalAlpha=p.life; ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,p.size,p.size);
    });
    ctx.globalAlpha=1;

    // Mines
    sMines.forEach(m=>{
        m.pulseT+=0.08;
        ctx.save();
        ctx.translate(m.x,m.y);
        ctx.shadowColor='#ff9900'; ctx.shadowBlur=12+Math.sin(m.pulseT)*5;
        ctx.fillStyle='#ff9900'; ctx.strokeStyle='#ffcc00'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(0,0,m.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#000'; ctx.font=`bold ${m.r}px Arial`;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',0,1);
        ctx.restore();
    });

    // Coins
    sCoinDrops.forEach(c=>{
        ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
        ctx.shadowColor='#ffaa00'; ctx.shadowBlur=16; ctx.fillStyle='#ffcc00';
        ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#7a4400'; ctx.font='bold 10px Courier New';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('¢',0,1);
        ctx.restore();
    });

    // Power-up drops
    sPowerDrops.forEach(d=>{
        ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(d.rot);
        ctx.shadowColor=d.pu.color; ctx.shadowBlur=20+Math.sin(Date.now()/200)*8;
        ctx.strokeStyle=d.pu.color; ctx.lineWidth=2;
        ctx.strokeRect(-18,-18,36,36); ctx.fillStyle=d.pu.color+'22'; ctx.fillRect(-18,-18,36,36);
        ctx.shadowBlur=0; ctx.font='20px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(d.pu.icon,0,0); ctx.restore();
    });

    // Enemy bullets
    sEBullets.forEach(b=>{
        ctx.save(); ctx.shadowColor=b.color; ctx.shadowBlur=14; ctx.fillStyle=b.color;
        const angle=Math.atan2(b.vy,b.vx)+Math.PI/2;
        ctx.translate(b.x,b.y); ctx.rotate(angle);
        ctx.beginPath(); ctx.ellipse(0,0,b.r*0.55,b.r*2,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
    });

    // Player bullets
    sBullets.forEach(b=>{
        if (b.type==='laser') {
            ctx.save(); ctx.globalAlpha=b.life;
            ctx.strokeStyle='#ff0044'; ctx.lineWidth=8; ctx.shadowColor='#ff0044'; ctx.shadowBlur=35;
            ctx.beginPath(); ctx.moveTo(b.x,canvas.height); ctx.lineTo(b.x,0); ctx.stroke();
            ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.shadowBlur=0;
            ctx.beginPath(); ctx.moveTo(b.x,canvas.height); ctx.lineTo(b.x,0); ctx.stroke();
            ctx.restore(); return;
        }
        ctx.save();
        b.trail.forEach((pt,ti)=>{
            ctx.globalAlpha=(ti/b.trail.length)*0.5; ctx.fillStyle=b.color;
            ctx.beginPath(); ctx.arc(pt.x,pt.y,b.r*(ti/b.trail.length),0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1; ctx.shadowColor=b.color; ctx.shadowBlur=20; ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r*0.45,b.r*2.4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=b.color; ctx.globalAlpha=0.55;
        ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r,b.r*3.8,0,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1; ctx.restore();
    });

    // Enemies
    sEnemies.forEach(en=>{
        ctx.save();
        ctx.translate(en.x,en.y); ctx.rotate(en.rot);
        const pulse=1+Math.sin(en.pulseT)*0.08;
        ctx.scale(pulse,pulse);
        ctx.shadowColor=en.color; ctx.shadowBlur=en.isBoss?35:16; ctx.fillStyle=en.color;

        if (en.isBoss) {
            ctx.beginPath();
            for (let s=0;s<6;s++) {
                const a=(s/6)*Math.PI*2-Math.PI/6;
                s===0?ctx.moveTo(Math.cos(a)*en.w/2,Math.sin(a)*en.h/2):ctx.lineTo(Math.cos(a)*en.w/2,Math.sin(a)*en.h/2);
            }
            ctx.closePath(); ctx.fill(); ctx.strokeStyle='#ffffff44'; ctx.lineWidth=2; ctx.stroke();
            ctx.rotate(-en.rot); ctx.scale(1/pulse,1/pulse);
            const bw=en.w*1.2;
            ctx.fillStyle='#220000'; ctx.fillRect(-bw/2,-en.h/2-16,bw,8);
            ctx.fillStyle='#ff00ff'; ctx.shadowBlur=6; ctx.fillRect(-bw/2,-en.h/2-16,bw*(en.hp/en.maxHp),8);
        } else if (en.enemyType==='diver') {
            ctx.beginPath();
            ctx.moveTo(0,en.h/2); ctx.lineTo(en.w/2,-en.h/4); ctx.lineTo(en.w/5,-en.h/2);
            ctx.lineTo(-en.w/5,-en.h/2); ctx.lineTo(-en.w/2,-en.h/4); ctx.closePath(); ctx.fill();
            if (en.diverState==='dashing') { ctx.strokeStyle='#ffffff88'; ctx.lineWidth=1.5; ctx.stroke(); }
        } else if (en.enemyType==='splitter') {
            ctx.beginPath(); ctx.moveTo(-en.w/5,en.h/2); ctx.lineTo(-en.w/2,0); ctx.lineTo(-en.w/5,-en.h/2); ctx.lineTo(en.w/10,0); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(en.w/5,en.h/2); ctx.lineTo(-en.w/10,0); ctx.lineTo(en.w/5,-en.h/2); ctx.lineTo(en.w/2,0); ctx.closePath(); ctx.fill();
        } else if (en.enemyType==='shielded') {
            ctx.beginPath();
            for (let s=0;s<6;s++) {
                const a=(s/6)*Math.PI*2;
                s===0?ctx.moveTo(Math.cos(a)*en.w/2.6,Math.sin(a)*en.h/2.6):ctx.lineTo(Math.cos(a)*en.w/2.6,Math.sin(a)*en.h/2.6);
            }
            ctx.closePath(); ctx.fill();
        } else if (en.enemyType==='mini') {
            ctx.beginPath(); ctx.moveTo(0,en.h/2); ctx.lineTo(en.w/2,-en.h/2); ctx.lineTo(-en.w/2,-en.h/2); ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath(); ctx.moveTo(0,en.h/2); ctx.lineTo(en.w/2,-en.h/2); ctx.lineTo(-en.w/2,-en.h/2); ctx.closePath(); ctx.fill();
        }

        if (!en.isBoss && en.maxHp>1) {
            ctx.rotate(-en.rot); ctx.scale(1/pulse,1/pulse);
            const bw=en.w;
            ctx.fillStyle='#220000'; ctx.fillRect(-bw/2,-en.h/2-10,bw,5);
            ctx.fillStyle='#ff0044'; ctx.shadowBlur=4; ctx.fillRect(-bw/2,-en.h/2-10,bw*(en.hp/en.maxHp),5);
        }
        ctx.restore();

        if (en.enemyType==='shielded' && en.shieldHp>0) {
            ctx.save(); ctx.translate(en.x,en.y); ctx.rotate(en.shieldRot);
            ctx.strokeStyle='#00c8ff'; ctx.shadowColor='#00c8ff'; ctx.shadowBlur=12;
            ctx.globalAlpha=0.4+(en.shieldHp/en.shieldMaxHp)*0.5; ctx.lineWidth=2.5;
            for (let s=0;s<8;s++) {
                const a0=(s/8)*Math.PI*2, a1=a0+(Math.PI*2/8)*0.65;
                ctx.beginPath(); ctx.arc(0,0,en.w/1.6,a0,a1); ctx.stroke();
            }
            ctx.restore();
        }
    });

    // Shield aura
    if (puEffects.shield.active) {
        ctx.save();
        ctx.strokeStyle='#00f2ff'; ctx.lineWidth=3; ctx.shadowColor='#00f2ff'; ctx.shadowBlur=24;
        ctx.globalAlpha=0.55+Math.sin(Date.now()/100)*0.3;
        ctx.beginPath(); ctx.arc(sPlayer.x,sPlayer.y,sPlayer.w,0,Math.PI*2); ctx.stroke();
        ctx.restore();
    }

    // Player ship
    ctx.save(); ctx.translate(sPlayer.x,sPlayer.y);
    ctx.shadowBlur=20;
    if (puEffects.phaseShift.active) {
        ctx.shadowColor='#cc88ff';
        ctx.globalAlpha=0.35+Math.sin(Date.now()/80)*0.2;
    } else if (sPlayer.invincTimer>0) {
        ctx.shadowColor='#ffff00';
        ctx.globalAlpha=0.5+Math.sin(Date.now()/55)*0.5;
    } else {
        ctx.shadowColor='#00f2ff';
    }
    ctx.drawImage(shipImg,-sPlayer.w/2,-sPlayer.h/2,sPlayer.w,sPlayer.h);
    ctx.restore();

    // Engine thruster
    ctx.save();
    const eY=sPlayer.y+sPlayer.h/2, flicker=20+Math.random()*18;
    const grad=ctx.createLinearGradient(sPlayer.x,eY,sPlayer.x,eY+flicker+12);
    grad.addColorStop(0,'#00f2ffdd'); grad.addColorStop(0.5,'#0044ffaa'); grad.addColorStop(1,'transparent');
    ctx.fillStyle=grad; ctx.shadowColor='#00f2ff'; ctx.shadowBlur=14;
    ctx.beginPath();
    ctx.moveTo(sPlayer.x-9,eY); ctx.lineTo(sPlayer.x+9,eY);
    ctx.lineTo(sPlayer.x+2,eY+flicker); ctx.lineTo(sPlayer.x-2,eY+flicker);
    ctx.closePath(); ctx.fill(); ctx.restore();

    // Active power-up strips (left side)
    let stripY=110;
    Object.entries(puEffects).forEach(([k,v])=>{
        if (!v.active) return;
        const def=POWER_UP_DEFS.find(p=>p.type===k); if(!def) return;
        const pct=def.duration>0?Math.max(0,v.timer/def.duration):1;
        ctx.save();
        ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(18,stripY,140,28);
        ctx.strokeStyle=def.color; ctx.lineWidth=1; ctx.strokeRect(18,stripY,140,28);
        ctx.font='12px Courier New'; ctx.fillStyle=def.color; ctx.textBaseline='middle';
        ctx.fillText(`${def.icon} ${def.label}`,26,stripY+14);
        if (def.duration>0) {
            ctx.fillStyle=def.color+'44'; ctx.fillRect(90,stripY+7,58,14);
            ctx.fillStyle=def.color; ctx.fillRect(90,stripY+7,58*pct,14);
        }
        ctx.restore(); stripY+=34;
    });

    // Combo display (top-right)
    if (sComboMult>1 || sComboStreak>0) {
        ctx.save();
        ctx.textAlign='right'; ctx.textBaseline='top';
        ctx.font='bold 22px Courier New';
        ctx.shadowColor='#ffaa00'; ctx.shadowBlur=10; ctx.fillStyle='#ffaa00';
        ctx.fillText(`x${sComboMult} COMBO`,canvas.width-20,80);
        ctx.font='11px Courier New'; ctx.shadowBlur=0; ctx.fillStyle='#ffaa0099';
        ctx.fillText(`${sComboStreak} STREAK`,canvas.width-20,105);
        // Progress bar toward next coin milestone
        const pct=(sComboStreak%10)/10;
        ctx.fillStyle='#33333388'; ctx.fillRect(canvas.width-140,122,120,5);
        ctx.fillStyle='#ffaa00'; ctx.fillRect(canvas.width-140,122,120*pct,5);
        ctx.fillStyle='#ffaa0077'; ctx.font='9px Courier New';
        ctx.fillText(`${sComboStreak%10}/10 → 🪙`,canvas.width-20,130);
        ctx.restore();
    }

    // Toasts (top-center)
    for (let i=sToasts.length-1; i>=0; i--) {
        const t=sToasts[i];
        t.life-=0.012; t.y-=0.4;
        if (t.life<=0) { sToasts.splice(i,1); continue; }
        ctx.save();
        ctx.globalAlpha=Math.min(1,t.life*1.5);
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font='bold 18px Courier New';
        ctx.shadowColor=t.color; ctx.shadowBlur=14; ctx.fillStyle=t.color;
        ctx.fillText(t.text,canvas.width/2,150+t.y-i*26);
        ctx.restore();
    }

    ctx.restore();
}

// =============================================================================
// SURVIVAL — PARTICLES
// =============================================================================
function createSurvivalParticles(x, y, color, big) {
    const count=big?45:11;
    for (let i=0;i<count;i++) {
        sParticles.push({ x, y, vx:(Math.random()-0.5)*(big?10:5), vy:(Math.random()-0.5)*(big?10:5), size:Math.random()*(big?7:3)+1, life:1.0, color });
    }
}

// =============================================================================
// SURVIVAL — HUD UPDATE
// =============================================================================
function updateSurvivalHUD() {
    const hearts='❤️'.repeat(Math.max(0,sPlayer.lives))||'💀';
    document.getElementById('sLives').innerText  = hearts;
    document.getElementById('sWave').innerText   = sWave;
    document.getElementById('sCoins').innerText  = sCoins;
    document.getElementById('sScore').innerText  = Math.floor(sScore);
    renderPowerUpBar();
}

// =============================================================================
// SURVIVAL — MAIN LOOP
// =============================================================================
function survivalLoop(loopId) {
    if (loopId!==survivalLoopId) return;
    survivalUpdate(); survivalDraw();
    if (survivalActive && !isPaused) requestAnimationFrame(()=>survivalLoop(loopId));
}

// =============================================================================
// SURVIVAL — MOBILE TOUCH CONTROLS
// =============================================================================
let _touchX=0;
canvas.addEventListener('touchstart',e=>{
    if(!survivalActive)return;
    _touchX=e.touches[0].clientX; survivalShoot();
},{passive:true});
canvas.addEventListener('touchmove',e=>{
    if(!survivalActive)return;
    const dx=e.touches[0].clientX-_touchX;
    sPlayer.x=Math.max(sPlayer.w/2,Math.min(canvas.width-sPlayer.w/2,sPlayer.x+dx*0.6));
    _touchX=e.touches[0].clientX; survivalShoot();
},{passive:true});

window.addEventListener('keydown',e=>{ if(e.key===' '&&survivalActive&&!isPaused)sKeys.space=true; });
window.addEventListener('keyup',e=>{ if(e.key===' ')sKeys.space=false; });

// =============================================================================
// RESIZE
// =============================================================================
window.addEventListener('resize',()=>{
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    if(survivalActive)sPlayer.y=canvas.height-100;
});