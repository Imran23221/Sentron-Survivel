// =============================================================================
// SENTRON SURVIVAL — game.js  (complete build)
// =============================================================================

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
    hasTrailAbility = false; isInvincible = false; slowMotion = false; zeroCooldown = false;

    if (playerName === "BLUE_PHOENIX") {
        hasTrailAbility=true; isInvincible=true; slowMotion=true; zeroCooldown=true;
        logActivity("DEVELOPER CHEAT CODE ACTIVATED");
    } else if (playerName === "PHOENIX_ARMOR")  { isInvincible=true;    logActivity("DEVELOPER MATRIX: INVINCIBILITY"); }
    else if (playerName === "CHRONO_BREAK")     { slowMotion=true;      logActivity("DEVELOPER MATRIX: CHRONO SLOW"); }
    else if (playerName === "SINGULARITY_CORE") { zeroCooldown=true;    logActivity("DEVELOPER MATRIX: ZERO CD"); }
    else if (playerName === "VORTEX_MAGNET")    {                        logActivity("DEVELOPER MATRIX: PASSIVE MULTIPLIER"); }
    else if (playerName === "PHOENIX_TRAIL")    { hasTrailAbility=true; logActivity("DEVELOPER MATRIX: ENERGY TRAIL"); }
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
    score=0; enemies=[]; particles=[]; shipTrail=[];
    gameActive=true; isPaused=false;
    lastPulse=Date.now(); lastSuper=Date.now();
    lastScoreTime=Date.now(); nextBossTime=Date.now()+45000;
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
    gameActive=false; shakeAmt=15;
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
    survivalActive=false; gameActive=false;
}

// --- SHATTER & PARTICLES ---
function createShatter(x, y, color, isBoss) {
    const count = isBoss ? 50 : 12;
    for (let i=0;i<count;i++) {
        particles.push({ x,y, vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, size:Math.random()*4+2, life:1.0, color });
    }
}

// --- CLASSIC GAMEPLAY ---
window.addEventListener('mousemove', e => { mouse.x=e.clientX; mouse.y=e.clientY; });
window.addEventListener('mousedown', e => {
    if (survivalActive) return;
    if (!gameActive || isPaused) return;
    if (e.button===0) triggerPulse(false);
    if (e.button===2) triggerPulse(true);
});
window.addEventListener('contextmenu', e => e.preventDefault());

function spawnEnemy(isBoss=false) {
    const size=isBoss?110:30;
    let baseSpeed=(1.6+(difficulty*0.7));
    if (slowMotion) baseSpeed*=0.5;
    const speed=isBoss?(slowMotion?0.45:0.9):baseSpeed;
    let x,y;
    if (Math.random()<0.5) { x=Math.random()<0.5?-size:canvas.width+size; y=Math.random()*canvas.height; }
    else { x=Math.random()*canvas.width; y=Math.random()<0.5?-size:canvas.height+size; }
    enemies.push({x,y,size,speed,isBoss,rot:Math.random()*Math.PI});
}

function triggerPulse(isSuper) {
    const now=Date.now();
    const cd=isSuper?25000:6000;
    const last=isSuper?lastSuper:lastPulse;
    const range=isSuper?600:300;
    if (zeroCooldown||(now-last>=cd)) {
        flashEffect={timer:25,color:isSuper?'#ffff00':'#00f2ff',size:range};
        shakeAmt=isSuper?10:5;
        enemies=enemies.filter(en=>{
            const dist=Math.hypot(player.x-en.x,player.y-en.y);
            if (dist<range) {
                if (en.isBoss&&!isSuper) return true;
                createShatter(en.x,en.y,en.isBoss?'#bc13fe':'#ff0044',en.isBoss);
                return false;
            }
            return true;
        });
        if (isSuper) lastSuper=now; else lastPulse=now;
        logActivity(isSuper?"SUPERNOVA":"PULSE");
    }
}

function update() {
    if (!gameActive||isPaused) return;
    player.x+=(mouse.x-player.x)*0.12;
    player.y+=(mouse.y-player.y)*0.12;
    player.angle=Math.atan2(mouse.y-player.y,mouse.x-player.x)+Math.PI/2;
    if (hasTrailAbility) {
        shipTrail.push({x:player.x,y:player.y});
        if (shipTrail.length>40) shipTrail.shift();
    } else { shipTrail=[]; }
    if (Date.now()-lastScoreTime>1000) {
        score+=(playerName==="BLUE_PHOENIX"||playerName==="VORTEX_MAGNET")?10:1;
        lastScoreTime=Date.now();
        document.getElementById('scr').innerText=score;
    }
    const pWait=zeroCooldown?0:Math.max(0,Math.ceil((6000-(Date.now()-lastPulse))/1000));
    const sWait=zeroCooldown?0:Math.max(0,Math.ceil((25000-(Date.now()-lastSuper))/1000));
    document.getElementById('pCharge').innerText=pWait===0?"READY":pWait+"S";
    document.getElementById('sCharge').innerText=sWait===0?"READY":sWait+"S";
    if (Math.random()<0.04+(difficulty*0.015)) spawnEnemy(false);
    if (Date.now()>nextBossTime) { spawnEnemy(true); nextBossTime=Date.now()+45000; }
    for (let i=enemies.length-1;i>=0;i--) {
        let en=enemies[i];
        const d=Math.hypot(player.x-en.x,player.y-en.y);
        en.x+=((player.x-en.x)/d)*en.speed;
        en.y+=((player.y-en.y)/d)*en.speed;
        en.rot+=0.02;
        if (hasTrailAbility) {
            let elim=false;
            for (let j=0;j<shipTrail.length;j++) {
                const pt=shipTrail[j];
                if (pt.x>en.x-en.size/2&&pt.x<en.x+en.size/2&&pt.y>en.y-en.size/2&&pt.y<en.y+en.size/2){elim=true;break;}
            }
            if (elim) {
                createShatter(en.x,en.y,en.isBoss?'#bc13fe':'#ff0044',en.isBoss);
                enemies.splice(i,1); score+=300;
                document.getElementById('scr').innerText=score;
                logActivity("TRAIL ELIMINATED SENTRON"); continue;
            }
        }
        if (d<(player.size*0.7)+(en.size*0.7)) {
            if (isInvincible) {
                createShatter(en.x,en.y,en.isBoss?'#bc13fe':'#ff0044',en.isBoss);
                enemies.splice(i,1); score+=300;
                document.getElementById('scr').innerText=score;
                logActivity("ARMOR CRUSHED SENTRON");
            } else { gameOver(); }
        }
    }
    particles.forEach((p,i)=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.02;if(p.life<=0)particles.splice(i,1);});
    if (shakeAmt>0) shakeAmt*=0.9;
}

function draw() {
    ctx.fillStyle='rgba(0,5,15,0.4)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();
    if (shakeAmt>0.1) ctx.translate((Math.random()-0.5)*shakeAmt,(Math.random()-0.5)*shakeAmt);
    particles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);});
    ctx.globalAlpha=1;
    if (gameActive&&hasTrailAbility&&shipTrail.length>1) {
        ctx.save();
        ctx.beginPath();ctx.strokeStyle="#00d2ff";ctx.shadowColor="#0066ff";
        ctx.shadowBlur=15;ctx.lineWidth=8;ctx.lineCap="round";ctx.lineJoin="round";
        ctx.moveTo(shipTrail[0].x,shipTrail[0].y);
        for (let i=1;i<shipTrail.length;i++) ctx.lineTo(shipTrail[i].x,shipTrail[i].y);
        ctx.stroke();ctx.restore();
    }
    enemies.forEach(en=>{
        ctx.save();ctx.translate(en.x,en.y);ctx.rotate(en.rot);
        ctx.shadowBlur=en.isBoss?20:10;ctx.shadowColor=en.isBoss?'#bc13fe':'#ff0044';ctx.fillStyle=en.isBoss?'#bc13fe':'#ff0044';
        if (en.isBoss) ctx.fillRect(-en.size/2,-en.size/2,en.size,en.size);
        else{ctx.beginPath();ctx.moveTo(0,-en.size/2);ctx.lineTo(en.size/2,en.size/2);ctx.lineTo(-en.size/2,en.size/2);ctx.fill();}
        ctx.restore();
    });
    ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);
    ctx.shadowBlur=15;ctx.shadowColor='#00f2ff';
    ctx.drawImage(shipImg,-player.size,-player.size,player.size*2,player.size*2);
    ctx.restore();
    if (flashEffect.timer>0) {
        ctx.beginPath();ctx.arc(player.x,player.y,flashEffect.size*(1-flashEffect.timer/25),0,Math.PI*2);
        ctx.strokeStyle=flashEffect.color;ctx.lineWidth=flashEffect.timer;ctx.stroke();flashEffect.timer--;
    }
    ctx.restore();
}

function gameLoop(loopId) {
    if (loopId!==gameLoopId) return;
    update();draw();
    if (gameActive&&!isPaused) requestAnimationFrame(()=>gameLoop(loopId));
}

async function logActivity(action) {
    const url="https://literate-bassoon-pjvq4xxxv7v7hjrr-8001.app.github.dev/log";
    const pName=typeof playerName!=='undefined'&&playerName?playerName:"Pilot";
    const currentScore=typeof score!=='undefined'?score:0;
    const formBody=`player=${encodeURIComponent(pName)}&action=${encodeURIComponent(action)}&score=${encodeURIComponent(currentScore)}`;
    fetch(url,{method:"POST",mode:"cors",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:formBody}).catch(()=>{});
}


// =============================================================================
// ███████╗██╗   ██╗██████╗ ██╗   ██╗██╗██╗   ██╗ █████╗ ██╗
// ██╔════╝██║   ██║██╔══██╗██║   ██║██║██║   ██║██╔══██╗██║
// ███████╗██║   ██║██████╔╝██║   ██║██║██║   ██║███████║██║
// ╚════██║██║   ██║██╔══██╗╚██╗ ██╔╝██║╚██╗ ██╔╝██╔══██║██║
// ███████║╚██████╔╝██║  ██║ ╚████╔╝ ██║ ╚████╔╝ ██║  ██║███████╗
// ╚══════╝ ╚═════╝ ╚═╝  ╚═╝  ╚═══╝  ╚═╝  ╚═══╝  ╚═╝  ╚═╝╚══════╝
//   SURVIVAL MODE — Endless high-score blitz
//   Controls   : WASD / Arrow Keys — move in all 4 directions
//                Space             — shoot (hold for auto-fire)
//                1–4               — activate inventory slot
//                ESC               — pause → SHOP / INVENTORY
//   Combo      : 10 kills in a row → +1 coin.  Breaking = NO life lost.
//   Economy    : Waves 1-3 drop power-ups.  Wave 4+ buy from inventory.
//                Bosses drop exactly 1 coin.
// =============================================================================

let survivalActive = false;
const sKeys = { left:false, right:false, up:false, down:false, space:false };

// ── Player ───────────────────────────────────────────────────────────────────
let sPlayer = { x:0, y:0, w:52, h:52, speed:6, lives:3, invincTimer:0 };

// ── Collections ──────────────────────────────────────────────────────────────
let sBullets    = [];
let sEnemies    = [];
let sEBullets   = [];
let sPowerDrops = [];
let sCoinDrops  = [];
let sParticles  = [];
let sMines      = [];   // proximity mines from mineField power-up
let sAsteroids  = [];   // decorative drifting asteroids (visual only)
let sShootStars = [];   // rare shooting-star streaks in the background

// ── Visual effects ───────────────────────────────────────────────────────────
let sScorePopups     = [];   // "+100" text that floats up from kills
let sWaveAnnounce    = { wave:0, timer:0 };  // "WAVE X" banner at wave start
let sPlayerHistory   = [];   // afterimage trail behind the ship
let sPlayerHistFrame = 0;
let sLightningArcs   = [];   // chain-lightning bolt visuals
let sScreenFlash     = { color:'#ffffff', alpha:0 };  // full-screen color pop
let sOrbitParticles  = [];   // particles that orbit the player (shield visual)
let sComboFlames     = [];   // fire particles around player at high streaks
let sRingExplosions  = [];   // expanding ring on big events (boss death, bomb)
let sDangerLevel     = 0;    // 0-1; drives subtle red tint when crowded

