// =============================================================================
//  SENTRON — galaxy.js
//  Plain-JavaScript version of the ReactBits "Galaxy" animated background.
//  No React, no build step: just <script src="galaxy.js"></script>.
//
//  It draws on <canvas id="galaxyCanvas"> which sits BEHIND the game canvas.
//  The game canvas is transparent, so this shows through during gameplay.
// =============================================================================


// ┌───────────────────────────────────────────────────────────────────────────┐
// │  USAGE  —  this is the <Galaxy ... /> block from the ReactBits page.      │
// │  Every prop below is read by the engine. Change a value, refresh, done.   │
// └───────────────────────────────────────────────────────────────────────────┘
const GALAXY_USAGE = {
    density:           3,
    glowIntensity:     0.71,
    flareIntensity:    1,
    starSpeed:         0,
    mouseRepulsion:    true,
    clickWarp:         true,
    starColors:        ['#ffffff', '#bfe3ff', '#8fb8ff'],
    hueShift:          360,
    saturation:        1,
    starSize:          1,
    twinkleIntensity:  0.6,
    speed:             1.1,
    rotationSpeed:     0.05,
    layers:            3,
    direction:         'backward',
    repulsionStrength: 2.1,
    mouseInteraction:  true,
    intro:             true,
    lightMode:         false,
};


