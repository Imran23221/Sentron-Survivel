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

let player = { x: canvas.width/2, y: canvas.height/2, size: 38, angle: 0 };
let enemies = [];
let particles = [];
let mouse = { x: canvas.width/2, y: canvas.height/2 };

let lastPulse = 0, lastSuper = 0, lastScoreTime = 0;
let nextBossTime = 0, flashEffect = { timer: 0, color: '#fff', size: 0 };
let shakeAmt = 0;

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
    requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (!gameActive && !survivalActive) return;
    isPaused = !isPaused;
    if (survivalActive) {
        document.getElementById('survivalPauseMenu').style.display = isPaused ? 'flex' : 'none';
        document.getElementById('pauseMenu').style.display = 'none';
    } else {
        document.getElementById('pauseMenu').style.display = isPaused ? 'flex' : 'none';
    }
    logActivity(isPaused ? "GAME PAUSED" : "GAME RESUMED");
    if (!isPaused) {
        if (survivalActive) requestAnimationFrame(survivalLoop);
        else requestAnimationFrame(gameLoop);
    }
}

window.addEventListener('keydown', e => {
    if (e.key === "Escape") {
        if (survivalActive && survivalInventoryOpen) { closeSurvivalInventory(); return; }
        togglePause();
    }
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
    if (e.key === ' ') sKeys.space = false;
});
window.addEventListener('keydown', e => {
    if (e.key === ' ' && survivalActive && !isPaused) sKeys.space = true;
});

function gameOver() {
    gameActive = false;
    shakeAmt = 15;
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
    document.getElementById('survivalPauseMenu').style.display   = 'none';
    document.querySelector('.ui-layer').style.display            = 'none';
    document.getElementById('shipMenu').style.display            = 'flex';
    survivalActive = false;
    gameActive = false;
}

function createShatter(x, y, color, isBoss) {
    const count = isBoss ? 50 : 12;
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 4 + 2,
            life: 1.0,
            color,
        });
    }
}

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
        flashEffect = { timer: 25, color: isSuper ? '#ffff00' : '#00f2ff', size: range };
        shakeAmt = isSuper ? 10 : 5;
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
    player.x += (mouse.x - player.x) * 0.12;
    player.y += (mouse.y - player.y) * 0.12;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x) + Math.PI/2;
    if (hasTrailAbility) {
        shipTrail.push({ x: player.x, y: player.y });
        if (shipTrail.length > 40) shipTrail.shift();
    } else { shipTrail = []; }
    if (Date.now() - lastScoreTime > 1000) {
        score += (playerName === "BLUE_PHOENIX" || playerName === "VORTEX_MAGNET") ? 10 : 1;
        lastScoreTime = Date.now();
        document.getElementById('scr').innerText = score;
    }
    const pWait = zeroCooldown ? 0 : Math.max(0, Math.ceil((6000 - (Date.now() - lastPulse))/1000));
    const sWait = zeroCooldown ? 0 : Math.max(0, Math.ceil((25000 - (Date.now() - lastSuper))/1000));
    document.getElementById('pCharge').innerText = pWait === 0 ? "READY" : pWait + "S";
    document.getElementById('sCharge').innerText = sWait === 0 ? "READY" : sWait + "S";
    if (Math.random() < 0.04 + (difficulty * 0.015)) spawnEnemy(false);
    if (Date.now() > nextBossTime) { spawnEnemy(true); nextBossTime = Date.now() + 45000; }
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];
        const d = Math.hypot(player.x - en.x, player.y - en.y);
        en.x += ((player.x - en.x) / d) * en.speed;
        en.y += ((player.y - en.y) / d) * en.speed;
        en.rot += 0.02;
        if (hasTrailAbility) {
            let elim = false;
            for (let j = 0; j < shipTrail.length; j++) {
                const pt = shipTrail[j];
                if (pt.x > en.x - en.size/2 && pt.x < en.x + en.size/2 &&
                    pt.y > en.y - en.size/2 && pt.y < en.y + en.size/2) { elim = true; break; }
            }
            if (elim) {
                createShatter(en.x, en.y, en.isBoss ? '#bc13fe' : '#ff0044', en.isBoss);
                enemies.splice(i, 1); score += 300;
                document.getElementById('scr').innerText = score;
                logActivity("TRAIL ELIMINATED SENTRON"); continue;
            }
        }
        if (d < (player.size * 0.7) + (en.size * 0.7)) {
            if (isInvincible) {
                createShatter(en.x, en.y, en.isBoss ? '#bc13fe' : '#ff0044', en.isBoss);
                enemies.splice(i, 1); score += 300;
                document.getElementById('scr').innerText = score;
                logActivity("ARMOR CRUSHED SENTRON");
            } else { gameOver(); }
        }
    }
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    });
    if (shakeAmt > 0) shakeAmt *= 0.9;
}