// ── Wave state ───────────────────────────────────────────────────────────────
let sScore          = 0;
let sCoins          = 0;
let sWave           = 1;
let sKills          = 0;
let sBossActive     = false;
let sWaveAdvancing  = false;
let sWaveId         = 0;
let sWavePerfect    = true;  // true if no damage taken this wave → bonus coins

// ── Combo system ─────────────────────────────────────────────────────────────
// Every 10 kills without taking damage = +1 coin spawned at kill position.
// Breaking the combo (enemy escapes OR player hit) NEVER costs a life.
let sComboStreak = 0;
let sComboMult   = 1;
const COMBO_THRESHOLDS = [
    { streak:0,  mult:1   },
    { streak:8,  mult:1.5 },
    { streak:18, mult:2   },
    { streak:32, mult:3   },
];

// ── Session records ───────────────────────────────────────────────────────────
let sSessionBestScore = 0;
let sSessionBestWave  = 1;
let sToasts           = [];
let survivalLoopId    = 0;
const KILLS_PER_BOSS  = 20;
let sDiscoveredPowerUps = new Set();

// ── Power-up slots (4 active) ─────────────────────────────────────────────────
let puSlots = [null, null, null, null];

// ── Active effect timers ──────────────────────────────────────────────────────
let puEffects = {
    rapidFire:    { active:false, timer:0 },
    shield:       { active:false, timer:0 },
    laserBeam:    { active:false, timer:0 },
    tripleShot:   { active:false, timer:0 },
    bombBlast:    { active:false, timer:0 },
    timeSlow:     { active:false, timer:0 },
    homing:       { active:false, timer:0 },
    scoreBoost:   { active:false, timer:0 },
    extraLife:    { active:false, timer:0 },
    // batch 2
    waveBlast:    { active:false, timer:0 },
    coinMagnet:   { active:false, timer:0 },
    sniperMode:   { active:false, timer:0 },
    freezeField:  { active:false, timer:0 },
    bulletWall:   { active:false, timer:0 },
    overcharge:   { active:false, timer:0 },
    // batch 3
    empBlast:     { active:false, timer:0 },
    dualShot:     { active:false, timer:0 },
    lifeSteal:    { active:false, timer:0 },
    turretMode:   { active:false, timer:0 },
    mineField:    { active:false, timer:0 },
    // batch 4
    ricochets:      { active:false, timer:0 },
    goldRush:       { active:false, timer:0 },
    phaseShift:     { active:false, timer:0 },
    chainLightning: { active:false, timer:0 },
    berserker:      { active:false, timer:0 },
    // batch 5 — new
    blackHole:      { active:false, timer:0 },
    reflector:      { active:false, timer:0 },
    scoreRain:      { active:false, timer:0 },
    lastStand:      { active:false, timer:0 },
    rapidEvade:     { active:false, timer:0 },
};

let sLastShot       = 0;
let sTurretLastShot = 0;
let sLastEvadeCheck = 0;
const S_SHOOT_DELAY = 220;

// ── 3-Layer Parallax Starfield ─────────────────────────────────────────────────
const sStars = [];
// Far layer — 90 tiny dim stars
for (let i=0;i<90;i++) sStars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*0.5+0.2,spd:Math.random()*0.22+0.08,bright:Math.random()*0.22+0.08,layer:1,twinkleOff:Math.random()*Math.PI*2,twinkleSpd:Math.random()*0.03+0.01});
// Mid layer — 55 medium stars
for (let i=0;i<55;i++) sStars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*0.7+0.5,spd:Math.random()*0.4+0.28,bright:Math.random()*0.28+0.28,layer:2,twinkleOff:Math.random()*Math.PI*2,twinkleSpd:Math.random()*0.04+0.02});
// Near layer — 25 bright large stars
for (let i=0;i<25;i++) sStars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*1.0+1.2,spd:Math.random()*0.8+0.9,bright:Math.random()*0.3+0.65,layer:3,twinkleOff:Math.random()*Math.PI*2,twinkleSpd:Math.random()*0.05+0.03});

// Seed initial asteroids
for (let i=0;i<4;i++) {
    sAsteroids.push({
        x:Math.random()*canvas.width, y:Math.random()*canvas.height,
        r:Math.random()*22+12, vx:(Math.random()-0.5)*0.28, vy:Math.random()*0.18+0.08,
        rot:Math.random()*Math.PI*2, rotSpd:(Math.random()-0.5)*0.006,
        alpha:Math.random()*0.12+0.06
    });
}

// =============================================================================
// POWER-UP DEFINITIONS — 30 total across 5 batches
// =============================================================================
const POWER_UP_DEFS = [
    // ── BATCH 1 — Originals ───────────────────────────────────────────────────
    { type:'rapidFire',   icon:'⚡', label:'RAPID FIRE',   cost:5,  color:'#ffff00', duration:8000  },
    { type:'shield',      icon:'🛡', label:'SHIELD',        cost:6,  color:'#00f2ff', duration:0     },
    { type:'laserBeam',   icon:'🔴', label:'LASER',         cost:7,  color:'#ff0044', duration:5000  },
    { type:'tripleShot',  icon:'🔱', label:'TRIPLE SHOT',   cost:5,  color:'#bc13fe', duration:7000  },
    { type:'bombBlast',   icon:'💥', label:'BOMB',          cost:6,  color:'#ff8800', duration:0     },
    { type:'timeSlow',    icon:'⏱', label:'SLOW-MO',       cost:5,  color:'#00ffaa', duration:6000  },
    { type:'homing',      icon:'🎯', label:'HOMING',        cost:8,  color:'#66ff66', duration:9000  },
    { type:'scoreBoost',  icon:'✨', label:'2X SCORE',      cost:7,  color:'#ffd700', duration:10000 },
    { type:'extraLife',   icon:'❤️', label:'EXTRA LIFE',   cost:10, color:'#ff3366', duration:0     },
    // ── BATCH 2 ───────────────────────────────────────────────────────────────
    { type:'waveBlast',   icon:'🌊', label:'WAVE BLAST',   cost:5,  color:'#00ccff', duration:0     },
    { type:'coinMagnet',  icon:'🧲', label:'MAGNET',        cost:4,  color:'#ffd700', duration:7000  },
    { type:'sniperMode',  icon:'💠', label:'SNIPER',        cost:9,  color:'#ff6666', duration:6000  },
    { type:'freezeField', icon:'❄️', label:'FREEZE',        cost:7,  color:'#aaddff', duration:3500  },
    { type:'bulletWall',  icon:'🔷', label:'BULLET WALL',  cost:6,  color:'#4488ff', duration:5000  },
    { type:'overcharge',  icon:'🔋', label:'OVERCHARGE',   cost:8,  color:'#ff44ff', duration:5000  },
    // ── BATCH 3 ───────────────────────────────────────────────────────────────
    { type:'empBlast',    icon:'📡', label:'EMP BLAST',    cost:6,  color:'#ffcc00', duration:6000  },
    { type:'dualShot',    icon:'↕️', label:'DUAL SHOT',    cost:6,  color:'#ff88ff', duration:7000  },
    { type:'lifeSteal',   icon:'🩸', label:'LIFE STEAL',   cost:5,  color:'#ff2244', duration:10000 },
    { type:'turretMode',  icon:'🗼', label:'TURRET',        cost:7,  color:'#aaffaa', duration:5000  },
    { type:'mineField',   icon:'💣', label:'MINE FIELD',   cost:7,  color:'#ff9900', duration:0     },
    // ── BATCH 4 ───────────────────────────────────────────────────────────────
    { type:'ricochets',      icon:'↩️', label:'RICOCHETS',      cost:6,  color:'#88ffee', duration:9000 },
    { type:'goldRush',       icon:'💰', label:'GOLD RUSH',      cost:8,  color:'#ffd700', duration:8000 },
    { type:'phaseShift',     icon:'👻', label:'PHASE SHIFT',    cost:9,  color:'#cc88ff', duration:3000 },
    { type:'chainLightning', icon:'🌩', label:'CHAIN BOLT',     cost:9,  color:'#aaff00', duration:7000 },
    { type:'berserker',      icon:'🔥', label:'BERSERKER',      cost:10, color:'#ff4400', duration:4000 },
    // ── BATCH 5 — New ─────────────────────────────────────────────────────────
    // blackHole  : instantly pulls ALL enemies to screen center, stunning them for 1.5s
    { type:'blackHole',   icon:'🕳', label:'BLACK HOLE',   cost:9,  color:'#8800ff', duration:0     },
    // reflector  : any enemy bullet that gets within 70px is reversed back as damage
    { type:'reflector',   icon:'🪞', label:'REFLECTOR',    cost:8,  color:'#88ffff', duration:6000  },
    // scoreRain  : passive score ticks 5× faster for 8 seconds
    { type:'scoreRain',   icon:'💫', label:'SCORE RAIN',   cost:6,  color:'#ffffaa', duration:8000  },
    // lastStand  : if you would die, survive with 1 HP instead (one-time per pickup)
    { type:'lastStand',   icon:'⚰️', label:'LAST STAND',   cost:12, color:'#ff0000', duration:0     },
    // rapidEvade : automatically nudges you sideways when a bullet is on a collision path
    { type:'rapidEvade',  icon:'💨', label:'AUTO EVADE',   cost:7,  color:'#ccffcc', duration:6000  },
];

// =============================================================================
// SURVIVAL — DOM INJECTION (pause menu + inventory overlay)
// =============================================================================
(function injectSurvivalDOM() {
    if (!document.getElementById('survivalPauseMenu')) {
        const pm=document.createElement('div');
        pm.id='survivalPauseMenu'; pm.className='menu-overlay'; pm.style.display='none';
        pm.innerHTML=`
            <div class="terminal-box" style="border-color:#ffaa00;box-shadow:0 0 40px #ffaa00;min-width:340px;">
                <h1 style="color:#ffaa00;">⚡ PAUSED</h1>
                <button class="btn" style="background:#ffaa00;color:#000;" onclick="togglePause()">RESUME</button>
                <button class="btn" style="background:#bc13fe;color:#fff;margin-top:6px;" onclick="openSurvivalInventory()">📦 SHOP / INVENTORY</button>
                <button class="btn" style="margin-top:6px;" onclick="backToMenu()">QUIT</button>
            </div>`;
        document.body.appendChild(pm);
    }

    if (!document.getElementById('survivalInventory')) {
        const inv=document.createElement('div');
        inv.id='survivalInventory'; inv.className='menu-overlay';
        inv.style.cssText='display:none;z-index:2000;';
        inv.innerHTML=`
            <div class="terminal-box" style="border-color:#bc13fe;box-shadow:0 0 40px #bc13fe;
                 min-width:560px;max-width:760px;max-height:90vh;overflow-y:auto;">
                <h2 style="color:#bc13fe;letter-spacing:3px;margin-bottom:4px;">📦 SHOP &amp; INVENTORY</h2>
                <div style="display:flex;justify-content:center;gap:24px;margin:8px 0 14px;flex-wrap:wrap;">
                    <div style="text-align:center;">
                        <span style="font-size:0.52rem;color:#ffaa0099;letter-spacing:3px;display:block;">COINS</span>
                        <span id="invCoins" style="font-size:1.5rem;color:#ffaa00;font-weight:bold;">0</span>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.52rem;color:#ffaa0099;letter-spacing:3px;display:block;">WAVE</span>
                        <span id="invWave" style="font-size:1.5rem;color:#fff;font-weight:bold;">1</span>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.52rem;color:#ffaa0099;letter-spacing:3px;display:block;">STREAK</span>
                        <span id="invStreak" style="font-size:1.5rem;color:#ffaa00;font-weight:bold;">0</span>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.52rem;color:#ffaa0099;letter-spacing:3px;display:block;">MULT</span>
                        <span id="invMult" style="font-size:1.5rem;color:#ffaa00;font-weight:bold;">x1</span>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:0.52rem;color:#ffaa0099;letter-spacing:3px;display:block;">ENEMIES</span>
                        <span id="invEnemies" style="font-size:1.5rem;color:#ff4444;font-weight:bold;">0</span>
                    </div>
                </div>
                <p style="color:#ff004488;font-size:0.58rem;letter-spacing:2px;margin-bottom:8px;">ACTIVE SLOTS — press 1-4 in-game</p>
                <div id="invSlots" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;"></div>
                <hr style="border-color:#333;margin:10px 0;">
                <p style="color:#bc13fe88;font-size:0.58rem;letter-spacing:2px;margin-bottom:8px;">BUY POWER-UPS — 30 available</p>
                <div id="inventoryGrid" style="display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;"></div>
                <hr style="border-color:#333;margin:10px 0;">
                <p style="color:#ffaa0055;font-size:0.5rem;letter-spacing:1.5px;line-height:1.8;">
                    💡 <b style="color:#ffaa00">10 kills in a row</b> = +1 coin on field &nbsp;·&nbsp;
                    Breaking combo costs <b style="color:#00f2ff">NO lives</b> &nbsp;·&nbsp;
                    Clear a wave without damage = <b style="color:#ffaa00">+3 bonus coins</b>
                </p>
                <button class="btn" style="background:#bc13fe;color:#fff;margin-top:12px;" onclick="closeSurvivalInventory()">CLOSE</button>
            </div>`;
        document.body.appendChild(inv);
    }
})();