(function () {
    'use strict';

    const canvas = document.getElementById('galaxyCanvas');
    if (!canvas) { console.warn('[galaxy] #galaxyCanvas not found'); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Optional: set window.GALAXY_OVERRIDES = {...} before this script to tweak without editing.
    const cfg = Object.assign({}, GALAXY_USAGE, window.GALAXY_OVERRIDES || {});

    const INTRO_SECONDS    = 2.2;
    const REPULSION_RADIUS = 150;
    const WARP_SECONDS     = 1.15;
    const DIR              = cfg.direction === 'backward' ? -1 : 1;

    let W = 0, H = 0, DPR = 1, maxR = 0;
    let stars = [], sprites = [], flareSprite = null, nebula = null;
    let introT = cfg.intro ? 0 : 1;
    let rot = 0, t = 0, last = 0;
    const warps = [];
    const mouse = { x: -9999, y: -9999, sx: 0, sy: 0, active: false };

    // ── colour helpers ───────────────────────────────────────────────────────
    function hexToRgb(hex) {
        hex = String(hex).replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r)      h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else                h = (r - g) / d + 4;
            h *= 60;
        }
        return { h: h, s: s, l: l };
    }

    // applies hueShift + saturation from the usage props
    function tint(hex) {
        const rgb = hexToRgb(hex);
        const c = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        c.h = (c.h + cfg.hueShift) % 360;
        c.s = Math.min(1, c.s * cfg.saturation);
        if (cfg.lightMode) c.l *= 0.35;
        return c;
    }

    function hsla(h, s, l, a) {
        return 'hsla(' + h.toFixed(1) + ',' + (s * 100).toFixed(1) + '%,' + (l * 100).toFixed(1) + '%,' + a + ')';
    }

    function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

    // ── pre-rendered sprites (fast: one drawImage per star, no shadowBlur) ───
    function makeStarSprite(hex) {
        const c = tint(hex), size = 64, half = 32;
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        const glow = cfg.glowIntensity;
        const core = cfg.lightMode ? c.l : Math.min(0.98, c.l + 0.25);
        const gr = g.createRadialGradient(half, half, 0, half, half, half);
        gr.addColorStop(0,    hsla(c.h, c.s, core, 1));
        gr.addColorStop(0.10, hsla(c.h, c.s, core, 0.95));
        gr.addColorStop(0.24, hsla(c.h, c.s, c.l,  0.50 + 0.30 * glow));
        gr.addColorStop(0.55, hsla(c.h, c.s, c.l,  0.08 + 0.24 * glow));
        gr.addColorStop(1,    hsla(c.h, c.s, c.l,  0));
        g.fillStyle = gr;
        g.fillRect(0, 0, size, size);
        return cv;
    }

    function makeFlareSprite() {
        const size = 128, h = 64;
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        let gr = g.createLinearGradient(0, h, size, h);
        gr.addColorStop(0,   'rgba(190,220,255,0)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.95)');
        gr.addColorStop(1,   'rgba(190,220,255,0)');
        g.fillStyle = gr; g.fillRect(0, h - 1, size, 2);
        gr = g.createLinearGradient(h, 0, h, size);
        gr.addColorStop(0,   'rgba(190,220,255,0)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.95)');
        gr.addColorStop(1,   'rgba(190,220,255,0)');
        g.fillStyle = gr; g.fillRect(h - 1, 0, 2, size);
        return cv;
    }

    // soft coloured haze behind the stars (rendered once per resize)
    function makeNebula() {
        const cv = document.createElement('canvas');
        const w = cv.width  = Math.max(2, Math.floor(W / 2));
        const h = cv.height = Math.max(2, Math.floor(H / 2));
        const g = cv.getContext('2d');
        const blobs = [
            [0.22, 0.30, 0.55, 225, 0.16],
            [0.80, 0.62, 0.45, 285, 0.13],
            [0.50, 0.92, 0.40, 190, 0.09],
        ];
        blobs.forEach(function (b) {
            const rr = Math.max(w, h) * b[2];
            const gr = g.createRadialGradient(w * b[0], h * b[1], 0, w * b[0], h * b[1], rr);
            gr.addColorStop(0, 'hsla(' + ((b[3] + cfg.hueShift) % 360) + ',70%,35%,' + b[4] + ')');
            gr.addColorStop(1, 'hsla(0,0%,0%,0)');
            g.fillStyle = gr;
            g.fillRect(0, 0, w, h);
        });
        return cv;
    }

    // ── star field ───────────────────────────────────────────────────────────
    function buildStars() {
        stars = [];
        const area     = Math.min(1.7, Math.max(0.5, (W * H) / (1920 * 1080)));
        const layers   = Math.max(1, Math.min(8, cfg.layers | 0));
        const perLayer = Math.round(75 * cfg.density * area);
        maxR = Math.hypot(W, H) / 2 * 1.04;

        for (let l = 0; l < layers; l++) {
            const d = (l + 1) / layers;                       // depth: far 0.33 .. near 1
            for (let i = 0; i < perLayer; i++) {
                stars.push({
                    a0:    Math.random() * Math.PI * 2,
                    r:     Math.sqrt(Math.random()) * maxR,   // uniform over the disc
                    d:     d,
                    size:  (0.45 + Math.random() * 1.05) * (0.55 + 0.85 * d) * cfg.starSize,
                    alpha: (0.30 + Math.random() * 0.70) * (0.45 + 0.55 * d),
                    c:     Math.floor(Math.random() * sprites.length),
                    ph:    Math.random() * Math.PI * 2,
                    ts:    0.5 + Math.random() * 1.8,
                    flare: d > 0.6 && Math.random() < 0.06,
                    ox: 0, oy: 0,
                });
            }
        }
    }

    function resize() {
        W   = window.innerWidth;
        H   = window.innerHeight;
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width  = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        if (!sprites.length) sprites = cfg.starColors.map(makeStarSprite);
        if (!flareSprite)    flareSprite = makeFlareSprite();
        nebula = makeNebula();
        buildStars();
        if (!mouse.sx) { mouse.sx = W / 2; mouse.sy = H / 2; }
    }

    function addWarp(x, y) {
        warps.push({ x: x, y: y, t0: performance.now() });
        if (warps.length > 4) warps.shift();
    }

    // ── main loop ────────────────────────────────────────────────────────────
    function frame(now) {
        requestAnimationFrame(frame);
        if (!last) last = now;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;

        t   += dt * cfg.speed;
        rot += dt * cfg.rotationSpeed * cfg.speed * DIR;
        if (introT < 1) introT = Math.min(1, introT + dt / INTRO_SECONDS);
        const intro = easeOutCubic(introT);

        // smoothed mouse for parallax
        const mx = mouse.active ? mouse.x : W / 2;
        const my = mouse.active ? mouse.y : H / 2;
        mouse.sx += (mx - mouse.sx) * Math.min(1, dt * 3);
        mouse.sy += (my - mouse.sy) * Math.min(1, dt * 3);
        const px = cfg.mouseInteraction ? -((mouse.sx / W) - 0.5) * 2 * 22 : 0;
        const py = cfg.mouseInteraction ? -((mouse.sy / H) - 0.5) * 2 * 22 : 0;

        // update click warps
        for (let i = warps.length - 1; i >= 0; i--) {
            const age = (now - warps[i].t0) / 1000;
            if (age > WARP_SECONDS) { warps.splice(i, 1); continue; }
            warps[i].k    = age / WARP_SECONDS;
            warps[i].ring = warps[i].k * Math.hypot(W, H) * 0.9;
        }

        // ── draw ──
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (cfg.lightMode) { ctx.fillStyle = '#eef2fb'; ctx.fillRect(0, 0, W, H); }

        ctx.globalCompositeOperation = 'source-over';
        if (nebula) {
            ctx.globalAlpha = intro * (cfg.lightMode ? 0.4 : 1);
            ctx.drawImage(nebula, 0, 0, W, H);
        }
        ctx.globalCompositeOperation = cfg.lightMode ? 'source-over' : 'lighter';

        const cx = W / 2, cy = H / 2;
        const repOn = cfg.mouseInteraction && cfg.mouseRepulsion && mouse.active;
        const glowSize = 10 + 8 * cfg.glowIntensity;

        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];

            // optional drift through space (starSpeed 0 = static field, only rotates)
            if (cfg.starSpeed) {
                s.r += cfg.starSpeed * cfg.speed * DIR * 55 * dt * s.d;
                if (s.r > maxR) s.r -= maxR;
                if (s.r < 0)    s.r += maxR;
            }

            const ang = s.a0 + rot;
            const rr  = s.r * (0.45 + 0.55 * intro);          // intro: field expands outward
            let x = cx + Math.cos(ang) * rr + px * s.d;
            let y = cy + Math.sin(ang) * rr + py * s.d;
            if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;

            // target push-offset: mouse repulsion + click warp shockwave
            let tx = 0, ty = 0, boost = 1;

            if (repOn) {
                const dx = x - mouse.x, dy = y - mouse.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < REPULSION_RADIUS * REPULSION_RADIUS && d2 > 0.01) {
                    const dist = Math.sqrt(d2);
                    let f = 1 - dist / REPULSION_RADIUS;
                    f *= f;
                    const push = f * cfg.repulsionStrength * 45;
                    tx += (dx / dist) * push;
                    ty += (dy / dist) * push;
                }
            }

            for (let w = 0; w < warps.length; w++) {
                const wp = warps[w];
                const dx = x - wp.x, dy = y - wp.y;
                const dist = Math.hypot(dx, dy) || 0.01;
                const delta = dist - wp.ring;
                if (Math.abs(delta) < 140) {
                    const wave = Math.cos((delta / 140) * Math.PI / 2) * (1 - wp.k);
                    const push = wave * cfg.repulsionStrength * 38;
                    tx += (dx / dist) * push;
                    ty += (dy / dist) * push;
                    boost += wave * 1.2;
                }
            }

            const ease = Math.min(1, dt * 9);
            s.ox += (tx - s.ox) * ease;
            s.oy += (ty - s.oy) * ease;
            x += s.ox;
            y += s.oy;

            // twinkle
            const tw = 1 - cfg.twinkleIntensity * 0.55 * (0.5 + 0.5 * Math.sin(t * s.ts + s.ph));
            const alpha = Math.min(1, s.alpha * tw * boost) * intro;
            if (alpha < 0.012) continue;

            const D = s.size * glowSize * (boost > 1 ? 1 + (boost - 1) * 0.4 : 1);
            ctx.globalAlpha = alpha;
            ctx.drawImage(sprites[s.c], x - D / 2, y - D / 2, D, D);

            if (s.flare && cfg.flareIntensity > 0) {
                const L = D * (2.4 + 0.6 * cfg.flareIntensity);
                ctx.globalAlpha = Math.min(1, alpha * 0.55 * cfg.flareIntensity);
                ctx.drawImage(flareSprite, x - L / 2, y - L / 2, L, L);
            }
        }

        // faint expanding ring for each click warp
        for (let w = 0; w < warps.length; w++) {
            const wp = warps[w];
            ctx.globalAlpha = (1 - wp.k) * 0.16;
            ctx.strokeStyle = '#bfe3ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(wp.x, wp.y, wp.ring, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    // ── input ────────────────────────────────────────────────────────────────
    window.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });

    const root = document.documentElement;
    if (root) root.addEventListener('mouseleave', function () { mouse.active = false; });

    window.addEventListener('mousedown', function (e) {
        if (cfg.clickWarp) addWarp(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('touchstart', function (e) {
        const tc = e.touches && e.touches[0];
        if (!tc) return;
        mouse.x = tc.clientX; mouse.y = tc.clientY; mouse.active = true;
        if (cfg.clickWarp) addWarp(tc.clientX, tc.clientY);
    }, { passive: true });

    window.addEventListener('touchend', function () { mouse.active = false; }, { passive: true });
    window.addEventListener('resize', resize);

    // ── go ───────────────────────────────────────────────────────────────────
    resize();
    requestAnimationFrame(frame);

    // small public API (handy from the browser console)
    window.Galaxy = {
        config: cfg,
        warp: addWarp,
        starCount: function () { return stars.length; },
        setOpacity: function (v) { canvas.style.opacity = v; },
    };
})();