function draw() {
    ctx.fillStyle = 'rgba(0, 5, 15, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (shakeAmt > 0.1) ctx.translate((Math.random()-0.5)*shakeAmt, (Math.random()-0.5)*shakeAmt);
    particles.forEach(p => {
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    if (gameActive && hasTrailAbility && shipTrail.length > 1) {
        ctx.save();
        ctx.beginPath(); ctx.strokeStyle = "#00d2ff"; ctx.shadowColor = "#0066ff";
        ctx.shadowBlur = 15; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.moveTo(shipTrail[0].x, shipTrail[0].y);
        for (let i = 1; i < shipTrail.length; i++) ctx.lineTo(shipTrail[i].x, shipTrail[i].y);
        ctx.stroke(); ctx.restore();
    }
    enemies.forEach(en => {
        ctx.save(); ctx.translate(en.x, en.y); ctx.rotate(en.rot);
        ctx.shadowBlur = en.isBoss ? 20 : 10;
        ctx.shadowColor = en.isBoss ? '#bc13fe' : '#ff0044';
        ctx.fillStyle = en.isBoss ? '#bc13fe' : '#ff0044';
        if (en.isBoss) ctx.fillRect(-en.size/2, -en.size/2, en.size, en.size);
        else {
            ctx.beginPath(); ctx.moveTo(0, -en.size/2);
            ctx.lineTo(en.size/2, en.size/2); ctx.lineTo(-en.size/2, en.size/2); ctx.fill();
        }
        ctx.restore();
    });
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
    ctx.shadowBlur = 15; ctx.shadowColor = '#00f2ff';
    ctx.drawImage(shipImg, -player.size, -player.size, player.size*2, player.size*2);
    ctx.restore();
    if (flashEffect.timer > 0) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, flashEffect.size * (1 - flashEffect.timer/25), 0, Math.PI*2);
        ctx.strokeStyle = flashEffect.color; ctx.lineWidth = flashEffect.timer; ctx.stroke();
        flashEffect.timer--;
    }
    ctx.restore();
}

function gameLoop() {
    update(); draw();
    if (gameActive && !isPaused) requestAnimationFrame(gameLoop);
}

async function logActivity(action) {
    const url = "https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log";
    const pName = typeof playerName !== 'undefined' && playerName ? playerName : "Pilot";
    const currentScore = typeof score !== 'undefined' ? score : 0;
    const formBody = `player=${encodeURIComponent(pName)}&action=${encodeURIComponent(action)}&score=${encodeURIComponent(currentScore)}`;
    fetch(url, { method:"POST", mode:"cors", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:formBody }).catch(()=>{});
}

// =============================================================================
//   SURVIVAL MODE
// =============================================================================

let survivalActive = false;
let survivalInventoryOpen = false;
const sKeys = { left: false, right: false, up: false, down: false, space: false };

let sPlayer = { x: 0, y: 0, w: 52, h: 52, speed: 6, lives: 3, invincTimer: 0 };

let sBullets    = [];
let sEnemies    = [];
let sEBullets   = [];
let sPowerDrops = [];
let sCoinDrops  = [];
let sParticles  = [];

let sScore      = 0;
let sCoins      = 0;
let sWave       = 1;
let sKills      = 0;
let sBossActive = false;
const KILLS_PER_BOSS  = 10;
const WAVE_DROPS_STOP = 3;

// --- COMBO SYSTEM ---
// Kill 5 enemies in a row without any escaping = +5 coins
// Enemy escaping just resets the combo — NO life lost
let sCombo        = 0;
const COMBO_GOAL  = 5;
const COMBO_COINS = 5;
let comboDisplay  = { text: '', timer: 0, x: 0, y: 0, color: '#ffaa00' };

let puSlots    = [null, null, null, null];
let puUnlocked = [];

let puEffects = {
    rapidFire:  { active: false, timer: 0 },
    shield:     { active: false, timer: 0 },
    laserBeam:  { active: false, timer: 0 },
    tripleShot: { active: false, timer: 0 },
    bombBlast:  { active: false, timer: 0 },
    timeSlow:   { active: false, timer: 0 },
};

let sLastShot = 0;
const S_SHOOT_DELAY = 220;

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

const POWER_UP_DEFS = [
    { type:'rapidFire',  icon:'⚡', label:'RAPID FIRE', cost:5,  color:'#ffff00', duration:8000  },
    { type:'shield',     icon:'🛡', label:'SHIELD',     cost:6,  color:'#00f2ff', duration:0     },
    { type:'laserBeam',  icon:'🔴', label:'LASER',      cost:8,  color:'#ff0044', duration:5000  },
    { type:'tripleShot', icon:'🔱', label:'TRIPLE',     cost:5,  color:'#bc13fe', duration:7000  },
    { type:'bombBlast',  icon:'💥', label:'BOMB',       cost:7,  color:'#ff8800', duration:0     },
    { type:'timeSlow',   icon:'⏱', label:'SLOW-MO',    cost:6,  color:'#00ffaa', duration:6000  },
];

// --- Build Survival Pause Menu ---
(function buildSurvivalPauseMenu() {
    if (document.getElementById('survivalPauseMenu')) return;
    const div = document.createElement('div');
    div.id = 'survivalPauseMenu';
    div.className = 'menu-overlay';
    div.style.display = 'none';
    div.innerHTML = `
        <div class="terminal-box" style="border-color:#ffaa00;box-shadow:0 0 40px #ffaa00;min-width:340px;">
            <h1 style="color:#ffaa00;">⚡ PAUSED</h1>
            <button class="btn" style="background:#ffaa00;color:#000;" onclick="togglePause()">RESUME</button>
            <button class="btn" style="background:#bc13fe;color:#fff;" onclick="openSurvivalInventory()">📦 INVENTORY</button>
            <button class="btn" onclick="backToMenu()">QUIT</button>
        </div>
    `;
    document.body.appendChild(div);
})();

