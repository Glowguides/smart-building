/* ─── Solar ROI Calculator ────────────────────────────────────────────────
 *
 *  Formulas:
 *  P_peak (kWp)      = roof_area × panel_efficiency × 1 kW/m²
 *  E_annual (kWh)    = P_peak × sun_hours/day × 365 × 0.80  (PR=0.80)
 *  Savings (MAD/yr)  = E_annual × electricity_price
 *  Payback (years)   = system_cost / Savings
 *  CO₂ saved (kg/yr) = E_annual × 0.55  (Morocco grid factor)
 *  20-yr ROI (%)     = (total_savings_20yr - cost) / cost × 100
 * ─────────────────────────────────────────────────────────────────────── */

const IRRADIANCE = {
  casablanca: 5.2, rabat: 5.1, marrakech: 5.8, agadir: 6.0,
  fes: 5.3, meknes: 5.3, oujda: 5.5, tangier: 4.8,
  tetouan: 4.9, kenitra: 5.0, paris: 3.0, london: 2.8,
  madrid: 4.7, dubai: 5.9, cairo: 5.7,
};
const PR = 0.80;
const CO2 = 0.55;
const DEGRADE = 0.005;

function getIrradiance(loc) {
  return IRRADIANCE[loc.toLowerCase().trim()] ?? 5.0;
}

function calcSolar(f) {
  const irr  = getIrradiance(f.location);
  const peak = f.roofArea * f.efficiency;
  const e1   = peak * irr * 365 * PR;
  const sav1 = e1 * f.price;
  const payback = sav1 > 0 ? f.cost / sav1 : 9999;
  const co2   = e1 * CO2;

  let cumSav = 0;
  const yearly = [];
  for (let yr = 1; yr <= 20; yr++) {
    const eYr = e1 * Math.pow(1 - DEGRADE, yr - 1);
    cumSav += eYr * f.price;
    yearly.push({ year: yr, cumSavings: +cumSav.toFixed(0), netValue: +(cumSav - f.cost).toFixed(0) });
  }

  const roi20 = ((cumSav - f.cost) / f.cost) * 100;

  return {
    irr, peak: +peak.toFixed(2),
    e1: +e1.toFixed(0), sav1: +sav1.toFixed(0),
    payback: +payback.toFixed(1), roi20: +roi20.toFixed(1),
    co2: +co2.toFixed(0), yearly,
  };
}

/* ── Chart ──────────────────────────────────────────────────────────────── */
let roiChart;

function drawROI(data, cost) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridC  = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)';
  const textC  = isDark ? '#94a3b8' : '#64748b';

  const ctx = document.getElementById('roiChart').getContext('2d');
  if (roiChart) roiChart.destroy();
  roiChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => 'Y' + d.year),
      datasets: [
        {
          label: 'Net Value (MAD)',
          data: data.map(d => d.netValue),
          borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.08)',
          fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
        },
        {
          label: 'Cumulative Savings (MAD)',
          data: data.map(d => d.cumSavings),
          borderColor: '#10b981', backgroundColor: 'transparent',
          tension: 0.4, pointRadius: 0, borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textC } } },
      scales: {
        x: { ticks: { color: textC }, grid: { color: gridC } },
        y: {
          ticks: { color: textC, callback: v => (v / 1000).toFixed(0) + 'k MAD' },
          grid: { color: gridC },
        },
      },
    },
  });
}

/* ── DOM ────────────────────────────────────────────────────────────────── */
function showResults(r, f) {
  document.getElementById('results').style.display = 'block';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('res-peak',    r.peak + ' kWp');
  set('res-energy',  r.e1.toLocaleString() + ' kWh');
  set('res-savings', r.sav1.toLocaleString() + ' MAD');
  set('res-payback', r.payback + ' years');
  set('res-roi',     r.roi20 + ' %');
  set('res-co2',     r.co2.toLocaleString() + ' kg');
  set('res-irr',     r.irr + ' kWh/m²/day for ' + f.location);

  drawROI(r.yearly, f.cost);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('solar-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = {
      location: document.getElementById('s-location').value,
      price:    +document.getElementById('s-price').value,
      roofArea: +document.getElementById('s-area').value,
      efficiency:+document.getElementById('s-efficiency').value,
      cost:     +document.getElementById('s-cost').value,
    };
    showResults(calcSolar(f), f);
  });
});
