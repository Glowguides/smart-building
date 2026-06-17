/* ═══════════════════════════════════════════════════════════════════════════
   BANNERS.JS — Thematic animated hero banners for each page
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('page-banner-canvas');
  if (!canvas) return;
  const type = canvas.dataset.type;
  const ctx  = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const ANIMS = { dashboard: animDashboard, thermal: animThermal, solar: animSolar, advisor: animAdvisor, report: animReport };
  if (ANIMS[type]) ANIMS[type](ctx, () => ({ W, H }));
});

/* ─────────────────────────────────────────────────────────────────────────
   DASHBOARD — Sensor network: glowing nodes + live data-flow particles
   ───────────────────────────────────────────────────────────────────────── */
function animDashboard(ctx, dim) {
  const ZONE_COLORS = ['#6366f1','#06b6d4','#10b981','#a855f7','#f97316'];
  let nodes = [], t = 0;

  function init() {
    const { W, H } = dim();
    nodes = Array.from({ length: 22 }, (_, i) => ({
      x:     Math.random() * W,
      y:     Math.random() * H,
      vx:    (Math.random() - .5) * .55,
      vy:    (Math.random() - .5) * .55,
      r:     Math.random() * 2.5 + 2,
      color: ZONE_COLORS[i % ZONE_COLORS.length],
      phase: Math.random() * Math.PI * 2,
    }));
  }
  init();
  window.addEventListener('resize', init);

  /* flowing dots along edges */
  const flows = Array.from({ length: 30 }, () => ({
    i: Math.floor(Math.random() * 22),
    j: Math.floor(Math.random() * 22),
    p: Math.random(),
    sp: .004 + Math.random() * .006,
  }));

  (function loop() {
    requestAnimationFrame(loop);
    const { W, H } = dim();
    t += .012;

    /* background */
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#020818');
    bg.addColorStop(1, '#060d1f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* move nodes */
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      n.phase += .03;
    });

    /* edges */
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
        const d  = Math.hypot(dx, dy);
        if (d < 160) {
          const a = (1 - d / 160) * .3;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(99,102,241,${a})`;
          ctx.lineWidth = .8;
          ctx.stroke();
        }
      }
    }

    /* flowing data particles along edges */
    flows.forEach(f => {
      f.p = (f.p + f.sp) % 1;
      const a = nodes[f.i % nodes.length], b = nodes[f.j % nodes.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.hypot(dx, dy) > 160) return;
      const px = a.x + dx * f.p, py = a.y + dy * f.p;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = a.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    /* nodes */
    nodes.forEach(n => {
      const pulse = Math.sin(n.phase) * .25 + .75;
      const r = n.r * (1 + Math.sin(n.phase) * .15);
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.shadowBlur = 18 * pulse;
      ctx.shadowColor = n.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  })();
}

/* ─────────────────────────────────────────────────────────────────────────
   THERMAL — Rising heat convection waves (cool → hot gradient)
   ───────────────────────────────────────────────────────────────────────── */
function animThermal(ctx, dim) {
  let t = 0;

  /* heat particles rising */
  const particles = Array.from({ length: 40 }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, r: 0, life: 0, maxLife: 0, color: '',
  }));

  function spawnParticle(p, W, H) {
    p.x       = Math.random() * W;
    p.y       = H + 5;
    p.vx      = (Math.random() - .5) * 1.2;
    p.vy      = -(1.5 + Math.random() * 2.5);
    p.r       = Math.random() * 3 + 1.5;
    p.life    = 0;
    p.maxLife = 60 + Math.random() * 80;
    const h   = Math.floor(Math.random() * 40);  /* hue: red–orange */
    p.color   = `hsl(${h},90%,60%)`;
  }

  const { W: W0, H: H0 } = dim();
  particles.forEach(p => { p.y = Math.random() * H0; p.life = Math.random() * 100; spawnParticle(p, W0, H0); });

  (function loop() {
    requestAnimationFrame(loop);
    const { W, H } = dim();
    t += .015;

    /* background — cool navy top, warm dark-red bottom */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#020a14');
    bg.addColorStop(.45, '#0a0f1a');
    bg.addColorStop(1,   '#1a0505');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* heat shimmer bands */
    const numWaves = 9;
    for (let w = 0; w < numWaves; w++) {
      const ratio   = 1 - w / numWaves;         /* 1=hot at bottom */
      const yBase   = H - (H / numWaves) * w;
      const amp     = 12 + ratio * 22;
      const speed   = 1.2 + ratio * 1.8;
      const hue     = Math.round(ratio * 40);    /* red→orange */
      const alpha   = .18 + ratio * .28;

      ctx.beginPath();
      for (let x = 0; x <= W + 4; x += 3) {
        const y = yBase
          + Math.sin(x * .013 + t * speed + w * .9)      * amp
          + Math.sin(x * .008 - t * speed * .7 + w * .4) * amp * .5;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${hue},85%,55%,${alpha})`;
      ctx.lineWidth   = 1.5 + ratio * 2;
      ctx.stroke();
    }

    /* rising particles */
    particles.forEach(p => {
      p.life++;
      if (p.life >= p.maxLife) { spawnParticle(p, W, H); return; }
      p.x  += p.vx + Math.sin(t * 2 + p.x * .01) * .4;
      p.y  += p.vy;
      p.vx += (Math.random() - .5) * .08;
      const progress = p.life / p.maxLife;
      const alpha    = Math.sin(progress * Math.PI) * .85;
      const r        = p.r * (1 - progress * .5);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace(')', `,${alpha})`).replace('hsl', 'hsla');
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  })();
}

/* ─────────────────────────────────────────────────────────────────────────
   SOLAR — Glowing sun with rotating rays + photon beam particles
   ───────────────────────────────────────────────────────────────────────── */
function animSolar(ctx, dim) {
  let t = 0;
  const NUM_RAYS   = 16;
  const NUM_PHOTONS = 60;

  const photons = Array.from({ length: NUM_PHOTONS }, () => ({}));

  function spawnPhoton(p, cx, cy) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 2.2;
    p.x    = cx; p.y    = cy;
    p.vx   = Math.cos(angle) * speed;
    p.vy   = Math.sin(angle) * speed;
    p.life = 0;
    p.maxLife = 40 + Math.random() * 60;
    p.r    = Math.random() * 2.5 + 1;
    p.hue  = 40 + Math.random() * 20; /* amber–yellow */
  }

  (function loop() {
    requestAnimationFrame(loop);
    const { W, H } = dim();
    const cx = W * .5, cy = H * .5;
    t += .016;

    /* deep space background */
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, W, H);

    /* faint star dots */
    if (!loop._stars) {
      loop._stars = Array.from({ length: 80 }, () => ({
        x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + .3, o: Math.random() * .6 + .2
      }));
    }
    loop._stars.forEach(s => {
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.o * (.5 + .5 * Math.sin(t * .5 + s.x * 10))})`;
      ctx.fill();
    });

    /* outer warm glow */
    const outerGlow = ctx.createRadialGradient(cx, cy, 20, cx, cy, H * .9);
    outerGlow.addColorStop(0,   'rgba(251,191,36,.12)');
    outerGlow.addColorStop(.35, 'rgba(249,115,22,.05)');
    outerGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, W, H);

    /* rotating rays */
    const rayLen  = H * .38;
    const rayOff  = H * .07;
    for (let i = 0; i < NUM_RAYS; i++) {
      const angle = (i / NUM_RAYS) * Math.PI * 2 + t * .25;
      const x1 = cx + Math.cos(angle) * rayOff;
      const y1 = cy + Math.sin(angle) * rayOff;
      const x2 = cx + Math.cos(angle) * rayLen;
      const y2 = cy + Math.sin(angle) * rayLen;
      const alpha = i % 2 === 0 ? .55 : .3;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0,   `rgba(252,211,77,${alpha})`);
      grad.addColorStop(1,   'transparent');
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = i % 2 === 0 ? 2.5 : 1.5;
      ctx.stroke();
    }

    /* corona */
    const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * .22);
    corona.addColorStop(0,   'rgba(255,255,220,1)');
    corona.addColorStop(.18, 'rgba(253,224,71,1)');
    corona.addColorStop(.45, 'rgba(251,191,36,.6)');
    corona.addColorStop(1,   'transparent');
    ctx.shadowBlur  = 60;
    ctx.shadowColor = '#fcd34d';
    ctx.beginPath(); ctx.arc(cx, cy, H * .22, 0, Math.PI * 2);
    ctx.fillStyle = corona; ctx.fill();
    ctx.shadowBlur = 0;

    /* sun core */
    const core = ctx.createRadialGradient(cx - H*.04, cy - H*.04, 0, cx, cy, H * .14);
    core.addColorStop(0,   '#ffffff');
    core.addColorStop(.3,  '#fef9c3');
    core.addColorStop(.7,  '#fcd34d');
    core.addColorStop(1,   '#f59e0b');
    ctx.beginPath(); ctx.arc(cx, cy, H * .14, 0, Math.PI * 2);
    ctx.fillStyle = core; ctx.fill();

    /* photon particles */
    if (!loop._photonsInit) {
      photons.forEach(p => spawnPhoton(p, cx, cy));
      loop._photonsInit = true;
    }
    photons.forEach(p => {
      p.life++;
      if (p.life >= p.maxLife) { spawnPhoton(p, cx, cy); return; }
      p.x += p.vx; p.y += p.vy;
      const progress = p.life / p.maxLife;
      const alpha    = Math.sin(progress * Math.PI) * .9;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - progress * .4), 0, Math.PI * 2);
      ctx.fillStyle   = `hsla(${p.hue},95%,70%,${alpha})`;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = '#fcd34d';
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  })();
}

/* ─────────────────────────────────────────────────────────────────────────
   ADVISOR — World grid + rippling location pins
   ───────────────────────────────────────────────────────────────────────── */
function animAdvisor(ctx, dim) {
  let t = 0;

  const PINS = [
    { lx: .2,  ly: .45, color: '#06b6d4' },
    { lx: .45, ly: .35, color: '#6366f1' },
    { lx: .65, ly: .55, color: '#10b981' },
    { lx: .78, ly: .3,  color: '#a855f7' },
    { lx: .55, ly: .65, color: '#f97316' },
  ];
  PINS.forEach(p => { p.ripple = Math.random() * Math.PI * 2; p.rippleR = Math.random() * .5; });

  (function loop() {
    requestAnimationFrame(loop);
    const { W, H } = dim();
    t += .012;

    /* background */
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#020c18');
    bg.addColorStop(1,   '#040d1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* latitude lines */
    const latLines = 7;
    for (let i = 0; i <= latLines; i++) {
      const y    = (i / latLines) * H;
      const wave = Math.sin(t * .6 + i * .8) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y + wave);
      for (let x = 0; x <= W; x += 4) {
        ctx.lineTo(x, y + Math.sin(x * .018 + t * .5 + i) * 5 + wave);
      }
      ctx.strokeStyle = 'rgba(6,182,212,.10)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    /* longitude lines */
    const lonLines = 14;
    for (let i = 0; i <= lonLines; i++) {
      const xBase = (i / lonLines) * W - (t * 18 % W);
      for (let rep = -1; rep <= 1; rep++) {
        const x = xBase + rep * W;
        ctx.beginPath();
        for (let y = 0; y <= H; y += 4) {
          const xOff = Math.sin(y * .02 + t * .4 + i) * 3;
          y === 0 ? ctx.moveTo(x + xOff, y) : ctx.lineTo(x + xOff, y);
        }
        ctx.strokeStyle = 'rgba(99,102,241,.08)';
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
    }

    /* location pins */
    PINS.forEach(p => {
      p.ripple     += .04;
      p.rippleR    = (p.rippleR + .012) % 1;
      const px      = p.lx * W, py = p.ly * H;
      const maxRip  = 38;

      /* ripple rings */
      for (let r = 0; r < 3; r++) {
        const phase   = (p.rippleR + r / 3) % 1;
        const radius  = phase * maxRip;
        const alpha   = (1 - phase) * .5;
        ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.strokeStyle = p.color.replace(')', `,${alpha})`).replace(/^#/, 'rgba(').replace(/(.{2})(.{2})(.{2})/, (_, r, g, b) =>
          `${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)}`);
        /* simpler: just use rgba with fixed color */
        ctx.strokeStyle = `rgba(99,102,241,${alpha})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }

      /* pin dot */
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle   = p.color;
      ctx.shadowBlur  = 18;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur  = 0;

      /* pin spike */
      ctx.beginPath(); ctx.moveTo(px, py + 5); ctx.lineTo(px, py + 14);
      ctx.strokeStyle = p.color;
      ctx.lineWidth   = 2;
      ctx.stroke();
    });

    /* floating data labels */
    ctx.font      = '700 10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    const labels  = ['33.6°N', '51.5°N', '25.2°N', '-23.5°S', '1.3°N'];
    PINS.forEach((p, i) => {
      ctx.fillText(labels[i], p.lx * W + 10, p.ly * H - 6);
    });
  })();
}