// =============================================================================
// SURVIVAL — INVENTORY / SHOP
// =============================================================================
function openSurvivalInventory() {
    renderInventoryShop();
    document.getElementById('survivalInventory').style.display='flex';
}

function closeSurvivalInventory() {
    document.getElementById('survivalInventory').style.display='none';
}

function renderInventoryShop() {
    const set=(id,val)=>{const el=document.getElementById(id);if(el)el.innerText=val;};
    set('invCoins',   sCoins);
    set('invWave',    sWave);
    set('invStreak',  sComboStreak);
    set('invMult',    `x${sComboMult}`);
    set('invEnemies', sEnemies.length);

    const slotsEl=document.getElementById('invSlots');
    if (slotsEl) {
        slotsEl.innerHTML='';
        for (let i=0;i<4;i++) {
            const pu=puSlots[i];
            const cell=document.createElement('div');
            cell.style.cssText=`width:88px;height:88px;border:2px solid ${pu?pu.color:'#333'};border-radius:8px;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:${pu?'pointer':'default'};font-family:'Courier New',monospace;box-shadow:${pu?`0 0 12px ${pu.color}55`:'none'};`;
            if (pu) {
                const costLabel=pu.firstUse?'FREE':`${pu.cost}🪙`;
                const canAfford=pu.firstUse||sCoins>=pu.cost;
                cell.innerHTML=`<span style="font-size:1.6rem;">${pu.icon}</span><span style="font-size:0.43rem;color:${pu.color};letter-spacing:1px;margin-top:3px;">${pu.label}</span><span style="font-size:0.4rem;color:#888;margin-top:2px;">SLOT ${i+1} · key ${i+1}</span><span style="font-size:0.43rem;color:${canAfford?'#ffaa00':'#ff4444'};margin-top:1px;">${costLabel}</span>`;
                cell.onclick=()=>{usePowerUp(i);renderInventoryShop();};
            } else {
                cell.innerHTML=`<span style="font-size:0.58rem;color:#333;">[EMPTY ${i+1}]</span>`;
            }
            slotsEl.appendChild(cell);
        }
    }

    const grid=document.getElementById('inventoryGrid');
    if (!grid) return;
    grid.innerHTML='';
    POWER_UP_DEFS.forEach(def=>{
        const canAfford=sCoins>=def.cost;
        const card=document.createElement('div');
        card.style.cssText=`width:95px;padding:9px 5px;border:2px solid ${canAfford?def.color:'#333'};border-radius:10px;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;gap:4px;cursor:${canAfford?'pointer':'not-allowed'};opacity:${canAfford?'1':'0.35'};box-shadow:${canAfford?`0 0 10px ${def.color}44`:'none'};transition:0.15s;font-family:'Courier New',monospace;text-align:center;`;
        card.innerHTML=`<span style="font-size:1.6rem;">${def.icon}</span><span style="font-size:0.44rem;color:${def.color};letter-spacing:1px;">${def.label}</span><span style="font-size:0.58rem;color:${canAfford?'#ffaa00':'#ff4444'};font-weight:bold;">${def.cost}🪙</span>`;
        if (canAfford) {
            card.onclick=()=>buyFromInventory(def.type);
            card.onmouseenter=()=>card.style.transform='scale(1.07)';
            card.onmouseleave=()=>card.style.transform='scale(1)';
        }
        grid.appendChild(card);
    });
}

function buyFromInventory(type) {
    const def=POWER_UP_DEFS.find(d=>d.type===type);
    if (!def||sCoins<def.cost) return;
    const emptySlot=puSlots.findIndex(s=>s===null);
    if (emptySlot===-1) puSlots[0]={...def,firstUse:true};
    else puSlots[emptySlot]={...def,firstUse:true};
    sCoins-=def.cost;
    sDiscoveredPowerUps.add(type);
    updateSurvivalHUD(); renderPowerUpBar(); renderInventoryShop();
    logActivity(`SHOP PURCHASE: ${def.label}`);
}

// =============================================================================
// SURVIVAL — START
// =============================================================================
function startSurvival() {
    shipImg.src=selectedShipSrc;
    ['shipMenu','gameOverScreen','survivalOverScreen'].forEach(id=>document.getElementById(id).style.display='none');
    document.querySelector('.ui-layer').style.display='none';
    ['survivalPauseMenu','survivalInventory'].forEach(id=>document.getElementById(id).style.display='none');
    document.getElementById('survivalHUD').style.display  = 'flex';
    document.getElementById('powerupBar').style.display   = 'flex';
    document.getElementById('powerupBar-label').style.display='block';

    survivalActive=true; gameActive=false; isPaused=false;
    sPlayer.x=canvas.width/2; sPlayer.y=canvas.height-100;
    sPlayer.lives=3; sPlayer.invincTimer=0;

    sBullets=[]; sEnemies=[]; sEBullets=[];
    sPowerDrops=[]; sCoinDrops=[]; sParticles=[]; sToasts=[]; sMines=[];
    // Visual state reset
    sScorePopups=[]; sWaveAnnounce={wave:0,timer:0};
    sPlayerHistory=[]; sPlayerHistFrame=0;
    sLightningArcs=[]; sScreenFlash={color:'#ffffff',alpha:0};
    sOrbitParticles=[]; sComboFlames=[]; sRingExplosions=[];
    sDangerLevel=0; sShootStars=[];

    sScore=0; sCoins=0; sWave=1; sKills=0;
    sBossActive=false; sWaveId=0; sWaveAdvancing=false; sWavePerfect=true;
    sComboStreak=0; sComboMult=1;
    sLastShot=Date.now(); sTurretLastShot=Date.now(); sLastEvadeCheck=Date.now();
    sDiscoveredPowerUps=new Set();
    puSlots=[null,null,null,null];
    Object.keys(puEffects).forEach(k=>{puEffects[k].active=false;puEffects[k].timer=0;});

    sStars.forEach(s=>{s.x=Math.random()*canvas.width;s.y=Math.random()*canvas.height;});

    updateSurvivalHUD(); renderPowerUpBar(); spawnSurvivalWave();
    logActivity(`SURVIVAL START: ${playerName}`);
    const myLoopId=++survivalLoopId;
    requestAnimationFrame(()=>survivalLoop(myLoopId));
}

// =============================================================================
// SURVIVAL — WAVE SPAWNING
// Enemy count capped at 8. Difficulty = speed + HP + type, not numbers.
//   Wave 1: 3-4 · Wave 2: 4-5 · Wave 3: 5-6 · Wave 4: 6-7 · Wave 5+: 7-8
// =============================================================================
function getWaveEnemyCount(wave) {
    return Math.min(2+wave,7) + Math.floor(Math.random()*2);
}

function spawnSurvivalWave() {
    const count=getWaveEnemyCount(sWave);
    const myWaveId=++sWaveId;
    sWaveAnnounce={wave:sWave,timer:160};
    for (let i=0;i<count;i++) {
        setTimeout(()=>{
            if (!survivalActive||sWaveId!==myWaveId) return;
            spawnSurvivalEnemy(false);
        },i*1400);
    }
}

// =============================================================================
// SURVIVAL — ENEMY TYPES
// =============================================================================
const ENEMY_TYPE_UNLOCK_WAVE={diver:2,splitter:3,shielded:4};

function pickSurvivalEnemyType(wave) {
    const pool=['grunt'];
    if (wave>=ENEMY_TYPE_UNLOCK_WAVE.diver)    pool.push('diver','diver');
    if (wave>=ENEMY_TYPE_UNLOCK_WAVE.splitter) pool.push('splitter');
    if (wave>=ENEMY_TYPE_UNLOCK_WAVE.shielded) pool.push('shielded');
    return pool[Math.floor(Math.random()*pool.length)];
}