// --- Build Inventory Overlay ---
(function buildInventoryOverlay() {
    if (document.getElementById('survivalInventoryOverlay')) return;
    const div = document.createElement('div');
    div.id = 'survivalInventoryOverlay';
    div.className = 'menu-overlay';
    div.style.display = 'none';
    div.style.zIndex = '2000';
    div.innerHTML = `
        <div class="terminal-box" style="border-color:#bc13fe;box-shadow:0 0 40px #bc13fe;
             min-width:480px;max-width:560px;max-height:85vh;overflow-y:auto;">
            <h2 style="color:#bc13fe;letter-spacing:3px;">📦 INVENTORY</h2>
            <div style="display:flex;justify-content:center;gap:30px;margin:10px 0 18px;">
                <div style="text-align:center;">
                    <span style="font-size:0.55rem;color:#ffaa0099;letter-spacing:3px;display:block;">COINS</span>
                    <span id="invCoinsDisplay" style="font-size:1.6rem;color:#ffaa00;font-weight:bold;">0</span>
                </div>
                <div style="text-align:center;">
                    <span style="font-size:0.55rem;color:#ffaa0099;letter-spacing:3px;display:block;">WAVE</span>
                    <span id="invWaveDisplay" style="font-size:1.6rem;color:#ffffff;font-weight:bold;">1</span>
                </div>
                <div style="text-align:center;">
                    <span style="font-size:0.55rem;color:#ffaa0099;letter-spacing:3px;display:block;">COMBO</span>
                    <span id="invComboDisplay" style="font-size:1.6rem;color:#ffaa00;font-weight:bold;">0/5</span>
                </div>
            </div>
            <p style="color:#ff004488;font-size:0.65rem;letter-spacing:2px;margin-bottom:14px;">
                ACTIVE SLOTS — press 1–4 in game to activate
            </p>
            <div id="invActiveSlots" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;"></div>
            <hr style="border-color:#333;margin:14px 0;">
            <p style="color:#bc13fe88;font-size:0.65rem;letter-spacing:2px;margin-bottom:10px;">
                BUY POWER-UPS — spend coins to add to active slots
            </p>
            <div id="invShopGrid" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;"></div>
            <hr style="border-color:#333;margin:14px 0;">
            <p style="color:#ffaa0066;font-size:0.6rem;letter-spacing:2px;">
                💡 COMBO: Kill 5 in a row without any escaping = +5 coins. Missing just resets the streak.
            </p>
            <button class="btn" style="background:#bc13fe;color:#fff;margin-top:12px;" onclick="closeSurvivalInventory()">CLOSE</button>
        </div>
    `;
    document.body.appendChild(div);
})();

function openSurvivalInventory() {
    survivalInventoryOpen = true;
    document.getElementById('survivalPauseMenu').style.display = 'none';
    renderInventoryOverlay();
    document.getElementById('survivalInventoryOverlay').style.display = 'flex';
}

function closeSurvivalInventory() {
    survivalInventoryOpen = false;
    document.getElementById('survivalInventoryOverlay').style.display = 'none';
    document.getElementById('survivalPauseMenu').style.display = 'flex';
}

function renderInventoryOverlay() {
    document.getElementById('invCoinsDisplay').innerText = sCoins;
    document.getElementById('invWaveDisplay').innerText  = sWave;
    document.getElementById('invComboDisplay').innerText = `${sCombo}/${COMBO_GOAL}`;

    const slotsEl = document.getElementById('invActiveSlots');
    slotsEl.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const pu = puSlots[i];
        const cell = document.createElement('div');
        cell.style.cssText = `
            width:90px;height:90px;border:2px solid ${pu ? pu.color : '#333'};
            border-radius:8px;background:rgba(0,0,0,0.9);display:flex;
            flex-direction:column;align-items:center;justify-content:center;
            cursor:${pu ? 'pointer' : 'default'};font-family:'Courier New',monospace;
            box-shadow:${pu ? `0 0 12px ${pu.color}55` : 'none'};
        `;
        if (pu) {
            cell.innerHTML = `
                <span style="font-size:1.8rem;">${pu.icon}</span>
                <span style="font-size:0.5rem;color:${pu.color};letter-spacing:1px;margin-top:4px;">${pu.label}</span>
                <span style="font-size:0.45rem;color:#888;margin-top:2px;">SLOT ${i+1} · press ${i+1}</span>
            `;
            cell.onclick = () => { usePowerUp(i); renderInventoryOverlay(); };
        } else {
            cell.innerHTML = `<span style="font-size:0.65rem;color:#333;">[EMPTY ${i+1}]</span>`;
        }
        slotsEl.appendChild(cell);
    }

    const shopEl = document.getElementById('invShopGrid');
    shopEl.innerHTML = '';
    POWER_UP_DEFS.forEach(def => {
        const canAfford = sCoins >= def.cost;
        const cell = document.createElement('div');
        cell.style.cssText = `
            width:110px;padding:12px 8px;border:2px solid ${canAfford ? def.color : '#333'};
            border-radius:8px;background:rgba(0,0,0,0.9);display:flex;
            flex-direction:column;align-items:center;justify-content:center;
            cursor:${canAfford ? 'pointer' : 'not-allowed'};
            font-family:'Courier New',monospace;text-align:center;
            opacity:${canAfford ? '1' : '0.45'};
            box-shadow:${canAfford ? `0 0 12px ${def.color}44` : 'none'};transition:0.15s;
        `;
        cell.innerHTML = `
            <span style="font-size:1.8rem;">${def.icon}</span>
            <span style="font-size:0.5rem;color:${def.color};letter-spacing:1px;margin-top:5px;">${def.label}</span>
            <span style="font-size:0.6rem;color:${canAfford ? '#ffaa00' : '#ff4444'};margin-top:4px;font-weight:bold;">${def.cost} 🪙</span>
        `;
        if (canAfford) {
            cell.onclick = () => {
                if (sCoins < def.cost) return;
                sCoins -= def.cost;
                addToInventory({ ...def, firstUse: false });
                updateSurvivalHUD();
                renderInventoryOverlay();
                logActivity(`POWER-UP BOUGHT: ${def.label}`);
            };
        }
        shopEl.appendChild(cell);
    });
}

