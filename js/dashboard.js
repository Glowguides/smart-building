/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD.JS — Simulated sensor data with animated charts
   ═══════════════════════════════════════════════════════════════════════════ */

const ZONES = ['Office A', 'Server Room', 'Lobby', 'Meeting Room', 'Rooftop'];
const ZONE_COLORS = ['#6366f1','#06b6d4','#a855f7','#10b981','#f59e0b'];

function sinWave(h, base, amp, peak = 14) {
  return base + amp * Math.sin(Math.PI * (h - peak + 12) / 12);
}
function rand(a, b) { return Math.random() * (b - a) + a; }

function makeZones() {
  const h = new Date().getHours();
  return ZONES.map((zone, i) => ({
    zone, color: ZONE_COLORS[i],
    temperature_c: +(sinWave(h, 22, 3) + rand(-.5, .5)).toFixed(1),
    humidity_pct:  +Math.max(20, Math.min(90, sinWave(h, 50, 10, 6) + rand(-2, 2))).toFixed(0),
    occupancy_pct: +Math.max(0, Math.min(100, sinWave(h, 50, 45, 12) + rand(-5, 5))).toFixed(0),
    hvac_kw:       +(Math.abs(sinWave(h, 3, 2)) + rand(0, .5)).toFixed(2),
    lighting_kw:   +Math.max(0, sinWave(h, 1, .8, 13) + rand(0, .1)).toFixed(2),
  })).map(z => ({ ...z, total_kw: +(z.hvac_kw + z.lighting_kw).toFixed(2) }));
}

function makeHourly() {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const ts = new Date(now - (23 - i) * 3600000);
    const h  = ts.getHours();
    return {
      time: ts.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
      energy_kw:     +(Math.abs(sinWave(h, 8, 6)) + rand(0, 1)).toFixed(2),
      temperature_c: +(sinWave(h, 22, 4)).toFixed(1),
    };
  });
}

function makeWeekly() {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return days.map(d => ({ day: d, energy_kwh: +(120 + rand(-20, 30)).toFixed(1) }));
}

/* ── Charts ─────────────────────────────────────────────────────────────── */
let hourlyChart, weeklyChart, zoneChart;

const gridCol = 'rgba(148,163,184,.07)';
const tickCol = '#475569';

