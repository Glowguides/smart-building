/* ─── Thermal Load Calculator ─────────────────────────────────────────────
 *
 *  Formulas (simplified ISO 13790 / ASHRAE approach):
 *
 *  U_wall  = 1 / (t_mat/λ_mat + t_ins/λ_ins + R_surface)
 *    λ values (W/m·K): concrete=1.7, brick=0.72, wood=0.13, steel=50
 *    t_mat = 0.20 m (assumed wall thickness)
 *    R_surface = 0.17 m²·K/W (interior + exterior film)
 *
 *  Q_walls = U_wall × A_net_walls × ΔT           (W)
 *  Q_windows = U_window × A_windows × ΔT         (U_window = 2.8 W/m²·K, double glazed)
 *  Q_vent = 0.33 × 0.5 ACH × Volume × ΔT        (W)
 *
 *  Efficiency score = 100 - round(U_wall × 40), clamped 0-100
 *  Grade: A≥80, B≥60, C≥40, D≥20, E<20
 * ─────────────────────────────────────────────────────────────────────── */

const LAMBDA = { concrete: 1.7, brick: 0.72, wood: 0.13, steel: 50 };
const WALL_T = 0.20;
const LAMBDA_INS = 0.04;
const R_SURF = 0.17;
const U_WIN = 2.8;
const ACH = 0.5;

function calcThermal(f) {
  const deltaT = Math.abs(f.indoor - f.outdoor);
  const perim = 2 * (f.length + f.width);
  const grossWall = perim * f.height;
  const netWall = Math.max(grossWall - f.windowArea, 0);
  const volume = f.length * f.width * f.height;

  const rMat = WALL_T / LAMBDA[f.material];
  const rIns = (f.insulation / 100) / LAMBDA_INS;
  const uWall = 1 / (rMat + rIns + R_SURF);

  const qWalls = uWall * netWall * deltaT;
  const qWindows = U_WIN * f.windowArea * deltaT;
  const qVent = 0.33 * ACH * volume * deltaT;
  const total = qWalls + qWindows + qVent;

  const raw = 100 - Math.round(uWall * 40);
  const score = Math.max(0, Math.min(100, raw));
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'E';

  return {
    uWall: +uWall.toFixed(3),
    qWalls: +qWalls.toFixed(1),
    qWindows: +qWindows.toFixed(1),
    qVent: +qVent.toFixed(1),
    total: +total.toFixed(1),
    heatingKw: +(total / 1000).toFixed(3),
    coolingKw: +(total * 1.10 / 1000).toFixed(3),
    score, grade,
  };
}

/* ── Chart ──────────────────────────────────────────────────────────────── */
let pieChart;

function drawPie(r) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Walls', 'Windows', 'Ventilation'],
      datasets: [{
        data: [r.qWalls, r.qWindows, r.qVent],
        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b', padding: 16 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(0)} W` } },
      },
    },
  });
}

/* ── DOM ────────────────────────────────────────────────────────────────── */
function showResults(r) {
  document.getElementById('results').style.display = 'block';

  // Grade
  document.getElementById('grade-letter').textContent = r.grade;
  document.getElementById('grade-letter').className = 'grade-letter grade-' + r.grade;
  document.getElementById('grade-score').textContent = r.score + ' / 100';
  document.getElementById('grade-bar').style.width = r.score + '%';

  // Metrics
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('res-q-walls',   r.qWalls.toFixed(0) + ' W');
  set('res-q-windows', r.qWindows.toFixed(0) + ' W');
  set('res-q-vent',    r.qVent.toFixed(0) + ' W');
  set('res-total',     r.total.toFixed(0) + ' W');
  set('res-heating',   r.heatingKw.toFixed(2) + ' kW');
  set('res-cooling',   r.coolingKw.toFixed(2) + ' kW');
  set('res-uwall',     r.uWall + ' W/m²·K');

  drawPie(r);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('thermal-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = {
      length:     +document.getElementById('t-length').value,
      width:      +document.getElementById('t-width').value,
      height:     +document.getElementById('t-height').value,
      material:   document.getElementById('t-material').value,
      insulation: +document.getElementById('t-insulation').value,
      windowArea: +document.getElementById('t-window').value,
      indoor:     +document.getElementById('t-indoor').value,
      outdoor:    +document.getElementById('t-outdoor').value,
    };
    showResults(calcThermal(f));
  });
});