function startSurvival() {
    shipImg.src = selectedShipSrc;
    document.getElementById('shipMenu').style.display                    = 'none';
    document.getElementById('gameOverScreen').style.display              = 'none';
    document.getElementById('survivalOverScreen').style.display          = 'none';
    document.getElementById('survivalPauseMenu').style.display           = 'none';
    document.getElementById('survivalInventoryOverlay').style.display    = 'none';
    document.querySelector('.ui-layer').style.display                    = 'none';
    document.getElementById('survivalHUD').style.display                 = 'flex';
    document.getElementById('powerupBar').style.display                  = 'flex';
    document.getElementById('powerupBar-label').style.display            = 'block';

    survivalActive        = true;
    gameActive            = false;
    isPaused              = false;
    survivalInventoryOpen = false;

    sPlayer.x = canvas.width / 2;
    sPlayer.y = canvas.height - 100;
    sPlayer.lives = 3;
    sPlayer.invincTimer = 0;

    sBullets = []; sEnemies = []; sEBullets = [];
    sPowerDrops = []; sCoinDrops = []; sParticles = [];

    sScore = 0; sCoins = 0; sWave = 1; sKills = 0;
    sBossActive = false;
    sLastShot   = Date.now();
    sCombo      = 0;
    comboDisplay = { text: '', timer: 0, x: 0, y: 0, color: '#ffaa00' };

    puSlots    = [null, null, null, null];
    puUnlocked = [];
    Object.keys(puEffects).forEach(k => { puEffects[k].active = false; puEffects[k].timer = 0; });
    sStars.forEach(s => { s.x = Math.random() * canvas.width; s.y = Math.random() * canvas.height; });

    updateSurvivalHUD();
    renderPowerUpBar();
    spawnSurvivalWave();
    logActivity(`SURVIVAL START: ${playerName}`);
    requestAnimationFrame(survivalLoop);
}

function spawnSurvivalWave() {
    const count = sWave <= 2 ? 3 : sWave <= 4 ? 4 : 5;
    for (let i = 0; i < count; i++) {
        setTimeout(() => { if (!survivalActive) return; spawnSurvivalEnemy(false); }, i * 1100);
    }
}

function spawnSurvivalEnemy(isBoss) {
    const w = isBoss ? 84 : 36;
    const h = isBoss ? 84 : 36;
    const x = Math.random() * (canvas.width - w * 2) + w;
    const baseSpd = isBoss ? 0.7 + sWave * 0.05 : 1.1 + sWave * 0.12;
    const spd     = puEffects.timeSlow.active ? baseSpd * 0.45 : baseSpd;
    const hp      = isBoss ? 14 + sWave * 3 : sWave >= 9 ? 3 : sWave >= 5 ? 2 : 1;
    const baseInterval = isBoss
        ? Math.max(1800, 3200 - sWave * 120)
        : Math.max(2800, 5000 - sWave * 200);
    const zigzag = !isBoss && sWave >= 8;
    sEnemies.push({
        x, y: -h / 2 - 10, w, h,
        speed: spd, baseSpeed: baseSpd,
        isBoss, hp, maxHp: hp, rot: 0,
        lastShot: Date.now() + Math.random() * 2500,
        shootInterval: baseInterval + Math.random() * 1500,
        color: hp >= 3 ? '#ff8800' : (isBoss ? '#bc13fe' : '#ff0044'),
        pulseT: 0, zigzag,
        zigzagPhase: Math.random() * Math.PI * 2,
        zigzagAmp: 1.8 + Math.random() * 1.2,
    });
}

function survivalShoot() {
    const now   = Date.now();
    const delay = puEffects.rapidFire.active ? S_SHOOT_DELAY * 0.38 : S_SHOOT_DELAY;
    if (now - sLastShot < delay) return;
    sLastShot = now;
    if (puEffects.laserBeam.active) { triggerLaser(); return; }
    const angles = puEffects.tripleShot.active ? [-20, 0, 20] : [0];
    angles.forEach(deg => {
        const rad = deg * Math.PI / 180;
        sBullets.push({
            x: sPlayer.x + Math.sin(rad) * 10,
            y: sPlayer.y - sPlayer.h / 2,
            vx: Math.sin(rad) * 7, vy: -14,
            r: 4, color: '#00f2ff', trail: [],
        });
    });
}

function triggerLaser() {
    for (let i = sEnemies.length - 1; i >= 0; i--) {
        const en = sEnemies[i];
        if (Math.abs(en.x - sPlayer.x) < en.w / 2 + 35) {
            en.hp = 0; killSurvivalEnemy(i);
        }
    }
    sBullets.push({ type: 'laser', x: sPlayer.x, life: 1 });
}

// --- COMBO HELPERS ---
function onKillCombo(ex, ey) {
    sCombo++;
    if (sCombo >= COMBO_GOAL) {
        sCoins += COMBO_COINS;
        comboDisplay = {
            text: `🔥 ${sCombo}x COMBO! +${COMBO_COINS} COINS`,
            timer: 130, x: canvas.width / 2, y: canvas.height / 2 - 80, color: '#ffaa00',
        };
        sCombo = 0;
        updateSurvivalHUD();
        logActivity(`COMBO REWARD: +${COMBO_COINS} COINS`);
    } else {
        comboDisplay = {
            text: `${sCombo}x COMBO`,
            timer: 60, x: ex, y: ey - 30,
            color: sCombo >= 3 ? '#ffdd00' : '#ffaa00',
        };
    }
}