function drawHourly(data) {
  const ctx = document.getElementById('hourlyChart')?.getContext('2d');
  if (!ctx) return;
  if (hourlyChart) hourlyChart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0,   'rgba(99,102,241,.35)');
  gradient.addColorStop(1,   'rgba(99,102,241,0)');

  hourlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.time),
      datasets: [{
        label: 'Energy (kW)',
        data: data.map(d => d.energy_kw),
        borderColor: '#6366f1',
        backgroundColor: gradient,
        fill: true, tension: .45,
        pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: '#6366f1',
        borderWidth: 2.5,
      }, {
        label: 'Temperature (°C)',
        data: data.map(d => d.temperature_c),
        borderColor: '#06b6d4',
        backgroundColor: 'transparent',
        tension: .45, pointRadius: 0,
        borderWidth: 2, borderDash: [6, 3],
        yAxisID: 'y2',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: tickCol, usePointStyle: true, pointStyleWidth: 8, padding: 16 } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,.95)',
          borderColor: 'rgba(99,102,241,.3)', borderWidth: 1,
          titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 12,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` }
        },
      },
      scales: {
        x:  { ticks: { color: tickCol, maxTicksLimit: 8 }, grid: { color: gridCol } },
        y:  { ticks: { color: tickCol, callback: v => v + ' kW' }, grid: { color: gridCol } },
        y2: { position: 'right', ticks: { color: '#06b6d4', callback: v => v + '°C' }, grid: { display: false } },
      },
    },
  });
}

function drawWeekly(data) {
  const ctx = document.getElementById('weeklyChart')?.getContext('2d');
  if (!ctx) return;
  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.day),
      datasets: [{
        label: 'Energy (kWh)',
        data: data.map(d => d.energy_kwh),
        backgroundColor: data.map((_, i) => i === data.length - 1 ? '#6366f1' : 'rgba(99,102,241,.4)'),
        borderRadius: 8, borderSkipped: false,
        hoverBackgroundColor: '#6366f1',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,.95)',
          borderColor: 'rgba(99,102,241,.3)', borderWidth: 1,
          titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 12,
        },
      },
      scales: {
        x: { ticks: { color: tickCol }, grid: { display: false } },
        y: { ticks: { color: tickCol, callback: v => v + ' kWh' }, grid: { color: gridCol } },
      },
    },
  });
}

function drawZoneChart(zones) {
  const ctx = document.getElementById('zoneChart')?.getContext('2d');
  if (!ctx) return;
  if (zoneChart) zoneChart.destroy();
  zoneChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Temp', 'Humidity', 'Occupancy', 'HVAC', 'Lighting'],
      datasets: zones.map(z => ({
        label: z.zone,
        data: [
          z.temperature_c / 40 * 100,
          z.humidity_pct,
          z.occupancy_pct,
          z.hvac_kw / 6 * 100,
          z.lighting_kw / 2 * 100,
        ],
        borderColor: z.color,
        backgroundColor: z.color + '18',
        pointBackgroundColor: z.color,
        borderWidth: 2, pointRadius: 3,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: tickCol, usePointStyle: true, pointStyleWidth: 8 } },
        tooltip: { backgroundColor: 'rgba(15,23,42,.95)', borderColor: 'rgba(99,102,241,.3)', borderWidth: 1, titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 10 },
      },
      scales: {
        r: {
          ticks: { color: tickCol, backdropColor: 'transparent', stepSize: 25 },
          grid: { color: gridCol },
          pointLabels: { color: '#94a3b8', font: { size: 12 } },
          min: 0, max: 100,
        },
      },
    },
  });
}

/* ── KPI update ──────────────────────────────────────────────────────────── */
function setKPI(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = parseFloat(el.dataset.prev ?? value);
  el.dataset.prev = value;
  animateCounter(el, parseFloat(value), 800);
}

function animateCounter(el, target, dur) {
  const start = performance.now();
  const from  = parseFloat(el.textContent) || 0;
  const dec   = String(target).includes('.') ? String(target).split('.')[1]?.length ?? 0 : 0;
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1-p, 3);
    el.textContent = (from + (target - from) * e).toFixed(dec);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateKPIs(zones) {
  const avg = (key, dec = 1) => +(zones.reduce((s, z) => s + z[key], 0) / zones.length).toFixed(dec);
  const total = +zones.reduce((s, z) => s + z.total_kw, 0).toFixed(2);

  setKPI('kpi-temp',  avg('temperature_c'));
  setKPI('kpi-hum',   avg('humidity_pct', 0));
  setKPI('kpi-occ',   avg('occupancy_pct', 0));
  setKPI('kpi-total', total);

  const alert = document.getElementById('alert-banner');
  if (total > 18) {
    alert.style.display = 'flex';
    document.getElementById('alert-msg').textContent = `High energy load detected — ${total} kW total across all zones. Review HVAC scheduling.`;
  } else {
    alert.style.display = 'none';
  }
}

/* ── Zone table ──────────────────────────────────────────────────────────── */
function updateTable(zones) {
  const tbody = document.getElementById('zone-tbody');
  if (!tbody) return;
  tbody.innerHTML = zones.map((z, i) => `
    <tr style="animation:fade-up .4s ${i*.07}s cubic-bezier(.4,0,.2,1) both">
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          <span style="width:8px;height:8px;border-radius:50%;background:${z.color};box-shadow:0 0 8px ${z.color};flex-shrink:0"></span>
          <strong>${z.zone}</strong>
        </div>
      </td>
      <td>
        <span style="color:${z.temperature_c > 25 ? '#f59e0b' : '#94a3b8'}">
          ${z.temperature_c} °C
        </span>
      </td>
      <td>${z.humidity_pct} %</td>
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          <span style="min-width:2.5rem">${z.occupancy_pct}%</span>
          <div class="progress" style="flex:1;max-width:80px">
            <div class="progress-bar" style="width:${z.occupancy_pct}%;background:${z.color}"></div>
          </div>
        </div>
      </td>
      <td class="mono" style="font-size:.82rem">${z.hvac_kw} kW</td>
      <td class="mono" style="font-size:.82rem">${z.lighting_kw} kW</td>
      <td>
        <span style="font-weight:700;color:${z.total_kw > 5 ? '#f43f5e' : '#10b981'}">
          ${z.total_kw} kW
        </span>
      </td>
    </tr>
  `).join('');
}

/* ── Energy Source Mix (donut) ──────────────────────────────────────────────── */
let sourceMixChart;
function drawSourceMix() {
  const ctx = document.getElementById('sourceMixChart')?.getContext('2d');
  if (!ctx) return;
  if (sourceMixChart) sourceMixChart.destroy();

  /* simulate a daylight-driven mix: more solar midday */
  const h = new Date().getHours();
  const solar = Math.round(Math.max(8, sinWave(h, 32, 22, 13)));
  const wind  = Math.round(rand(10, 20));
  const grid  = Math.max(5, 100 - solar - wind);

  const pct = document.getElementById('renewable-pct');
  if (pct) pct.textContent = (solar + wind) + '%';

  sourceMixChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Solar', 'Grid', 'Wind'],
      datasets: [{
        data: [solar, grid, wind],
        backgroundColor: ['#6366f1', '#1e293b', '#06b6d4'],
        borderColor: 'rgba(3,7,18,.9)', borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { color: tickCol, usePointStyle: true, pointStyleWidth: 8, padding: 14, font: { size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,.95)', borderColor: 'rgba(99,102,241,.3)', borderWidth: 1,
          titleColor: '#94a3b8', bodyColor: '#f1f5f9', padding: 10,
          callbacks: { label: c => ` ${c.label}: ${c.parsed}%` },
        },
      },
    },
  });
}

/* ── Efficiency Gauge (semi-circle) ─────────────────────────────────────────── */
let efficiencyGauge;
function drawEfficiencyGauge() {
  const ctx = document.getElementById('efficiencyGauge')?.getContext('2d');
  if (!ctx) return;
  if (efficiencyGauge) efficiencyGauge.destroy();

  const score = Math.round(rand(88, 96));
  const grade = score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 85 ? 'A-' : 'B+';
  const gEl = document.getElementById('eff-grade'); if (gEl) gEl.textContent = grade;
  const pEl = document.getElementById('eff-pct');   if (pEl) pEl.textContent = score + '%';

  efficiencyGauge = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: ['#10b981', 'rgba(148,163,184,.08)'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '78%', rotation: -90, circumference: 180,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
}

/* ── Recent Activity feed ───────────────────────────────────────────────────── */
const ACTIVITY_POOL = [
  { icon: '🔧', bg: 'rgba(99,102,241,.15)',  title: 'HVAC optimized — Floor 3',        ago: 2 },
  { icon: '☀️', bg: 'rgba(245,158,11,.15)',  title: 'Peak solar output detected',       ago: 6 },
  { icon: '⚠️', bg: 'rgba(244,63,94,.15)',   title: 'Sensor offline — Room 402',        ago: 14 },
  { icon: '💡', bg: 'rgba(16,185,129,.15)',  title: 'Lighting auto-dimmed — Lobby',     ago: 21 },
  { icon: '🌡️', bg: 'rgba(6,182,212,.15)',  title: 'Setpoint adjusted — Server Room',  ago: 33 },
  { icon: '🔋', bg: 'rgba(168,85,247,.15)',  title: 'Battery storage charging',         ago: 47 },
];
function updateActivity() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;
  const items = ACTIVITY_POOL.slice(0, 5);
  feed.innerHTML = items.map((a, i) => `
    <div class="activity-item" style="animation:fade-up .4s ${i*.06}s cubic-bezier(.4,0,.2,1) both">
      <div class="activity-dot" style="background:${a.bg}">${a.icon}</div>
      <div>
        <div class="activity-title">${a.title}</div>
        <div class="activity-time">${a.ago} min ago</div>
      </div>
    </div>
  `).join('');
}

/* ── Main refresh ─────────────────────────────────────────────────────────── */
function refresh() {
  const zones  = makeZones();
  const hourly = makeHourly();
  const weekly = makeWeekly();
  updateKPIs(zones);
  updateTable(zones);
  drawHourly(hourly);
  drawWeekly(weekly);
  drawZoneChart(zones);
  drawSourceMix();
  drawEfficiencyGauge();
  updateActivity();
  const el = document.getElementById('last-updated');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

document.addEventListener('DOMContentLoaded', () => {
  refresh();
  setInterval(refresh, 30000);
});