function spawnSurvivalEnemy(isBoss,forcedType) {
    const enemyType=isBoss?'boss':(forcedType||pickSurvivalEnemyType(sWave));
    const sizeByType={grunt:36,diver:32,splitter:44,shielded:40,boss:84,mini:22};
    const w=sizeByType[enemyType]||36, h=w;
    const x=Math.random()*(canvas.width-w*2)+w;

    const speedMult={grunt:1,diver:1.35,splitter:0.75,shielded:0.85,boss:1,mini:1.5};
    const baseSpd=(isBoss?0.6:0.85+sWave*0.10)*(speedMult[enemyType]||1);
    const spd=puEffects.freezeField.active?0:puEffects.timeSlow.active?baseSpd*0.45:baseSpd;

    let hp;
    if (isBoss) hp=18+sWave*4;
    else if (enemyType==='mini') hp=1;
    else {
        const base=Math.max(1,Math.floor(1+(sWave-1)*0.6));
        hp=base+({splitter:2,shielded:1}[enemyType]||0);
    }

    const shootInt=isBoss?2200:3500+Math.random()*2500;
    const zigzagCapable=!isBoss&&enemyType!=='diver'&&enemyType!=='mini';
    const zigzagAmp=zigzagCapable?Math.max(0,(sWave-1)*0.25):0;
    const zigzagSpd=zigzagCapable?0.022+(sWave-1)*0.007+Math.random()*0.012:0;
    const colorByType={grunt:'#ff0044',diver:'#ff6a00',splitter:'#ff00aa',shielded:'#00c8ff',boss:'#bc13fe',mini:'#ff4488'};

    const enemy={
        x,y:-h/2-10,w,h,
        speed:spd,baseSpeed:baseSpd,
        isBoss,enemyType,hp,maxHp:hp,rot:0,
        lastShot:Date.now()+Math.random()*3000,
        shootInterval:shootInt,
        color:colorByType[enemyType]||'#ff0044',
        pulseT:0,zigzagAmplitude:zigzagAmp,zigzagSpeed:zigzagSpd,
        zigzagT:Math.random()*Math.PI*2,baseX:x,
        silenced:false, hitFlash:0, spawnAlpha:0,
        stunTimer:0,    // used by blackHole stun
        bossPhase:1,    // 1/2/3 for boss phase system
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
    const now=Date.now();
    const delay=puEffects.rapidFire.active?S_SHOOT_DELAY*0.38:S_SHOOT_DELAY;
    if (now-sLastShot<delay) return;
    sLastShot=now;
    if (puEffects.laserBeam.active) { triggerLaser(); return; }

    let angles=[0];
    if      (puEffects.overcharge.active) angles=[-40,-24,-8,8,24,40];
    else if (puEffects.tripleShot.active) angles=[-20,0,20];

    const bColor=puEffects.homing.active?'#66ff66':(puEffects.overcharge.active?'#ff44ff':'#00f2ff');
    const bSpd=puEffects.overcharge.active?20:14;

    angles.forEach(deg=>{
        const rad=deg*Math.PI/180;
        sBullets.push({x:sPlayer.x+Math.sin(rad)*10,y:sPlayer.y-sPlayer.h/2,vx:Math.sin(rad)*7,vy:-bSpd,r:puEffects.overcharge.active?6:4,color:bColor,trail:[],homing:puEffects.homing.active,sniper:puEffects.sniperMode.active,dir:'up',bounces:0});
        if (puEffects.dualShot.active) {
            sBullets.push({x:sPlayer.x+Math.sin(rad)*10,y:sPlayer.y+sPlayer.h/2,vx:Math.sin(rad)*7,vy:bSpd,r:4,color:'#ff88ff',trail:[],homing:false,sniper:puEffects.sniperMode.active,dir:'down',bounces:0});
        }
    });
}

function triggerLaser() {
    for (let i=sEnemies.length-1;i>=0;i--) {
        const en=sEnemies[i];
        if (Math.abs(en.x-sPlayer.x)<en.w/2+35) {
            if (en.shieldHp) en.shieldHp=0;
            en.hp=0; killSurvivalEnemy(i);
        }
    }
    sBullets.push({type:'laser',x:sPlayer.x,life:1});
}

// =============================================================================
// SURVIVAL — UPDATE
// =============================================================================
function survivalUpdate() {
    if (!survivalActive||isPaused) return;
    const now=Date.now();

    // Player movement
    const effSpd=sPlayer.speed*(puEffects.berserker.active?3:1);
    if (sKeys.left  &&sPlayer.x-sPlayer.w/2>0)                 sPlayer.x-=effSpd;
    if (sKeys.right &&sPlayer.x+sPlayer.w/2<canvas.width)       sPlayer.x+=effSpd;
    if (sKeys.up    &&sPlayer.y-sPlayer.h/2>70)                 sPlayer.y-=effSpd;
    if (sKeys.down  &&sPlayer.y+sPlayer.h/2<canvas.height-90)   sPlayer.y+=effSpd;

    if (sKeys.space) survivalShoot();

    // Auto-fire: turret and berserker
    if (puEffects.turretMode.active&&now-sTurretLastShot>S_SHOOT_DELAY*0.55) { sTurretLastShot=now; survivalShoot(); }
    if (puEffects.berserker.active &&now-sTurretLastShot>S_SHOOT_DELAY*0.25) { sTurretLastShot=now; survivalShoot(); }

    // Rapid Evade: nudge player sideways if a bullet is heading straight at us
    if (puEffects.rapidEvade.active&&now-sLastEvadeCheck>120) {
        sLastEvadeCheck=now;
        for (const b of sEBullets) {
            const dx=sPlayer.x-b.x, dy=sPlayer.y-b.y;
            const dist=Math.hypot(dx,dy);
            if (dist<90&&dist>0) {
                const dot=(b.vx*(-dx)+b.vy*(-dy))/dist;
                if (dot>2.0) {
                    // bullet heading toward us — nudge perpendicular
                    const nudge=28*(Math.random()<0.5?1:-1);
                    sPlayer.x=Math.max(sPlayer.w/2,Math.min(canvas.width-sPlayer.w/2,sPlayer.x+nudge));
                    createSurvivalParticles(sPlayer.x,sPlayer.y,'#ccffcc',false);
                    break;
                }
            }
        }
    }

    if (sPlayer.invincTimer>0) sPlayer.invincTimer--;

    // Player afterimage
    sPlayerHistFrame++;
    if (sPlayerHistFrame%3===0) {
        const tc=puEffects.berserker.active?'#ff4400':(puEffects.phaseShift.active?'#cc88ff':'#00f2ff');
        sPlayerHistory.push({x:sPlayer.x,y:sPlayer.y,alpha:0.3,color:tc});
        if (sPlayerHistory.length>6) sPlayerHistory.shift();
    }
    sPlayerHistory.forEach(h=>h.alpha-=0.05);
    for (let i=sPlayerHistory.length-1;i>=0;i--) { if(sPlayerHistory[i].alpha<=0)sPlayerHistory.splice(i,1); }

    // Wave announce timer
    if (sWaveAnnounce.timer>0) sWaveAnnounce.timer--;

    // Score popups
    for (let i=sScorePopups.length-1;i>=0;i--) {
        const p=sScorePopups[i];
        p.y+=p.vy; p.vy*=0.96; p.life-=0.022;
        if (p.life<=0) sScorePopups.splice(i,1);
    }

    // Lightning arcs, ring explosions, screen flash
    for (let i=sLightningArcs.length-1;i>=0;i--) { sLightningArcs[i].life-=0.18; if(sLightningArcs[i].life<=0)sLightningArcs.splice(i,1); }
    for (let i=sRingExplosions.length-1;i>=0;i--) { sRingExplosions[i].r+=sRingExplosions[i].expand; sRingExplosions[i].life-=0.04; if(sRingExplosions[i].life<=0)sRingExplosions.splice(i,1); }
    if (sScreenFlash.alpha>0) sScreenFlash.alpha=Math.max(0,sScreenFlash.alpha-0.04);

    // Orbit particles (shield visual)
    if (puEffects.shield.active) {
        const orbitCount=6;
        while (sOrbitParticles.length<orbitCount) {
            sOrbitParticles.push({angle:Math.random()*Math.PI*2,dist:sPlayer.w+8,speed:0.05+Math.random()*0.03,size:3+Math.random()*2,color:'#00f2ff'});
        }
        sOrbitParticles.forEach(p=>{ p.angle+=p.speed; });
    } else {
        sOrbitParticles=[];
    }

    // Combo flames at high streaks
    if (sComboStreak>=18) {
        for (let i=0;i<2;i++) {
            sComboFlames.push({
                x:sPlayer.x+(Math.random()-0.5)*sPlayer.w*0.6,
                y:sPlayer.y+sPlayer.h/2+Math.random()*8,
                vx:(Math.random()-0.5)*1.5, vy:-(Math.random()*2+1),
                life:1.0, size:Math.random()*5+3,
                color:sComboMult>=3?'#ff4400':(sComboMult>=2?'#ff8800':'#ffaa00'),
            });
        }
    }
    for (let i=sComboFlames.length-1;i>=0;i--) {
        const f=sComboFlames[i];
        f.x+=f.vx; f.y+=f.vy; f.life-=0.055; f.size*=0.97;
        if (f.life<=0) sComboFlames.splice(i,1);
    }

    // Shooting stars (rare background event)
    if (Math.random()<0.0015&&sShootStars.length<2) {
        const sy=Math.random()*canvas.height*0.6;
        sShootStars.push({x:-10,y:sy,vx:canvas.width*0.012,vy:Math.random()*0.8-0.4,life:1.0,length:Math.random()*120+60});
    }
    for (let i=sShootStars.length-1;i>=0;i--) {
        const ss=sShootStars[i];
        ss.x+=ss.vx; ss.y+=ss.vy; ss.life-=0.018;
        if (ss.x>canvas.width+200||ss.life<=0) sShootStars.splice(i,1);
    }

    // Asteroids drift
    sAsteroids.forEach(a=>{
        a.x+=a.vx; a.y+=a.vy; a.rot+=a.rotSpd;
        if (a.y>canvas.height+60) { a.y=-60; a.x=Math.random()*canvas.width; }
        if (a.x>canvas.width+60)  { a.x=-60; a.y=Math.random()*canvas.height; }
        if (a.x<-60)              { a.x=canvas.width+60; }
    });

    // Danger level: fraction of enemy proximity to player
    sDangerLevel=0;
    sEnemies.forEach(en=>{
        const d=Math.hypot(en.x-sPlayer.x,en.y-sPlayer.y);
        sDangerLevel+=Math.max(0,1-d/320);
    });
    sDangerLevel=Math.min(1,sDangerLevel*0.35);

    // Tick power-up timers
    Object.keys(puEffects).forEach(k=>{
        if (puEffects[k].active&&puEffects[k].timer>0) {
            puEffects[k].timer-=16;
            if (puEffects[k].timer<=0) { puEffects[k].active=false; puEffects[k].timer=0; }
        }
    });

    sEnemies.forEach(en=>{ en.silenced=puEffects.empBlast.active; });

    if (puEffects.coinMagnet.active) {
        sCoinDrops.forEach(c=>{ const dx=sPlayer.x-c.x,dy=sPlayer.y-c.y,dist=Math.hypot(dx,dy)||1; c.x+=(dx/dist)*10; c.y+=(dy/dist)*10; });
    }

    // ── Player bullets ────────────────────────────────────────────────────────
    for (let i=sBullets.length-1;i>=0;i--) {
        const b=sBullets[i];
        if (b.type==='laser') { b.life-=0.15; if(b.life<=0)sBullets.splice(i,1); continue; }
        b.trail.push({x:b.x,y:b.y});
        if (b.trail.length>8) b.trail.shift();

        if (b.homing&&b.dir!=='down'&&sEnemies.length>0) {
            let nearest=null,nearestDist=Infinity;
            for (const en of sEnemies) { const d=Math.hypot(en.x-b.x,en.y-b.y); if(d<nearestDist){nearestDist=d;nearest=en;} }
            if (nearest) {
                const dx=nearest.x-b.x,dy=nearest.y-b.y,dist=Math.hypot(dx,dy)||1;
                const spd=Math.hypot(b.vx,b.vy);
                b.vx+=(dx/dist*spd-b.vx)*0.18; b.vy+=(dy/dist*spd-b.vy)*0.18;
            }
        }

        b.x+=b.vx; b.y+=b.vy;

        if (puEffects.ricochets.active) {
            if ((b.x<=0||b.x>=canvas.width)&&(b.bounces||0)<3) {
                b.vx=-b.vx; b.x=Math.max(1,Math.min(canvas.width-1,b.x));
                b.bounces=(b.bounces||0)+1;
            }
        }

        if (b.y<-20||b.y>canvas.height+20||b.x<-20||b.x>canvas.width+20) { sBullets.splice(i,1); continue; }

        let hit=false;
        for (let j=sEnemies.length-1;j>=0;j--) {
            const en=sEnemies[j];
            if (b.x>en.x-en.w/2&&b.x<en.x+en.w/2&&b.y>en.y-en.h/2&&b.y<en.y+en.h/2) {
                const dmg=b.sniper?9999:1;
                if (b.sniper&&en.shieldHp) en.shieldHp=0;
                applyDamageToEnemy(en,j,dmg);
                if (puEffects.chainLightning.active) {
                    let chained=0;
                    for (let k=sEnemies.length-1;k>=0&&chained<2;k--) {
                        if (k===j) continue;
                        const ce=sEnemies[k];
                        if (Math.hypot(ce.x-en.x,ce.y-en.y)<140) {
                            createSurvivalParticles(ce.x,ce.y,'#aaff00',false);
                            applyDamageToEnemy(ce,k,1);
                            sLightningArcs.push({x1:en.x,y1:en.y,x2:ce.x,y2:ce.y,life:1.0});
                            chained++;
                        }
                    }
                }
                hit=true; break;
            }
        }
        if (hit) sBullets.splice(i,1);
    }

    // ── Mines ─────────────────────────────────────────────────────────────────
    for (let i=sMines.length-1;i>=0;i--) {
        const m=sMines[i];
        m.pulseT=(m.pulseT||0)+0.1;
        for (let j=sEnemies.length-1;j>=0;j--) {
            const en=sEnemies[j];
            if (Math.hypot(en.x-m.x,en.y-m.y)<en.w/2+m.r) {
                createSurvivalParticles(m.x,m.y,'#ff9900',true);
                sRingExplosions.push({x:m.x,y:m.y,r:20,expand:6,life:1.0,color:'#ff9900'});
                for (let k=sEnemies.length-1;k>=0;k--) {
                    if (Math.hypot(sEnemies[k].x-m.x,sEnemies[k].y-m.y)<100) applyDamageToEnemy(sEnemies[k],k,3);
                }
                shakeAmt=8; sMines.splice(i,1); break;
            }
        }
    }

    // ── Enemies ───────────────────────────────────────────────────────────────
    for (let i=sEnemies.length-1;i>=0;i--) {
        const en=sEnemies[i];

        if (en.spawnAlpha<1) en.spawnAlpha=Math.min(1,en.spawnAlpha+0.07);
        if (en.hitFlash>0)   en.hitFlash=Math.max(0,en.hitFlash-1);
        if (en.stunTimer>0)  { en.stunTimer--; continue; } // stunned by blackHole

        if (puEffects.freezeField.active) en.speed=0;
        else en.speed=puEffects.timeSlow.active?en.baseSpeed*0.45:en.baseSpeed;

        // Boss phase system
        if (en.isBoss) {
            const hpPct=en.hp/en.maxHp;
            if (hpPct<0.33&&en.bossPhase<3) {
                en.bossPhase=3; en.speed*=1.5;
                en.shootInterval=Math.max(900,en.shootInterval*0.55);
                showSurvivalToast('⚠ BOSS BERSERK!','#ff0000');
                sScreenFlash={color:'#ff0000',alpha:0.35};
            } else if (hpPct<0.66&&en.bossPhase<2) {
                en.bossPhase=2; en.speed*=1.2;
                en.shootInterval=Math.max(1400,en.shootInterval*0.7);
                showSurvivalToast('BOSS ENRAGED','#ff8800');
            }
        }

        if (en.enemyType==='diver') {
            if (en.diverState==='falling') {
                en.y+=en.speed;
                if (en.y>=en.diverTriggerY) {
                    en.diverState='dashing';
                    const dx=sPlayer.x-en.x,dy=sPlayer.y-en.y,dist=Math.hypot(dx,dy)||1;
                    const ds=en.baseSpeed*3.2; en.dashVx=(dx/dist)*ds; en.dashVy=(dy/dist)*ds;
                }
            } else {
                en.x+=en.dashVx*(puEffects.freezeField.active?0:1);
                en.y+=en.dashVy*(puEffects.freezeField.active?0:1);
            }
        } else {
            if (en.zigzagAmplitude>0&&!puEffects.freezeField.active) {
                en.zigzagT+=en.zigzagSpeed;
                en.x=en.baseX+Math.sin(en.zigzagT)*en.zigzagAmplitude*60;
                en.x=Math.max(en.w/2,Math.min(canvas.width-en.w/2,en.x));
            }
            en.y+=en.speed;
        }

        if (en.enemyType==='shielded'&&en.shieldBroken&&en.shieldRegenAt&&Date.now()>en.shieldRegenAt&&en.shieldHp<en.shieldMaxHp) {
            en.shieldHp=Math.min(en.shieldMaxHp,en.shieldHp+0.02);
            if (en.shieldHp>=en.shieldMaxHp) en.shieldBroken=false;
        }
        if (en.enemyType==='shielded') en.shieldRot+=0.05;
        en.rot+=0.025; en.pulseT=(en.pulseT||0)+0.08;

        const offBottom=en.y>canvas.height+en.h;
        const offSide  =en.x<-en.w*2||en.x>canvas.width+en.w*2;
        if (offBottom||(en.enemyType==='diver'&&en.diverState==='dashing'&&offSide)) {
            sEnemies.splice(i,1);
            if (offBottom) resetSurvivalCombo(); // no life lost
            continue;
        }

        if (!en.silenced&&now-en.lastShot>en.shootInterval&&en.enemyType!=='diver'&&en.enemyType!=='mini') {
            en.lastShot=now; fireEnemyBullet(en);
        }

        if (sPlayer.invincTimer===0&&
            Math.abs(en.x-sPlayer.x)<(en.w+sPlayer.w)/2*0.75&&
            Math.abs(en.y-sPlayer.y)<(en.h+sPlayer.h)/2*0.75) {
            createSurvivalParticles(en.x,en.y,en.color,en.isBoss);
            sEnemies.splice(i,1);
            if (puEffects.shield.active) { puEffects.shield.active=false; createSurvivalParticles(sPlayer.x,sPlayer.y,'#00f2ff',false); }
            else survivalTakeDamage();
        }
    }

    // ── Enemy bullets ─────────────────────────────────────────────────────────
    for (let i=sEBullets.length-1;i>=0;i--) {
        const b=sEBullets[i];
        b.x+=b.vx; b.y+=b.vy;

        // Bullet wall: destroy bullets near player
        if (puEffects.bulletWall.active&&Math.hypot(b.x-sPlayer.x,b.y-sPlayer.y)<90) {
            createSurvivalParticles(b.x,b.y,'#4488ff',false);
            sEBullets.splice(i,1); continue;
        }
        // Reflector: reverse bullet direction, now damages enemies
        if (puEffects.reflector.active&&Math.hypot(b.x-sPlayer.x,b.y-sPlayer.y)<70) {
            b.vx=-b.vx*1.2; b.vy=-b.vy*1.2;
            b.color='#88ffff'; b.reflected=true;
            createSurvivalParticles(b.x,b.y,'#88ffff',false); continue;
        }
        // If bullet was reflected, check enemy collision
        if (b.reflected) {
            let hitEnemy=false;
            for (let j=sEnemies.length-1;j>=0;j--) {
                const en=sEnemies[j];
                if (b.x>en.x-en.w/2&&b.x<en.x+en.w/2&&b.y>en.y-en.h/2&&b.y<en.y+en.h/2) {
                    applyDamageToEnemy(en,j,2);
                    sEBullets.splice(i,1); hitEnemy=true; break;
                }
            }
            if (!hitEnemy&&(b.y>canvas.height+10||b.y<-10||b.x<-10||b.x>canvas.width+10)) sEBullets.splice(i,1);
            continue;
        }

        if (b.y>canvas.height+10||b.y<-10||b.x<-10||b.x>canvas.width+10) { sEBullets.splice(i,1); continue; }

        if (sPlayer.invincTimer===0&&
            b.x>sPlayer.x-sPlayer.w/2&&b.x<sPlayer.x+sPlayer.w/2&&
            b.y>sPlayer.y-sPlayer.h/2&&b.y<sPlayer.y+sPlayer.h/2) {
            sEBullets.splice(i,1);
            if (puEffects.shield.active) { puEffects.shield.active=false; createSurvivalParticles(sPlayer.x,sPlayer.y,'#00f2ff',false); }
            else survivalTakeDamage();
        }
    }

    // ── Power-up drops ────────────────────────────────────────────────────────
    for (let i=sPowerDrops.length-1;i>=0;i--) {
        const d=sPowerDrops[i];
        d.y+=1.6; d.rot=(d.rot||0)+0.04;
        if (d.y>canvas.height+30) { sPowerDrops.splice(i,1); continue; }
        if (Math.abs(d.x-sPlayer.x)<34&&Math.abs(d.y-sPlayer.y)<34) {
            sDiscoveredPowerUps.add(d.pu.type); addToInventory(d.pu); sPowerDrops.splice(i,1);
        }
    }

    // ── Coin drops ────────────────────────────────────────────────────────────
    for (let i=sCoinDrops.length-1;i>=0;i--) {
        const c=sCoinDrops[i];
        c.y+=1.4; c.rot=(c.rot||0)+0.09;
        if (c.y>canvas.height+20) { sCoinDrops.splice(i,1); continue; }
        if (Math.abs(c.x-sPlayer.x)<30&&Math.abs(c.y-sPlayer.y)<30) {
            sCoins++; sCoinDrops.splice(i,1);
            createSurvivalParticles(c.x,c.y,'#ffaa00',false);
            sScorePopups.push({x:c.x,y:c.y-10,text:'+1🪙',color:'#ffaa00',vy:-1.8,life:1.0});
            updateSurvivalHUD(); renderPowerUpBar();
        }
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    for (let i=sParticles.length-1;i>=0;i--) {
        const p=sParticles[i]; p.x+=p.vx; p.y+=p.vy; p.life-=0.018;
        if (p.life<=0) sParticles.splice(i,1);
    }

    // ── Stars scroll ──────────────────────────────────────────────────────────
    sStars.forEach(s=>{ s.y+=s.spd; if(s.y>canvas.height){s.y=-s.r;s.x=Math.random()*canvas.width;} });

    // Score
    const scoreRate=puEffects.scoreRain.active?0.125:(puEffects.scoreBoost.active?0.05:0.025);
    sScore+=scoreRate;

    // ── Wave clear ────────────────────────────────────────────────────────────
    if (!sBossActive&&sEnemies.length===0&&!sWaveAdvancing) {
        sWaveAdvancing=true;
        showSurvivalToast(`WAVE ${sWave} CLEAR`,'#00f2ff');
        sScreenFlash={color:'#00f2ff',alpha:0.22};
        sRingExplosions.push({x:canvas.width/2,y:canvas.height/2,r:10,expand:12,life:1.0,color:'#00f2ff'});
        // Perfect wave bonus: no damage taken = +3 coins
        if (sWavePerfect) {
            sCoins+=3;
            showSurvivalToast('PERFECT WAVE! +3🪙','#ffd700');
            sScreenFlash={color:'#ffd700',alpha:0.18};
        }
        sWave++; sKills=0; sWaveId++; sWavePerfect=true;
        updateSurvivalHUD();
        setTimeout(()=>{ sWaveAdvancing=false; if(survivalActive)spawnSurvivalWave(); },2200);
    }
    updateSurvivalHUD();
}

// =============================================================================
// SURVIVAL — ENEMY BULLET FIRE
// =============================================================================
function fireEnemyBullet(en) {
    const spd=en.isBoss?3.0:2.0;
    if (en.isBoss) {
        en.bossAttackIndex=((en.bossAttackIndex||0)+1)%3;
        const pattern=['spread','circle','volley'][en.bossAttackIndex];
        // Phase 3 bosses fire two patterns per trigger
        const patterns=en.bossPhase>=3?[pattern,(en.bossAttackIndex+1)%3==='circle'?'spread':'circle']:[pattern];
        patterns.forEach(pat=>{
            if (pat==='spread') {
                [-0.35,0,0.35].forEach(off=>{ sEBullets.push({x:en.x,y:en.y+en.h/2,vx:off*spd*2+(Math.random()-0.5)*0.5,vy:spd,r:6,color:'#ff00ff'}); });
            } else if (pat==='circle') {
                const n=en.bossPhase>=3?14:10;
                for (let s=0;s<n;s++) { const a=(s/n)*Math.PI*2; sEBullets.push({x:en.x,y:en.y,vx:Math.cos(a)*spd*0.85,vy:Math.sin(a)*spd*0.85,r:5,color:'#ff66ff'}); }
            } else {
                const dx=sPlayer.x-en.x,dy=sPlayer.y-en.y,dist=Math.hypot(dx,dy)||1;
                for (let s=-1;s<=1;s++) { sEBullets.push({x:en.x,y:en.y+en.h/2,vx:(dx/dist)*spd*1.4+s*0.6,vy:(dy/dist)*spd*1.4,r:5,color:'#ff0066'}); }
            }
        });
    } else {
        const leanX=(sPlayer.x-en.x)/canvas.width*1.5;
        sEBullets.push({x:en.x,y:en.y+en.h/2,vx:leanX+(Math.random()-0.5)*2.8,vy:spd,r:4,color:'#ff6600'});
    }
}

// =============================================================================
// SURVIVAL — COMBO / MULTIPLIER
// =============================================================================
function registerSurvivalKill(ex,ey) {
    sComboStreak++;
    if (sComboStreak%10===0) {
        sCoinDrops.push({x:ex||sPlayer.x,y:ey||sPlayer.y-40,rot:0});
        showSurvivalToast(`${sComboStreak} KILL STREAK! +1🪙`,'#ffaa00');
    }
    const prev=sComboMult;
    for (let i=COMBO_THRESHOLDS.length-1;i>=0;i--) {
        if (sComboStreak>=COMBO_THRESHOLDS[i].streak){sComboMult=COMBO_THRESHOLDS[i].mult;break;}
    }
    if (sComboMult>prev) { showSurvivalToast(`COMBO x${sComboMult}!`,'#ffaa00'); sScreenFlash={color:'#ffaa00',alpha:0.15}; }
    return sComboMult;
}

function resetSurvivalCombo() {
    if (sComboStreak>=8) showSurvivalToast('COMBO BROKEN','#ff0044');
    sComboStreak=0; sComboMult=1;
}

// =============================================================================
// SURVIVAL — TOASTS
// =============================================================================
function showSurvivalToast(text,color) {
    sToasts.push({text,color,life:1.0,y:0});
    if (sToasts.length>5) sToasts.shift();
}

// =============================================================================
// SURVIVAL — DAMAGE
// =============================================================================
function applyDamageToEnemy(en,idx,amount) {
    if (en.shieldHp&&en.shieldHp>0) {
        en.shieldHp-=amount; en.shieldRegenAt=Date.now()+4000; en.hitFlash=6;
        if (en.shieldHp<=0){en.shieldHp=0;en.shieldBroken=true;createSurvivalParticles(en.x,en.y,'#00c8ff',false);}
        return;
    }
    en.hp-=amount;
    en.hitFlash=Math.min(12,(en.hitFlash||0)+8);
    if (en.hp<=0) killSurvivalEnemy(idx);
}

// =============================================================================
// SURVIVAL — KILL ENEMY
// =============================================================================
function killSurvivalEnemy(idx) {
    const en=sEnemies[idx];
    createSurvivalParticles(en.x,en.y,en.color,en.isBoss);
    const comboMult=registerSurvivalKill(en.x,en.y);
    const boostMult=(puEffects.scoreBoost.active||puEffects.scoreRain.active)?2:1;
    const baseScore=en.isBoss?500:(en.enemyType==='mini'?40:100);
    const total=Math.round(baseScore*comboMult*boostMult);
    sScore+=total; sKills++;

    // Score popup
    const popColor=en.isBoss?'#bc13fe':(comboMult>1?'#ffaa00':'#00f2ff');
    sScorePopups.push({x:en.x,y:en.y-20,text:`+${total}`,color:popColor,vy:-1.6,life:1.0});

    if (puEffects.lifeSteal.active&&Math.random()<0.20) sCoinDrops.push({x:en.x+(Math.random()-0.5)*30,y:en.y,rot:0});
    if (puEffects.goldRush.active&&!en.isBoss)          sCoinDrops.push({x:en.x+(Math.random()-0.5)*20,y:en.y,rot:0});

    if (en.isBoss) {
        sCoinDrops.push({x:en.x,y:en.y,rot:0});
        sBossActive=false; shakeAmt=22;
        sScreenFlash={color:'#bc13fe',alpha:0.3};
        sRingExplosions.push({x:en.x,y:en.y,r:10,expand:9,life:1.0,color:'#bc13fe'});
        showSurvivalToast('BOSS DESTROYED','#bc13fe');
        logActivity(`SURVIVAL BOSS KILLED - WAVE: ${sWave}`);
    } else {
        if (en.enemyType==='splitter') {
            for (let s=0;s<2;s++) {
                const mini=spawnSurvivalEnemy(false,'mini');
                if (mini){mini.x=en.x+(s===0?-24:24);mini.y=en.y;mini.baseX=mini.x;}
            }
        }
        // Power-up drop: chance decreases the further you go.
        // Wave 1 = 60%, Wave 5 = 32%, Wave 8 = 11%, Wave 9+ = min 5%.
        const puDropChance = Math.max(0.05, 0.60 - (sWave - 1) * 0.07);
        if (Math.random() < puDropChance) dropPowerUp(en.x, en.y);

        // Coin drop: 60% chance on every regular enemy kill, any wave.
        // goldRush and lifeSteal power-ups stack on top of this separately.
        if (Math.random() < 0.60) sCoinDrops.push({x:en.x+(Math.random()-0.5)*24,y:en.y,rot:0});

        if (sKills>0&&sKills%KILLS_PER_BOSS===0&&!sBossActive) {
            sBossActive=true;
            showSurvivalToast('⚠ BOSS INCOMING','#ff0044');
            sScreenFlash={color:'#ff0044',alpha:0.18};
            setTimeout(()=>{ if(survivalActive)spawnSurvivalEnemy(true); },800);
            logActivity(`SURVIVAL BOSS INCOMING - WAVE: ${sWave}`);
        }
    }
    sEnemies.splice(idx,1);
    updateSurvivalHUD();
}

function dropPowerUp(x,y) {
    const def=POWER_UP_DEFS[Math.floor(Math.random()*POWER_UP_DEFS.length)];
    sPowerDrops.push({x,y,rot:0,pu:{...def,firstUse:true}});
}

// =============================================================================
// SURVIVAL — TAKE DAMAGE
// =============================================================================
function survivalTakeDamage() {
    if (sPlayer.invincTimer>0) return;
    if (puEffects.phaseShift.active) return;

    // Last Stand: survive at 1 life if you would die
    if (sPlayer.lives<=1&&puEffects.lastStand.active) {
        puEffects.lastStand.active=false;
        sPlayer.invincTimer=220;
        showSurvivalToast('LAST STAND TRIGGERED!','#ff0000');
        sScreenFlash={color:'#ff0000',alpha:0.5};
        shakeAmt=20; return;
    }

    sWavePerfect=false; // damaged this wave — no bonus
    sPlayer.lives--;
    sPlayer.invincTimer=110; shakeAmt=14;
    sScreenFlash={color:'#ff0000',alpha:0.32};
    resetSurvivalCombo();
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

    ['survivalHUD','powerupBar','powerupBar-label','survivalPauseMenu','survivalInventory'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.style.display='none';
    });
    document.getElementById('powerupBar-label').style.display='none';
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
    for (let i=0;i<4;i++){if(!puSlots[i]){puSlots[i]={...pu};renderPowerUpBar();return;}}
    puSlots[0]={...pu}; renderPowerUpBar();
}

function usePowerUp(idx) {
    const pu=puSlots[idx]; if(!pu) return;
    if (!pu.firstUse){if(sCoins<pu.cost)return;sCoins-=pu.cost;}
    pu.firstUse=false;
    activatePowerUp(pu);
    const instantTypes=['bombBlast','shield','laserBeam','extraLife','waveBlast','freezeField','empBlast','mineField','blackHole','lastStand'];
    if (instantTypes.includes(pu.type)) puSlots[idx]=null;
    renderPowerUpBar(); updateSurvivalHUD();
    logActivity(`POWER-UP USED: ${pu.label}`);
}

function activatePowerUp(pu) {
    const flash=(c,a)=>{ sScreenFlash={color:c,alpha:a}; };
    switch(pu.type) {
        case 'bombBlast':
            sEBullets=[];
            for (let i=sEnemies.length-1;i>=0;i--) {
                if (!sEnemies[i].isBoss){createSurvivalParticles(sEnemies[i].x,sEnemies[i].y,sEnemies[i].color,false);sEnemies.splice(i,1);}
                else{sEnemies[i].shieldHp=0;sEnemies[i].hp-=5;if(sEnemies[i].hp<=0)killSurvivalEnemy(i);}
            }
            shakeAmt=20; flash('#ff8800',0.3);
            sRingExplosions.push({x:sPlayer.x,y:sPlayer.y,r:10,expand:14,life:1.0,color:'#ff8800'}); return;
        case 'shield':          puEffects.shield.active=true; return;
        case 'extraLife':       sPlayer.lives++; showSurvivalToast('+1 LIFE','#ff3366'); flash('#ff3366',0.2); createSurvivalParticles(sPlayer.x,sPlayer.y,'#ff3366',false); return;
        case 'waveBlast':       sEBullets=[]; showSurvivalToast('BULLETS CLEARED!','#00ccff'); flash('#00ccff',0.2); shakeAmt=8; return;
        case 'freezeField':     puEffects.freezeField.active=true; puEffects.freezeField.timer=pu.duration; showSurvivalToast('FIELD FROZEN!','#aaddff'); flash('#aaddff',0.15); return;
        case 'empBlast':        puEffects.empBlast.active=true;    puEffects.empBlast.timer=pu.duration;    showSurvivalToast('ENEMIES SILENCED!','#ffcc00'); flash('#ffcc00',0.15); return;
        case 'phaseShift':      puEffects.phaseShift.active=true;  puEffects.phaseShift.timer=pu.duration;  showSurvivalToast('PHASE SHIFT!','#cc88ff'); flash('#cc88ff',0.18); return;
        case 'goldRush':        puEffects.goldRush.active=true;    puEffects.goldRush.timer=pu.duration;    showSurvivalToast('GOLD RUSH!','#ffd700'); flash('#ffd700',0.15); return;
        case 'berserker':       puEffects.berserker.active=true;   puEffects.berserker.timer=pu.duration;   showSurvivalToast('BERSERKER!','#ff4400'); flash('#ff4400',0.25); return;
        case 'mineField':
            for (let m=0;m<6;m++) sMines.push({x:Math.random()*(canvas.width-120)+60,y:Math.random()*(canvas.height*0.65)+80,r:18,pulseT:Math.random()*Math.PI*2});
            showSurvivalToast('6 MINES DEPLOYED!','#ff9900'); return;
        case 'scoreRain':       puEffects.scoreRain.active=true;   puEffects.scoreRain.timer=pu.duration;   showSurvivalToast('SCORE RAIN! 5× PASSIVE','#ffffaa'); flash('#ffffaa',0.12); return;
        case 'rapidEvade':      puEffects.rapidEvade.active=true;  puEffects.rapidEvade.timer=pu.duration;  showSurvivalToast('AUTO EVADE ON!','#ccffcc'); return;
        case 'reflector':       puEffects.reflector.active=true;   puEffects.reflector.timer=pu.duration;   showSurvivalToast('REFLECTOR ACTIVE!','#88ffff'); return;
        // BLACK HOLE: suck all enemies to center, stun them 90 frames
        case 'blackHole':
            createSurvivalParticles(canvas.width/2,canvas.height/2,'#8800ff',true);
            sRingExplosions.push({x:canvas.width/2,y:canvas.height/2,r:10,expand:18,life:1.0,color:'#8800ff'});
            sEnemies.forEach(en=>{ en.x=canvas.width/2+(Math.random()-0.5)*80; en.y=canvas.height/2+(Math.random()-0.5)*80; en.stunTimer=90; en.hitFlash=12; });
            shakeAmt=25; flash('#8800ff',0.3);
            showSurvivalToast('BLACK HOLE! ALL STUNNED','#8800ff'); return;
        // LAST STAND: arm the one-time death prevention
        case 'lastStand':
            puEffects.lastStand.active=true;
            showSurvivalToast('LAST STAND ARMED ⚰️','#ff0000'); flash('#ff0000',0.2); return;
        default:
            if (puEffects[pu.type]) { puEffects[pu.type].active=true; puEffects[pu.type].timer=pu.duration; }
    }
}

// =============================================================================
// SURVIVAL — RENDER POWER-UP BAR
// =============================================================================
function renderPowerUpBar() {
    const bar=document.getElementById('powerupBar');
    bar.innerHTML='';
    for (let i=0;i<4;i++) {
        const pu=puSlots[i];
        // Warn if timed power-up is about to expire (timer < 20% left)
        const expiring=pu&&!pu.firstUse&&puEffects[pu.type]&&puEffects[pu.type].active&&puEffects[pu.type].timer<(pu.duration*0.2);
        const slot=document.createElement('div');
        slot.style.cssText=`width:64px;height:64px;border:2px solid ${pu?pu.color:'#333'};border-radius:8px;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;position:relative;transition:0.15s;font-family:'Courier New',monospace;opacity:${pu?(pu.firstUse||sCoins>=pu.cost?'1':'0.4'):'0.3'};box-shadow:${pu?`0 0 ${expiring?'18':'10'}px ${pu.color}${expiring?'ff':'55'}`:'none'};pointer-events:auto;user-select:none;`;
        if (pu) {
            const costLabel=pu.firstUse?'FREE':`${pu.cost}🪙`;
            const canAfford=pu.firstUse||sCoins>=pu.cost;
            slot.innerHTML=`<span style="font-size:1.4rem;">${pu.icon}</span><span style="font-size:0.5rem;color:${pu.color};letter-spacing:1px;">${pu.label}</span><span style="position:absolute;bottom:3px;right:5px;font-size:0.5rem;color:${pu.firstUse?'#00f2ff':(canAfford?'#ffaa00':'#ff0044')};">${costLabel}</span><span style="position:absolute;top:2px;left:5px;font-size:0.55rem;color:#555;">${i+1}</span>`;
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
    const now=Date.now();

    // ── Background: space + wave-tinted nebula ────────────────────────────────
    ctx.fillStyle='#00010a';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    const waveHue=(sWave*43)%360;
    const neb=ctx.createRadialGradient(canvas.width*0.5,canvas.height*0.4,0,canvas.width*0.5,canvas.height*0.4,canvas.width*0.75);
    neb.addColorStop(0,`hsla(${waveHue},55%,5%,1)`);
    neb.addColorStop(0.55,`hsla(${waveHue},45%,3%,1)`);
    neb.addColorStop(1,'#00010a');
    ctx.fillStyle=neb;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Danger tint: subtle red glow when enemies are close
    if (sDangerLevel>0.05) {
        const dang=ctx.createRadialGradient(sPlayer.x,sPlayer.y,50,sPlayer.x,sPlayer.y,350);
        dang.addColorStop(0,'transparent');
        dang.addColorStop(1,`rgba(255,0,0,${sDangerLevel*0.14})`);
        ctx.fillStyle=dang;
        ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    // ── Stars (3-layer parallax with twinkle) ─────────────────────────────────
    sStars.forEach(s=>{
        const twinkle=s.bright+Math.sin(now*0.001*s.twinkleSpd+s.twinkleOff)*0.08;
        ctx.save();
        ctx.globalAlpha=Math.max(0.05,twinkle);
        if (s.layer===3){ctx.shadowColor='#ffffff';ctx.shadowBlur=3;}
        ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
        ctx.restore();
    });

    // ── Shooting stars ────────────────────────────────────────────────────────
    sShootStars.forEach(ss=>{
        ctx.save();
        ctx.globalAlpha=ss.life*0.8;
        const grad=ctx.createLinearGradient(ss.x-ss.length,ss.y,ss.x,ss.y);
        grad.addColorStop(0,'transparent'); grad.addColorStop(1,'#ffffff');
        ctx.strokeStyle=grad; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(ss.x-ss.length,ss.y); ctx.lineTo(ss.x,ss.y); ctx.stroke();
        ctx.restore();
    });

    // ── Decorative asteroids ──────────────────────────────────────────────────
    sAsteroids.forEach(a=>{
        ctx.save();
        ctx.translate(a.x,a.y); ctx.rotate(a.rot);
        ctx.globalAlpha=a.alpha;
        ctx.fillStyle='#887766'; ctx.strokeStyle='#665544'; ctx.lineWidth=1;
        ctx.beginPath();
        const sides=7, jag=a.r*0.22;
        for (let s=0;s<sides;s++) {
            const ang=(s/sides)*Math.PI*2;
            const r2=a.r+(Math.sin(s*1.7+a.rot*3)*jag);
            s===0?ctx.moveTo(Math.cos(ang)*r2,Math.sin(ang)*r2):ctx.lineTo(Math.cos(ang)*r2,Math.sin(ang)*r2);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    });

    ctx.save();
    if (shakeAmt>0.1){ctx.translate((Math.random()-0.5)*shakeAmt,(Math.random()-0.5)*shakeAmt);shakeAmt*=0.85;}

    // ── Power-up edge auras ───────────────────────────────────────────────────
    const edgeAura=(color,alpha)=>{
        const eg=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.height*0.35,canvas.width/2,canvas.height/2,canvas.width*0.85);
        eg.addColorStop(0,'transparent'); eg.addColorStop(1,`${color}${Math.round(alpha*255).toString(16).padStart(2,'0')}`);
        ctx.save(); ctx.fillStyle=eg; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
    };
    if (puEffects.berserker.active)      edgeAura('#ff4400',0.22+Math.sin(now/120)*0.08);
    if (puEffects.phaseShift.active)     edgeAura('#cc88ff',0.18+Math.sin(now/90)*0.06);
    if (puEffects.goldRush.active)       edgeAura('#ffd700',0.14+Math.sin(now/200)*0.05);
    if (puEffects.freezeField.active)    edgeAura('#aaddff',0.15);
    if (puEffects.chainLightning.active) edgeAura('#aaff00',0.12+Math.sin(now/80)*0.06);
    if (puEffects.scoreRain.active)      edgeAura('#ffffaa',0.10+Math.sin(now/150)*0.04);
    if (puEffects.reflector.active)      edgeAura('#88ffff',0.13+Math.sin(now/100)*0.05);
    if (puEffects.lastStand.active)      edgeAura('#ff0000',0.08+Math.sin(now/60)*0.06);
    if (puEffects.rapidEvade.active)     edgeAura('#ccffcc',0.10);

    // ── Screen flash ──────────────────────────────────────────────────────────
    if (sScreenFlash.alpha>0){
        ctx.save(); ctx.globalAlpha=sScreenFlash.alpha; ctx.fillStyle=sScreenFlash.color;
        ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
    }

    // Particles
    sParticles.forEach(p=>{ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);});
    ctx.globalAlpha=1;

    // ── Ring explosions ───────────────────────────────────────────────────────
    sRingExplosions.forEach(ring=>{
        ctx.save();
        ctx.globalAlpha=ring.life*0.7;
        ctx.strokeStyle=ring.color; ctx.lineWidth=3; ctx.shadowColor=ring.color; ctx.shadowBlur=18;
        ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.r,0,Math.PI*2); ctx.stroke();
        ctx.restore();
    });

    // Bullet wall ring
    if (puEffects.bulletWall.active){
        ctx.save(); ctx.strokeStyle='#4488ff'; ctx.lineWidth=2; ctx.shadowColor='#4488ff'; ctx.shadowBlur=16;
        ctx.globalAlpha=0.3+Math.sin(now/120)*0.15;
        ctx.beginPath(); ctx.arc(sPlayer.x,sPlayer.y,90,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
    // Reflector ring
    if (puEffects.reflector.active){
        ctx.save(); ctx.strokeStyle='#88ffff'; ctx.lineWidth=2.5; ctx.shadowColor='#88ffff'; ctx.shadowBlur=20;
        ctx.globalAlpha=0.4+Math.sin(now/80)*0.2;
        ctx.beginPath(); ctx.arc(sPlayer.x,sPlayer.y,70,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }

    // Mines
    sMines.forEach(m=>{
        m.pulseT+=0.08;
        ctx.save(); ctx.translate(m.x,m.y);
        ctx.shadowColor='#ff9900'; ctx.shadowBlur=12+Math.sin(m.pulseT)*5;
        ctx.fillStyle='#ff9900'; ctx.strokeStyle='#ffcc00'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(0,0,m.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#000'; ctx.font=`bold ${m.r}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',0,1);
        ctx.restore();
    });

    // Coins
    sCoinDrops.forEach(c=>{
        ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
        ctx.shadowColor='#ffaa00'; ctx.shadowBlur=18+Math.sin(now/200)*6; ctx.fillStyle='#ffcc00';
        ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ffee88'; ctx.globalAlpha=0.6; ctx.beginPath(); ctx.arc(-3,-3,4,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
        ctx.fillStyle='#7a4400'; ctx.font='bold 10px Courier New'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('¢',0,1);
        ctx.restore();
    });

    // Power-up drops
    sPowerDrops.forEach(d=>{
        ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(d.rot);
        ctx.shadowColor=d.pu.color; ctx.shadowBlur=22+Math.sin(now/200)*10;
        ctx.strokeStyle=d.pu.color; ctx.lineWidth=2; ctx.strokeRect(-18,-18,36,36);
        ctx.fillStyle=d.pu.color+'22'; ctx.fillRect(-18,-18,36,36);
        ctx.shadowBlur=0; ctx.font='20px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(d.pu.icon,0,0);
        ctx.restore();
    });

    // Chain lightning arcs
    sLightningArcs.forEach(arc=>{
        ctx.save(); ctx.globalAlpha=arc.life;
        ctx.strokeStyle='#aaff00'; ctx.shadowColor='#aaff00'; ctx.shadowBlur=12; ctx.lineWidth=1.5;
        const dx=arc.x2-arc.x1,dy=arc.y2-arc.y1;
        const segs=Math.max(3,Math.ceil(Math.hypot(dx,dy)/25));
        ctx.beginPath(); ctx.moveTo(arc.x1,arc.y1);
        for (let s=1;s<segs;s++){const t=s/segs;ctx.lineTo(arc.x1+dx*t+(Math.random()-0.5)*22,arc.y1+dy*t+(Math.random()-0.5)*22);}
        ctx.lineTo(arc.x2,arc.y2); ctx.stroke(); ctx.restore();
    });

    // Enemy bullets
    sEBullets.forEach(b=>{
        ctx.save(); ctx.shadowColor=b.color; ctx.shadowBlur=14; ctx.fillStyle=b.color;
        const angle=Math.atan2(b.vy,b.vx)+Math.PI/2;
        ctx.translate(b.x,b.y); ctx.rotate(angle);
        ctx.beginPath(); ctx.ellipse(0,0,b.r*0.55,b.r*2,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    });

    // Player bullets
    sBullets.forEach(b=>{
        if (b.type==='laser'){
            ctx.save(); ctx.globalAlpha=b.life;
            ctx.strokeStyle='#ff0044'; ctx.lineWidth=8; ctx.shadowColor='#ff0044'; ctx.shadowBlur=35;
            ctx.beginPath(); ctx.moveTo(b.x,canvas.height); ctx.lineTo(b.x,0); ctx.stroke();
            ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.shadowBlur=0;
            ctx.beginPath(); ctx.moveTo(b.x,canvas.height); ctx.lineTo(b.x,0); ctx.stroke();
            ctx.restore(); return;
        }
        ctx.save();
        b.trail.forEach((pt,ti)=>{ctx.globalAlpha=(ti/b.trail.length)*0.5;ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(pt.x,pt.y,b.r*(ti/b.trail.length),0,Math.PI*2);ctx.fill();});
        ctx.globalAlpha=1; ctx.shadowColor=b.color; ctx.shadowBlur=20; ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r*0.45,b.r*2.4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=b.color; ctx.globalAlpha=0.55;
        ctx.beginPath(); ctx.ellipse(b.x,b.y,b.r,b.r*3.8,0,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1; ctx.restore();
    });

    // Enemies
    sEnemies.forEach(en=>{
        ctx.save();
        ctx.globalAlpha=en.spawnAlpha;
        ctx.translate(en.x,en.y); ctx.rotate(en.rot);
        const pulse=1+Math.sin(en.pulseT)*0.08;
        ctx.scale(pulse,pulse);
        const bossLowHp=en.isBoss&&(en.hp/en.maxHp)<0.33;
        ctx.shadowColor=bossLowHp?`hsl(${(now/4)%360},100%,60%)`:en.color;
        ctx.shadowBlur=bossLowHp?40+Math.sin(now/60)*20:(en.isBoss?35:16);
        ctx.fillStyle=en.color;

        if (en.isBoss) {
            ctx.beginPath();
            for (let s=0;s<6;s++){const a=(s/6)*Math.PI*2-Math.PI/6;s===0?ctx.moveTo(Math.cos(a)*en.w/2,Math.sin(a)*en.h/2):ctx.lineTo(Math.cos(a)*en.w/2,Math.sin(a)*en.h/2);}
            ctx.closePath(); ctx.fill(); ctx.strokeStyle='#ffffff44'; ctx.lineWidth=2; ctx.stroke();
            ctx.rotate(-en.rot); ctx.scale(1/pulse,1/pulse);
            const bw=en.w*1.2;
            ctx.fillStyle='#220000'; ctx.fillRect(-bw/2,-en.h/2-16,bw,8);
            const hpPct=en.hp/en.maxHp;
            const barColor=hpPct<0.33?'#ff0000':hpPct<0.66?'#ff8800':'#ff00ff';
            ctx.fillStyle=barColor; ctx.shadowBlur=6; ctx.shadowColor=barColor; ctx.fillRect(-bw/2,-en.h/2-16,bw*hpPct,8);
            // Phase label
            if (en.bossPhase>1) {
                ctx.fillStyle=en.bossPhase>=3?'#ff0000':'#ff8800';
                ctx.font='bold 9px Courier New'; ctx.textAlign='center'; ctx.shadowBlur=0;
                ctx.fillText(en.bossPhase>=3?'BERSERK':'ENRAGED',0,-en.h/2-26);
            }
        } else if (en.enemyType==='diver') {
            ctx.beginPath(); ctx.moveTo(0,en.h/2); ctx.lineTo(en.w/2,-en.h/4); ctx.lineTo(en.w/5,-en.h/2); ctx.lineTo(-en.w/5,-en.h/2); ctx.lineTo(-en.w/2,-en.h/4); ctx.closePath(); ctx.fill();
            if (en.diverState==='dashing'){ctx.strokeStyle='#ffffff88';ctx.lineWidth=1.5;ctx.stroke();}
        } else if (en.enemyType==='splitter') {
            ctx.beginPath(); ctx.moveTo(-en.w/5,en.h/2); ctx.lineTo(-en.w/2,0); ctx.lineTo(-en.w/5,-en.h/2); ctx.lineTo(en.w/10,0); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(en.w/5,en.h/2); ctx.lineTo(-en.w/10,0); ctx.lineTo(en.w/5,-en.h/2); ctx.lineTo(en.w/2,0); ctx.closePath(); ctx.fill();
        } else if (en.enemyType==='shielded') {
            ctx.beginPath();
            for (let s=0;s<6;s++){const a=(s/6)*Math.PI*2;s===0?ctx.moveTo(Math.cos(a)*en.w/2.6,Math.sin(a)*en.h/2.6):ctx.lineTo(Math.cos(a)*en.w/2.6,Math.sin(a)*en.h/2.6);}
            ctx.closePath(); ctx.fill();
        } else if (en.enemyType==='mini') {
            ctx.beginPath(); ctx.moveTo(0,en.h/2); ctx.lineTo(en.w/2,-en.h/2); ctx.lineTo(-en.w/2,-en.h/2); ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath(); ctx.moveTo(0,en.h/2); ctx.lineTo(en.w/2,-en.h/2); ctx.lineTo(-en.w/2,-en.h/2); ctx.closePath(); ctx.fill();
        }

        if (!en.isBoss&&en.maxHp>1){
            ctx.rotate(-en.rot); ctx.scale(1/pulse,1/pulse);
            ctx.fillStyle='#220000'; ctx.fillRect(-en.w/2,-en.h/2-10,en.w,5);
            ctx.fillStyle='#ff0044'; ctx.shadowBlur=4; ctx.fillRect(-en.w/2,-en.h/2-10,en.w*(en.hp/en.maxHp),5);
        }
        ctx.restore();

        // Hit flash
        if (en.hitFlash>0){
            ctx.save(); ctx.globalAlpha=(en.hitFlash/12)*0.65*en.spawnAlpha;
            ctx.fillStyle='#ffffff'; ctx.shadowColor='#ffffff'; ctx.shadowBlur=en.isBoss?50:25;
            ctx.beginPath(); ctx.arc(en.x,en.y,en.w*0.52*(1+Math.sin(en.pulseT)*0.08),0,Math.PI*2); ctx.fill(); ctx.restore();
        }

        if (en.enemyType==='shielded'&&en.shieldHp>0){
            ctx.save(); ctx.translate(en.x,en.y); ctx.rotate(en.shieldRot);
            ctx.strokeStyle='#00c8ff'; ctx.shadowColor='#00c8ff'; ctx.shadowBlur=12;
            ctx.globalAlpha=0.4+(en.shieldHp/en.shieldMaxHp)*0.5; ctx.lineWidth=2.5;
            for (let s=0;s<8;s++){const a0=(s/8)*Math.PI*2,a1=a0+(Math.PI*2/8)*0.65;ctx.beginPath();ctx.arc(0,0,en.w/1.6,a0,a1);ctx.stroke();}
            ctx.restore();
        }
    });

    // Shield aura
    if (puEffects.shield.active){
        ctx.save(); ctx.strokeStyle='#00f2ff'; ctx.lineWidth=3; ctx.shadowColor='#00f2ff'; ctx.shadowBlur=24;
        ctx.globalAlpha=0.55+Math.sin(now/100)*0.3;
        ctx.beginPath(); ctx.arc(sPlayer.x,sPlayer.y,sPlayer.w,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }

    // Orbit particles (shield visual)
    sOrbitParticles.forEach(p=>{
        const ox=sPlayer.x+Math.cos(p.angle)*p.dist;
        const oy=sPlayer.y+Math.sin(p.angle)*p.dist;
        ctx.save(); ctx.globalAlpha=0.7+Math.sin(now/200+p.angle)*0.3;
        ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(ox,oy,p.size,0,Math.PI*2); ctx.fill(); ctx.restore();
    });

    // Combo flames
    sComboFlames.forEach(f=>{
        ctx.save(); ctx.globalAlpha=f.life*0.8;
        ctx.fillStyle=f.color; ctx.shadowColor=f.color; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.arc(f.x,f.y,f.size,0,Math.PI*2); ctx.fill(); ctx.restore();
    });

    // Player afterimage trail
    sPlayerHistory.forEach(h=>{
        ctx.save(); ctx.translate(h.x,h.y); ctx.globalAlpha=Math.max(0,h.alpha);
        ctx.shadowColor=h.color; ctx.shadowBlur=8;
        ctx.drawImage(shipImg,-sPlayer.w/2,-sPlayer.h/2,sPlayer.w,sPlayer.h); ctx.restore();
    });

    // Player ship
    ctx.save(); ctx.translate(sPlayer.x,sPlayer.y); ctx.shadowBlur=22;
    if (puEffects.phaseShift.active){ ctx.shadowColor='#cc88ff'; ctx.globalAlpha=0.35+Math.sin(now/80)*0.2; }
    else if (puEffects.berserker.active){ ctx.shadowColor='#ff4400'; ctx.shadowBlur=30+Math.sin(now/60)*10; }
    else if (sPlayer.invincTimer>0){ ctx.shadowColor='#ffff00'; ctx.globalAlpha=0.5+Math.sin(now/55)*0.5; }
    else { ctx.shadowColor='#00f2ff'; }
    ctx.drawImage(shipImg,-sPlayer.w/2,-sPlayer.h/2,sPlayer.w,sPlayer.h); ctx.restore();

    // Engine thruster
    ctx.save();
    const eY=sPlayer.y+sPlayer.h/2, flicker=(puEffects.berserker.active?32:20)+Math.random()*18;
    const tc=puEffects.berserker.active?'#ff4400':'#00f2ff';
    const tc2=puEffects.berserker.active?'#880000':'#0044ff';
    const grad=ctx.createLinearGradient(sPlayer.x,eY,sPlayer.x,eY+flicker+12);
    grad.addColorStop(0,tc+'dd'); grad.addColorStop(0.5,tc2+'aa'); grad.addColorStop(1,'transparent');
    ctx.fillStyle=grad; ctx.shadowColor=tc; ctx.shadowBlur=16;
    ctx.beginPath(); ctx.moveTo(sPlayer.x-9,eY); ctx.lineTo(sPlayer.x+9,eY); ctx.lineTo(sPlayer.x+2,eY+flicker); ctx.lineTo(sPlayer.x-2,eY+flicker); ctx.closePath(); ctx.fill(); ctx.restore();

    // Active power-up strips (left side)
    let stripY=110;
    Object.entries(puEffects).forEach(([k,v])=>{
        if (!v.active) return;
        const def=POWER_UP_DEFS.find(p=>p.type===k); if(!def) return;
        const pct=def.duration>0?Math.max(0,v.timer/def.duration):1;
        const expiring=pct<0.2&&def.duration>0;
        ctx.save();
        ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(18,stripY,150,28);
        ctx.strokeStyle=def.color; ctx.lineWidth=expiring?2:1;
        ctx.shadowColor=expiring?def.color:'transparent'; ctx.shadowBlur=expiring?8:0;
        ctx.strokeRect(18,stripY,150,28);
        ctx.font='12px Courier New'; ctx.fillStyle=def.color; ctx.textBaseline='middle'; ctx.shadowBlur=0;
        ctx.fillText(`${def.icon} ${def.label}`,26,stripY+14);
        if (def.duration>0){
            ctx.fillStyle=def.color+'33'; ctx.fillRect(96,stripY+7,60,14);
            ctx.fillStyle=expiring?'#ff4444':def.color; ctx.fillRect(96,stripY+7,60*pct,14);
        }
        ctx.restore(); stripY+=34;
    });

    // Wave announcement banner
    if (sWaveAnnounce.timer>0){
        const t=sWaveAnnounce.timer,maxT=160;
        const alpha=t<30?t/30:(t>maxT-20?(maxT-t)/20:1);
        const scale=t>maxT-15?1+(maxT-t)*0.04:1;
        ctx.save(); ctx.globalAlpha=alpha;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(canvas.width/2-190,canvas.height/2-58,380,96);
        ctx.strokeStyle='#00f2ff44'; ctx.lineWidth=1; ctx.strokeRect(canvas.width/2-190,canvas.height/2-58,380,96);
        ctx.font=`bold ${Math.floor(54*scale)}px Courier New`;
        ctx.fillStyle='#ffffff'; ctx.shadowColor='#00f2ff'; ctx.shadowBlur=30;
        ctx.fillText(`WAVE ${sWaveAnnounce.wave}`,canvas.width/2,canvas.height/2-12);
        ctx.font=`${Math.floor(16*scale)}px Courier New`;
        ctx.fillStyle='#00f2ff'; ctx.shadowBlur=12;
        const subs=['INCOMING','ENGAGE','STAND BY','PREPARE','BATTLE STATIONS','DEFEND'];
        ctx.fillText(subs[sWaveAnnounce.wave%subs.length],canvas.width/2,canvas.height/2+24);
        ctx.restore();
    }

    // Combo display (top-right)
    if (sComboMult>1||sComboStreak>0){
        ctx.save();
        ctx.textAlign='right'; ctx.textBaseline='top';
        ctx.font='bold 22px Courier New';
        ctx.shadowColor='#ffaa00'; ctx.shadowBlur=12; ctx.fillStyle='#ffaa00';
        ctx.fillText(`x${sComboMult} COMBO`,canvas.width-20,80);
        ctx.font='11px Courier New'; ctx.shadowBlur=0; ctx.fillStyle='#ffaa0099';
        ctx.fillText(`${sComboStreak} STREAK`,canvas.width-20,105);
        const pct=(sComboStreak%10)/10;
        ctx.fillStyle='#33333388'; ctx.fillRect(canvas.width-142,122,122,5);
        const bGrad=ctx.createLinearGradient(canvas.width-142,0,canvas.width-20,0);
        bGrad.addColorStop(0,'#ff8800'); bGrad.addColorStop(1,'#ffaa00');
        ctx.fillStyle=bGrad; ctx.fillRect(canvas.width-142,122,122*pct,5);
        ctx.shadowColor='#ffaa00'; ctx.shadowBlur=6; ctx.fillRect(canvas.width-142,122,122*pct,5);
        ctx.fillStyle='#ffaa0077'; ctx.font='9px Courier New'; ctx.shadowBlur=0;
        ctx.fillText(`${sComboStreak%10}/10 → 🪙`,canvas.width-20,130);
        ctx.restore();
    }

    // Score popups
    sScorePopups.forEach(p=>{
        ctx.save(); ctx.globalAlpha=Math.max(0,p.life);
        ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=10;
        ctx.font=`bold ${Math.floor(13+p.life*6)}px Courier New`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(p.text,p.x,p.y); ctx.restore();
    });

    // Toasts
    for (let i=sToasts.length-1;i>=0;i--){
        const t=sToasts[i]; t.life-=0.012; t.y-=0.4;
        if (t.life<=0){sToasts.splice(i,1);continue;}
        ctx.save(); ctx.globalAlpha=Math.min(1,t.life*1.5);
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font='bold 18px Courier New';
        ctx.shadowColor=t.color; ctx.shadowBlur=14; ctx.fillStyle=t.color;
        ctx.fillText(t.text,canvas.width/2,150+t.y-i*26); ctx.restore();
    }

    // Vignette: dark edges for cinematic depth
    const vig=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.height*0.28,canvas.width/2,canvas.height/2,canvas.width*0.82);
    vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.65)');
    ctx.fillStyle=vig; ctx.fillRect(0,0,canvas.width,canvas.height);

    // Subtle CRT scanline overlay (every 3rd row barely visible)
    ctx.save(); ctx.globalAlpha=0.025; ctx.fillStyle='#000000';
    for (let y=0;y<canvas.height;y+=3) ctx.fillRect(0,y,canvas.width,1);
    ctx.restore();

    ctx.restore(); // end shake
}

// =============================================================================
// SURVIVAL — PARTICLES
// =============================================================================
function createSurvivalParticles(x,y,color,big) {
    const count=big?45:11;
    for (let i=0;i<count;i++) {
        sParticles.push({x,y,vx:(Math.random()-0.5)*(big?10:5),vy:(Math.random()-0.5)*(big?10:5),size:Math.random()*(big?7:3)+1,life:1.0,color});
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
    if (survivalActive&&!isPaused) requestAnimationFrame(()=>survivalLoop(loopId));
}

// =============================================================================
// SURVIVAL — MOBILE TOUCH CONTROLS
// =============================================================================
let _touchX=0;
canvas.addEventListener('touchstart',e=>{if(!survivalActive)return;_touchX=e.touches[0].clientX;survivalShoot();},{passive:true});
canvas.addEventListener('touchmove',e=>{
    if(!survivalActive)return;
    const dx=e.touches[0].clientX-_touchX;
    sPlayer.x=Math.max(sPlayer.w/2,Math.min(canvas.width-sPlayer.w/2,sPlayer.x+dx*0.6));
    _touchX=e.touches[0].clientX; survivalShoot();
},{passive:true});

window.addEventListener('keydown',e=>{if(e.key===' '&&survivalActive&&!isPaused)sKeys.space=true;});
window.addEventListener('keyup',e=>{if(e.key===' ')sKeys.space=false;});

// =============================================================================
// RESIZE
// =============================================================================
window.addEventListener('resize',()=>{
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    if(survivalActive)sPlayer.y=canvas.height-100;
});