function breakCombo() {
    if (sCombo > 0) {
        comboDisplay = {
            text: 'COMBO BROKEN', timer: 70,
            x: canvas.width / 2, y: canvas.height / 2 - 50, color: '#ff4444',
        };
        sCombo = 0;
    }
}

function survivalUpdate() {
    if (!survivalActive || isPaused) return;

    if (sKeys.left  && sPlayer.x - sPlayer.w / 2 > 0)                  sPlayer.x -= sPlayer.speed;
    if (sKeys.right && sPlayer.x + sPlayer.w / 2 < canvas.width)        sPlayer.x += sPlayer.speed;
    if (sKeys.up    && sPlayer.y - sPlayer.h / 2 > 70)                  sPlayer.y -= sPlayer.speed;
    if (sKeys.down  && sPlayer.y + sPlayer.h / 2 < canvas.height - 90)  sPlayer.y += sPlayer.speed;

    if (sKeys.space) survivalShoot();
    if (sPlayer.invincTimer > 0) sPlayer.invincTimer--;

    Object.keys(puEffects).forEach(k => {
        if (puEffects[k].active && puEffects[k].timer > 0) {
            puEffects[k].timer -= 16;
            if (puEffects[k].timer <= 0) { puEffects[k].active = false; puEffects[k].timer = 0; }
        }
    });
    sEnemies.forEach(en => { en.speed = puEffects.timeSlow.active ? en.baseSpeed * 0.45 : en.baseSpeed; });
    if (comboDisplay.timer > 0) comboDisplay.timer--;

    // Player bullets
    for (let i = sBullets.length - 1; i >= 0; i--) {
        const b = sBullets[i];
        if (b.type === 'laser') { b.life -= 0.15; if (b.life <= 0) sBullets.splice(i, 1); continue; }
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 8) b.trail.shift();
        b.x += b.vx; b.y += b.vy;
        if (b.y < -20) { sBullets.splice(i, 1); continue; }
        let hit = false;
        for (let j = sEnemies.length - 1; j >= 0; j--) {
            const en = sEnemies[j];
            if (b.x > en.x - en.w/2 && b.x < en.x + en.w/2 &&
                b.y > en.y - en.h/2 && b.y < en.y + en.h/2) {
                en.hp--;
                if (en.hp <= 0) killSurvivalEnemy(j);
                hit = true; break;
            }
        }
        if (hit) sBullets.splice(i, 1);
    }

    // Enemies
    for (let i = sEnemies.length - 1; i >= 0; i--) {
        const en = sEnemies[i];
        en.y     += en.speed;
        en.rot   += 0.025;
        en.pulseT = (en.pulseT || 0) + 0.08;
        if (en.zigzag) {
            en.zigzagPhase += 0.04;
            en.x += Math.sin(en.zigzagPhase) * en.zigzagAmp;
            en.x = Math.max(en.w, Math.min(canvas.width - en.w, en.x));
        }
        // Enemy escapes bottom — NO life lost, just break combo
        if (en.y > canvas.height + en.h) {
            sEnemies.splice(i, 1);
            if (!en.isBoss) breakCombo();
            continue;
        }
        const now = Date.now();
        if (now - en.lastShot > en.shootInterval) { en.lastShot = now; fireEnemyBullet(en); }
        if (sPlayer.invincTimer === 0 &&
            Math.abs(en.x - sPlayer.x) < (en.w + sPlayer.w) / 2 * 0.75 &&
            Math.abs(en.y - sPlayer.y) < (en.h + sPlayer.h) / 2 * 0.75) {
            createSurvivalParticles(en.x, en.y, en.color, en.isBoss);
            sEnemies.splice(i, 1);
            if (puEffects.shield.active) {
                puEffects.shield.active = false;
                createSurvivalParticles(sPlayer.x, sPlayer.y, '#00f2ff', false);
            } else { breakCombo(); survivalTakeDamage(); }
        }
    }

    // Enemy bullets
    for (let i = sEBullets.length - 1; i >= 0; i--) {
        const b = sEBullets[i];
        b.x += b.vx; b.y += b.vy;
        if (b.y > canvas.height + 10 || b.x < -10 || b.x > canvas.width + 10) {
            sEBullets.splice(i, 1); continue;
        }
        if (sPlayer.invincTimer === 0 &&
            b.x > sPlayer.x - sPlayer.w / 2 && b.x < sPlayer.x + sPlayer.w / 2 &&
            b.y > sPlayer.y - sPlayer.h / 2 && b.y < sPlayer.y + sPlayer.h / 2) {
            sEBullets.splice(i, 1);
            if (puEffects.shield.active) {
                puEffects.shield.active = false;
                createSurvivalParticles(sPlayer.x, sPlayer.y, '#00f2ff', false);
            } else { breakCombo(); survivalTakeDamage(); }
        }
    }

    // Power-up drops (waves 1-3 only)
    for (let i = sPowerDrops.length - 1; i >= 0; i--) {
        const d = sPowerDrops[i];
        d.y += 1.6; d.rot = (d.rot || 0) + 0.04;
        if (d.y > canvas.height + 30) { sPowerDrops.splice(i, 1); continue; }
        if (Math.abs(d.x - sPlayer.x) < 34 && Math.abs(d.y - sPlayer.y) < 34) {
            addToInventory(d.pu); sPowerDrops.splice(i, 1);
        }
    }

    // Coin drops
    for (let i = sCoinDrops.length - 1; i >= 0; i--) {
        const c = sCoinDrops[i];
        c.y += 1.4; c.rot = (c.rot || 0) + 0.09;
        if (c.y > canvas.height + 20) { sCoinDrops.splice(i, 1); continue; }
        if (Math.abs(c.x - sPlayer.x) < 30 && Math.abs(c.y - sPlayer.y) < 30) {
            sCoins++;
            sCoinDrops.splice(i, 1);
            createSurvivalParticles(c.x, c.y, '#ffaa00', false);
            updateSurvivalHUD(); renderPowerUpBar();
        }
    }

    // Particles
    for (let i = sParticles.length - 1; i >= 0; i--) {
        const p = sParticles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.018;
        if (p.life <= 0) sParticles.splice(i, 1);
    }

    sStars.forEach(s => { s.y += s.spd; if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; } });
    sScore += 0.025;

    // Wave clear
    if (!sBossActive && sEnemies.length === 0) {
        sWave++; sKills = 0;
        updateSurvivalHUD();
        setTimeout(() => { if (survivalActive) spawnSurvivalWave(); }, 2200);
    }
    updateSurvivalHUD();
}

