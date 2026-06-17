/* ═══════════════════════════════════════════════════════════════════════════
   MAIN.JS — Shared utilities, animations, particle canvas
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Theme (always dark — force it) ──────────────────────────────────────── */
document.documentElement.removeAttribute('data-theme');

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const menuBtn  = document.getElementById('menu-btn');
  if (!sidebar) return;
  menuBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

/* ── Mark active nav link ────────────────────────────────────────────────── */
function markActiveLink() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
}

/* ── Scroll reveal (Intersection Observer) ───────────────────────────────── */
function initReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-scale');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        io.unobserve(e.target);
      }
    });
  }, { threshold: .12 });
  els.forEach(el => io.observe(el));
}

/* ── Animated counter ────────────────────────────────────────────────────── */
function animateCounter(el, target, duration = 1400, suffix = '') {
  const start   = performance.now();
  const isFloat = String(target).includes('.');
  const dec     = isFloat ? String(target).split('.')[1].length : 0;
  const from    = 0;
  function step(now) {
    const p  = Math.min((now - start) / duration, 1);
    const e  = 1 - Math.pow(1 - p, 4); // ease-out-quart
    const v  = from + (target - from) * e;
    el.textContent = isFloat ? v.toFixed(dec) + suffix : Math.round(v) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const target  = parseFloat(el.dataset.count);
        const suffix  = el.dataset.suffix || '';
        animateCounter(el, target, 1600, suffix);
        io.unobserve(el);
      }
    }, { threshold: .5 });
    io.observe(el);
  });
}

/* ── 3D card tilt ────────────────────────────────────────────────────────── */
function initTilt() {
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const x  = (e.clientX - r.left) / r.width  - .5;
      const y  = (e.clientY - r.top)  / r.height - .5;
      card.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(600px) rotateY(0) rotateX(0) translateZ(0)';
    });
  });
}

/* ── Particle Canvas ─────────────────────────────────────────────────────── */
function initParticles(canvasId = 'hero-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  const CONFIG = {
    count:       90,
    maxDist:     140,
    speed:       .4,
    dotColor:    'rgba(99,102,241,',
    lineColor:   'rgba(99,102,241,',
    dotSize:     1.8,
  };

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function makeParticle() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - .5) * CONFIG.speed,
      vy: (Math.random() - .5) * CONFIG.speed,
      r:  Math.random() * CONFIG.dotSize + .8,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: CONFIG.count }, makeParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = CONFIG.dotColor + '.7)';
      ctx.fill();
    });
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < CONFIG.maxDist) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = CONFIG.lineColor + (1 - d / CONFIG.maxDist) * .3 + ')';
          ctx.lineWidth = .8;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  init();
  draw();
  window.addEventListener('resize', () => { resize(); particles = Array.from({ length: CONFIG.count }, makeParticle); });
}

/* ── Hero text stagger animation ─────────────────────────────────────────── */
function initHeroAnim() {
  const items = document.querySelectorAll('.hero-anim');
  items.forEach((el, i) => {
    el.style.cssText = `opacity:0;transform:translateY(30px);transition:opacity .7s ${i*.12}s cubic-bezier(.4,0,.2,1),transform .7s ${i*.12}s cubic-bezier(.34,1.56,.64,1)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }));
  });
}

/* ── Typing cursor on subtitle ───────────────────────────────────────────── */
function initTyping(selector, texts, speed = 60) {
  const el = document.querySelector(selector);
  if (!el) return;
  let ti = 0, ci = 0, deleting = false;
  el.innerHTML = '<span class="typing-text"></span><span style="animation:blink 1s step-end infinite;color:var(--indigo)">|</span>';
  const span = el.querySelector('.typing-text');
  function tick() {
    const text = texts[ti];
    if (!deleting) {
      span.textContent = text.slice(0, ++ci);
      if (ci === text.length) { deleting = true; setTimeout(tick, 2000); return; }
    } else {
      span.textContent = text.slice(0, --ci);
      if (ci === 0) { deleting = false; ti = (ti + 1) % texts.length; }
    }
    setTimeout(tick, deleting ? speed / 2 : speed);
  }
  tick();
}

/* ── Number formatter ────────────────────────────────────────────────────── */
function fmt(n, dec = 0) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/* ── Toast notification ──────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:2rem;right:2rem;z-index:9999;
    background:${type==='success'?'rgba(16,185,129,.15)':'rgba(244,63,94,.15)'};
    border:1px solid ${type==='success'?'rgba(16,185,129,.4)':'rgba(244,63,94,.4)'};
    color:${type==='success'?'#6ee7b7':'#fda4af'};
    backdrop-filter:blur(20px);border-radius:12px;
    padding:.9rem 1.4rem;font-size:.875rem;font-weight:600;
    display:flex;align-items:center;gap:.6rem;
    animation:fade-up .4s cubic-bezier(.4,0,.2,1);
    box-shadow:0 8px 32px rgba(0,0,0,.4);
  `;
  t.innerHTML = (type==='success'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  ) + msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(10px)'; t.style.transition='.3s'; setTimeout(()=>t.remove(),300); }, 3000);
}

/* ── Chart defaults ──────────────────────────────────────────────────────── */
function applyChartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color         = '#64748b';
  Chart.defaults.borderColor   = 'rgba(148,163,184,.08)';
  Chart.defaults.font.family   = 'Inter';
  Chart.defaults.animation.duration = 900;
  Chart.defaults.animation.easing   = 'easeOutQuart';
}

/* ── Page transitions ────────────────────────────────────────────────────── */
function initPageTransitions() {
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
    if (!href.endsWith('.html') && !href.endsWith('/')) return;
    link.addEventListener('click', e => {
      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(() => { window.location.href = href; }, 360);
    });
  });
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  markActiveLink();
  initReveal();
  initCounters();
  initTilt();
  initHeroAnim();
  initParticles();
  applyChartDefaults();
  initPageTransitions();
});