/* ─────────────────────────────────────────────────────────────────────────
   REPORT — Animated data bars + flowing document lines
   ───────────────────────────────────────────────────────────────────────── */
function animReport(ctx, dim) {
  let t = 0;

  const BARS = [
    { label: 'Solar',    color: '#fcd34d', target: .82 },
    { label: 'Wind',     color: '#60a5fa', target: .61 },
    { label: 'Thermal',  color: '#f97316', target: .74 },
    { label: 'Hydro',    color: '#06b6d4', target: .48 },
    { label: 'Savings',  color: '#10b981', target: .91 },
  ];
  BARS.forEach(b => b.current = 0);

  /* doc-line particles streaming left to right */
  const streams = Array.from({ length: 25 }, () => ({
    x: 0, y: 0, speed: 0, len: 0, alpha: 0, color: '',
  }));
  const streamColors = ['#6366f1','#a855f7','#06b6d4'];

  function spawnStream(s, W, H) {
    s.x     = -80 + Math.random() * W * .3;
    s.y     = 20  + Math.random() * (H - 40);
    s.speed = 1.5 + Math.random() * 2.5;
    s.len   = 40  + Math.random() * 80;
    s.alpha = .25 + Math.random() * .35;
    s.color = streamColors[Math.floor(Math.random() * streamColors.length)];
  }

  (function loop() {
    requestAnimationFrame(loop);
    const { W, H } = dim();
    t += .014;

    /* background */
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#06020f');
    bg.addColorStop(1, '#0a0418');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* streaming lines */
    if (!loop._streamsInit) { streams.forEach(s => spawnStream(s, W, H)); loop._streamsInit = true; }
    streams.forEach(s => {
      s.x += s.speed;
      if (s.x > W + s.len) spawnStream(s, W, H);
      const grad = ctx.createLinearGradient(s.x - s.len, 0, s.x, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(.5, s.color.replace('#', 'rgba(').replace(/(.{2})(.{2})(.{2})/, ''));
      /* easier approach: */
      ctx.beginPath();
      ctx.moveTo(Math.max(0, s.x - s.len), s.y);
      ctx.lineTo(Math.min(W, s.x), s.y);
      ctx.strokeStyle = s.color + Math.round(s.alpha * 255).toString(16).padStart(2,'0');
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    });

    /* animated bar chart */
    const barAreaW = W * .55;
    const barAreaX = W * .38;
    const barH     = (H - 40) / BARS.length;

    BARS.forEach((b, i) => {
      b.current += (b.target - b.current) * .025;

      const y       = 18 + i * barH;
      const fillW   = barAreaW * b.current;
      const pulse   = Math.sin(t * 1.5 + i) * .03;

      /* track */
      ctx.fillStyle = 'rgba(255,255,255,.04)';
      ctx.beginPath();
      ctx.roundRect(barAreaX, y + barH * .25, barAreaW, barH * .45, 4);
      ctx.fill();

      /* fill */
      if (fillW > 0) {
        const grad = ctx.createLinearGradient(barAreaX, 0, barAreaX + fillW, 0);
        grad.addColorStop(0,   b.color + '99');
        grad.addColorStop(1,   b.color + 'ff');
        ctx.fillStyle = grad;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = b.color;
        ctx.beginPath();
        ctx.roundRect(barAreaX, y + barH * .25, fillW + pulse * 20, barH * .45, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      /* label */
      ctx.font      = '600 11px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillText(b.label, barAreaX - 68, y + barH * .56);

      /* value */
      ctx.font      = '700 11px Inter, sans-serif';
      ctx.fillStyle = b.color;
      ctx.fillText(Math.round(b.current * 100) + '%', barAreaX + fillW + 8, y + barH * .56);
    });

    /* left: doc icon lines */
    const docX = 28, docY = 28, docW = W * .28, docH = H - 56;
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth   = 1;
    for (let l = 0; l < 9; l++) {
      const ly    = docY + (l / 9) * docH;
      const lineW = l % 3 === 0 ? docW * .6 : (l % 3 === 1 ? docW * .9 : docW * .75);
      const anim  = Math.sin(t * .8 + l * .5) * .04;
      ctx.beginPath();
      ctx.moveTo(docX, ly);
      ctx.lineTo(docX + lineW * (1 + anim), ly);
      ctx.stroke();
    }
  })();
}