function fireEnemyBullet(en) {
    const spd = en.isBoss ? 4.0 : 2.8 + sWave * 0.08;
    if (en.isBoss) {
        [-0.3, 0, 0.3].forEach(offset => {
            sEBullets.push({
                x: en.x, y: en.y + en.h / 2,
                vx: offset * spd * 2.2 + (Math.random() - 0.5) * 0.4,
                vy: spd, r: 6, color: '#ff00ff',
            });
        });
    } else {
        const spread = Math.max(1.2, 2.6 - sWave * 0.1);
        sEBullets.push({
            x: en.x, y: en.y + en.h / 2,
            vx: (Math.random() - 0.5) * spread * 2,
            vy: spd, r: 4, color: '#ff6600',
        });
    }
}

function killSurvivalEnemy(idx) {
    const en = sEnemies[idx];
    createSurvivalParticles(en.x, en.y, en.color, en.isBoss);
    sScore += en.isBoss ? 500 : 100;
    sKills++;
    if (en.isBoss) {
        // Exactly 1 coin per boss
        sCoinDrops.push({ x: en.x, y: en.y, rot: 0 });
        if (sWave <= WAVE_DROPS_STOP) dropPowerUp(en.x, en.y);
        sBossActive = false; shakeAmt = 18;
        logActivity(`SURVIVAL BOSS KILLED - WAVE: ${sWave}`);
    } else {
        if (sWave <= WAVE_DROPS_STOP && Math.random() < 0.40) dropPowerUp(en.x, en.y);
        if (sKills > 0 && sKills % KILLS_PER_BOSS === 0 && !sBossActive) {
            sBossActive = true;
            setTimeout(() => { if (survivalActive) spawnSurvivalEnemy(true); }, 800);
            logActivity(`SURVIVAL BOSS INCOMING - WAVE: ${sWave}`);
        }
    }
    onKillCombo(en.x, en.y);
    sEnemies.splice(idx, 1);
    updateSurvivalHUD();
}

function dropPowerUp(x, y) {
    const def = POWER_UP_DEFS[Math.floor(Math.random() * POWER_UP_DEFS.length)];
    sPowerDrops.push({ x, y, rot: 0, pu: { ...def, firstUse: true } });
}

// Lives only lost by actual hits — never by enemy escaping
function survivalTakeDamage() {
    if (sPlayer.invincTimer > 0) return;
    sPlayer.lives--;
    sPlayer.invincTimer = 110;
    shakeAmt = 14;
    createSurvivalParticles(sPlayer.x, sPlayer.y, '#ff0044', false);
    if (sPlayer.lives <= 0) endSurvival();
    else updateSurvivalHUD();
}

function endSurvival() {
    survivalActive = false;
    document.getElementById('survivalHUD').style.display                 = 'none';
    document.getElementById('powerupBar').style.display                  = 'none';
    document.getElementById('powerupBar-label').style.display            = 'none';
    document.getElementById('survivalPauseMenu').style.display           = 'none';
    document.getElementById('survivalInventoryOverlay').style.display    = 'none';
    document.getElementById('survFinalWave').innerText                   = sWave;
    document.getElementById('survFinalScore').innerText                  = Math.floor(sScore);
    document.getElementById('survivalOverScreen').style.display          = 'flex';
    logActivity(`SURVIVAL END - WAVE: ${sWave} SCORE: ${Math.floor(sScore)}`);
}

function addToInventory(pu) {
    for (let i = 0; i < 4; i++) {
        if (!puSlots[i]) { puSlots[i] = { ...pu }; renderPowerUpBar(); return; }
    }
    puSlots[0] = { ...pu }; renderPowerUpBar();
}

function usePowerUp(idx) {
    const pu = puSlots[idx];
    if (!pu) return;
    activatePowerUp(pu);
    puSlots[idx] = null;
    renderPowerUpBar(); updateSurvivalHUD();
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
        shakeAmt = 20; return;
    }
    if (pu.type === 'shield') { puEffects.shield.active = true; return; }
    if (puEffects[pu.type]) { puEffects[pu.type].active = true; puEffects[pu.type].timer = pu.duration; }
}

function renderPowerUpBar() {
    const bar = document.getElementById('powerupBar');
    bar.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const pu   = puSlots[i];
        const slot = document.createElement('div');
        slot.style.cssText = `
            width:64px;height:64px;border:2px solid ${pu ? pu.color : '#333'};
            border-radius:8px;background:rgba(0,0,0,0.85);
            display:flex;flex-direction:column;align-items:center;
            justify-content:center;cursor:pointer;position:relative;
            transition:0.15s;font-family:'Courier New',monospace;
            opacity:${pu ? '1' : '0.3'};
            box-shadow:${pu ? `0 0 10px ${pu.color}55` : 'none'};
            pointer-events:auto;user-select:none;
        `;
        if (pu) {
            slot.innerHTML = `
                <span style="font-size:1.4rem;">${pu.icon}</span>
                <span style="font-size:0.5rem;color:${pu.color};letter-spacing:1px;">${pu.label}</span>
                <span style="position:absolute;top:2px;left:5px;font-size:0.55rem;color:#555;">${i+1}</span>
            `;
            slot.onclick = () => usePowerUp(i);
            slot.title   = `${pu.label} — Press ${i+1}`;
        } else {
            slot.innerHTML = `<span style="font-size:0.65rem;color:#333;">[${i+1}]</span>`;
        }
        bar.appendChild(slot);
    }
}

function survivalDraw() {
    ctx.fillStyle = '#00010a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    sStars.forEach(s => {
        ctx.save(); ctx.globalAlpha = s.bright; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });

    ctx.save();
    if (shakeAmt > 0.1) { ctx.translate((Math.random()-0.5)*shakeAmt, (Math.random()-0.5)*shakeAmt); shakeAmt *= 0.85; }

    sParticles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); });
    ctx.globalAlpha = 1;

    // Coin drops
    sCoinDrops.forEach(c => {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a4400'; ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('¢', 0, 1);
        ctx.restore();
    });

    // Power-up drops
    sPowerDrops.forEach(d => {
        ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
        ctx.shadowColor = d.pu.color; ctx.shadowBlur = 20 + Math.sin(Date.now() / 200) * 8;
        ctx.strokeStyle = d.pu.color; ctx.lineWidth = 2;
        ctx.strokeRect(-18, -18, 36, 36); ctx.fillStyle = d.pu.color + '22'; ctx.fillRect(-18, -18, 36, 36);
        ctx.shadowBlur = 0; ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.pu.icon, 0, 0); ctx.restore();
    });

    // Enemy bullets
    sEBullets.forEach(b => {
        ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 14; ctx.fillStyle = b.color;
        const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        ctx.translate(b.x, b.y); ctx.rotate(angle);
        ctx.beginPath(); ctx.ellipse(0, 0, b.r * 0.55, b.r * 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    // Player bullets
    sBullets.forEach(b => {
        if (b.type === 'laser') {
            ctx.save(); ctx.globalAlpha = b.life;
            ctx.strokeStyle = '#ff0044'; ctx.lineWidth = 8; ctx.shadowColor = '#ff0044'; ctx.shadowBlur = 35;
            ctx.beginPath(); ctx.moveTo(b.x, canvas.height); ctx.lineTo(b.x, 0); ctx.stroke();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.moveTo(b.x, canvas.height); ctx.lineTo(b.x, 0); ctx.stroke();
            ctx.restore(); return;
        }
        ctx.save();
        b.trail.forEach((pt, ti) => {
            ctx.globalAlpha = (ti / b.trail.length) * 0.5; ctx.fillStyle = b.color;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, b.r * (ti / b.trail.length), 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1; ctx.shadowColor = b.color; ctx.shadowBlur = 20; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 0.45, b.r * 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = b.color; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * 3.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.restore();
    });

    // Enemies
    sEnemies.forEach(en => {
        ctx.save(); ctx.translate(en.x, en.y); ctx.rotate(en.rot);
        const pulse = 1 + Math.sin(en.pulseT) * 0.08;
        ctx.scale(pulse, pulse);
        ctx.shadowColor = en.color; ctx.shadowBlur = en.isBoss ? 35 : 16; ctx.fillStyle = en.color;
        if (en.isBoss) {
            ctx.beginPath();
            for (let s = 0; s < 6; s++) {
                const a = (s / 6) * Math.PI * 2 - Math.PI / 6;
                s === 0 ? ctx.moveTo(Math.cos(a)*en.w/2, Math.sin(a)*en.h/2)
                        : ctx.lineTo(Math.cos(a)*en.w/2, Math.sin(a)*en.h/2);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 2; ctx.stroke();
            ctx.rotate(-en.rot); ctx.scale(1/pulse, 1/pulse);
            const bw = en.w * 1.2;
            ctx.fillStyle = '#220000'; ctx.fillRect(-bw/2, -en.h/2-16, bw, 8);
            ctx.fillStyle = '#ff00ff'; ctx.shadowBlur = 6; ctx.fillRect(-bw/2, -en.h/2-16, bw*(en.hp/en.maxHp), 8);
        } else {
            if (en.maxHp >= 2) { ctx.shadowColor = '#ff8800'; ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2; }
            ctx.beginPath();
            ctx.moveTo(0, en.h/2); ctx.lineTo(en.w/2, -en.h/2); ctx.lineTo(-en.w/2, -en.h/2);
            ctx.closePath(); ctx.fill();
            if (en.maxHp >= 2) {
                ctx.stroke(); ctx.rotate(-en.rot); ctx.scale(1/pulse, 1/pulse);
                for (let p = 0; p < en.hp; p++) {
                    ctx.fillStyle = '#ff8800'; ctx.shadowBlur = 4;
                    ctx.beginPath(); ctx.arc(-4 + p*8, -en.h/2-8, 3, 0, Math.PI*2); ctx.fill();
                }
            }
        }
        ctx.restore();
    });

    // Combo floating text
    if (comboDisplay.timer > 0) {
        const alpha = Math.min(1, comboDisplay.timer / 40);
        const rise  = (130 - comboDisplay.timer) * 0.25;
        ctx.save();
        ctx.globalAlpha = alpha; ctx.fillStyle = comboDisplay.color;
        ctx.shadowColor = comboDisplay.color; ctx.shadowBlur = 18;
        ctx.font = 'bold 22px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(comboDisplay.text, comboDisplay.x, comboDisplay.y - rise);
        ctx.restore();
    }

    // Combo progress bar
    if (sCombo > 0) {
        const pct = sCombo / COMBO_GOAL;
        const barW = 180; const barX = canvas.width/2 - barW/2; const barY = canvas.height - 110;
        ctx.save();
        ctx.fillStyle = '#111'; ctx.fillRect(barX, barY, barW, 8);
        ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8;
        ctx.fillRect(barX, barY, barW * pct, 8);
        ctx.shadowBlur = 0; ctx.fillStyle = '#ffaa00';
        ctx.font = '9px Courier New'; ctx.textAlign = 'center';
        ctx.fillText(`COMBO ${sCombo}/${COMBO_GOAL}`, canvas.width/2, barY - 6);
        ctx.restore();
    }

    // Wave 4 notice
    if (sWave === 4 && sPowerDrops.length === 0 && sEnemies.length > 0) {
        const t = Date.now() % 4000;
        if (t < 3000) {
            ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t/3000);
            ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 14px Courier New'; ctx.textAlign = 'center';
            ctx.fillText('⚠ FIELD DROPS ENDED — BUY FROM INVENTORY (PAUSE)', canvas.width/2, canvas.height/2 - 60);
            ctx.restore();
        }
    }

    // Shield aura
    if (puEffects.shield.active) {
        ctx.save(); ctx.strokeStyle = '#00f2ff'; ctx.lineWidth = 3;
        ctx.shadowColor = '#00f2ff'; ctx.shadowBlur = 24;
        ctx.globalAlpha = 0.55 + Math.sin(Date.now()/100)*0.3;
        ctx.beginPath(); ctx.arc(sPlayer.x, sPlayer.y, sPlayer.w, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }

    // Player ship
    ctx.save(); ctx.translate(sPlayer.x, sPlayer.y);
    ctx.shadowBlur = 20; ctx.shadowColor = sPlayer.invincTimer > 0 ? '#ffff00' : '#00f2ff';
    if (sPlayer.invincTimer > 0) ctx.globalAlpha = 0.5 + Math.sin(Date.now()/55)*0.5;
    ctx.drawImage(shipImg, -sPlayer.w/2, -sPlayer.h/2, sPlayer.w, sPlayer.h);
    ctx.restore();

    // Engine thruster
    ctx.save();
    const eY = sPlayer.y + sPlayer.h/2;
    const flicker = 20 + Math.random()*18;
    const grad = ctx.createLinearGradient(sPlayer.x, eY, sPlayer.x, eY+flicker+12);
    grad.addColorStop(0, '#00f2ffdd'); grad.addColorStop(0.5, '#0044ffaa'); grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad; ctx.shadowColor = '#00f2ff'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(sPlayer.x-9, eY); ctx.lineTo(sPlayer.x+9, eY);
    ctx.lineTo(sPlayer.x+2, eY+flicker); ctx.lineTo(sPlayer.x-2, eY+flicker);
    ctx.closePath(); ctx.fill(); ctx.restore();

    // Active power-up strips
    let stripY = 110;
    Object.entries(puEffects).forEach(([k, v]) => {
        if (!v.active) return;
        const def = POWER_UP_DEFS.find(p => p.type === k); if (!def) return;
        const pct = def.duration > 0 ? Math.max(0, v.timer/def.duration) : 1;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(18, stripY, 140, 28);
        ctx.strokeStyle = def.color; ctx.lineWidth = 1; ctx.strokeRect(18, stripY, 140, 28);
        ctx.font = '12px Courier New'; ctx.fillStyle = def.color; ctx.textBaseline = 'middle';
        ctx.fillText(`${def.icon} ${def.label}`, 26, stripY+14);
        if (def.duration > 0) {
            ctx.fillStyle = def.color+'44'; ctx.fillRect(90, stripY+7, 58, 14);
            ctx.fillStyle = def.color; ctx.fillRect(90, stripY+7, 58*pct, 14);
        }
        ctx.restore(); stripY += 34;
    });

    ctx.restore();
}

function createSurvivalParticles(x, y, color, big) {
    const count = big ? 45 : 11;
    for (let i = 0; i < count; i++) {
        sParticles.push({
            x, y,
            vx: (Math.random()-0.5)*(big?10:5),
            vy: (Math.random()-0.5)*(big?10:5),
            size: Math.random()*(big?7:3)+1,
            life: 1.0, color,
        });
    }
}

function updateSurvivalHUD() {
    const hearts = '❤️'.repeat(Math.max(0, sPlayer.lives)) || '💀';
    document.getElementById('sLives').innerText  = hearts;
    document.getElementById('sWave').innerText   = sWave;
    document.getElementById('sCoins').innerText  = sCoins;
    document.getElementById('sScore').innerText  = Math.floor(sScore);
    renderPowerUpBar();
}

function survivalLoop() {
    survivalUpdate(); survivalDraw();
    if (survivalActive && !isPaused) requestAnimationFrame(survivalLoop);
}

// Mobile touch
let _touchX = 0;
canvas.addEventListener('touchstart', e => {
    if (!survivalActive) return;
    _touchX = e.touches[0].clientX; survivalShoot();
}, { passive: true });
canvas.addEventListener('touchmove', e => {
    if (!survivalActive) return;
    const dx = e.touches[0].clientX - _touchX;
    sPlayer.x = Math.max(sPlayer.w/2, Math.min(canvas.width-sPlayer.w/2, sPlayer.x+dx*0.6));
    _touchX = e.touches[0].clientX; survivalShoot();
}, { passive: true });

window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (survivalActive) sPlayer.y = canvas.height - 100;
});