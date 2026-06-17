/* ─── Energy Report Generator ────────────────────────────────────────────
 *  All calculations run client-side (same formulas as thermal.js / solar.js)
 *  PDF export via jsPDF (loaded from CDN)
 * ─────────────────────────────────────────────────────────────────────── */

/* Reuse calculation logic inline */
const R_LAMBDA = { concrete: 1.7, brick: 0.72, wood: 0.13, steel: 50 };

function calcThermalR(f) {
  const dT = Math.abs(f.indoor - f.outdoor);
  const netWall = Math.max(2 * (f.length + f.width) * f.height - f.windowArea, 0);
  const vol = f.length * f.width * f.height;
  const uWall = 1 / (0.20 / R_LAMBDA[f.material] + (f.insulation / 100) / 0.04 + 0.17);
  const qW = uWall * netWall * dT;
  const qWin = 2.8 * f.windowArea * dT;
  const qV = 0.33 * 0.5 * vol * dT;
  const total = qW + qWin + qV;
  const score = Math.max(0, Math.min(100, 100 - Math.round(uWall * 40)));
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'E';
  return { uWall: +uWall.toFixed(3), qW: +qW.toFixed(0), qWin: +qWin.toFixed(0), qV: +qV.toFixed(0), total: +total.toFixed(0), heatKw: +(total/1000).toFixed(2), coolKw: +(total*1.1/1000).toFixed(2), score, grade };
}

const R_IRR = { casablanca:5.2,rabat:5.1,marrakech:5.8,agadir:6.0,fes:5.3,meknes:5.3,oujda:5.5,tangier:4.8,tetouan:4.9,kenitra:5.0,paris:3.0,london:2.8,madrid:4.7,dubai:5.9,cairo:5.7 };

function calcSolarR(f) {
  const irr = R_IRR[f.location.toLowerCase().trim()] ?? 5.0;
  const peak = f.roofArea * f.efficiency;
  const e1 = peak * irr * 365 * 0.80;
  const sav = e1 * f.price;
  const payback = sav > 0 ? +(f.cost / sav).toFixed(1) : 9999;
  let cumSav = 0;
  for (let yr = 1; yr <= 20; yr++) cumSav += e1 * Math.pow(0.995, yr - 1) * f.price;
  return { irr, peak: +peak.toFixed(2), e1: +e1.toFixed(0), sav: +sav.toFixed(0), payback, roi20: +((cumSav-f.cost)/f.cost*100).toFixed(1), co2: +(e1*0.55).toFixed(0) };
}

/* ── Rule-based report generation ──────────────────────────────────────── */
function generateReport(buildingName, tf, sf, tr, sr, includeThermal, includeSolar) {
  const inefficiencies = [];
  const recommendations = [];
  const costSaving = [];

  if (includeThermal && tr) {
    if (['D','E'].includes(tr.grade)) {
      inefficiencies.push(`Poor thermal envelope (Grade ${tr.grade}): high U-value of ${tr.uWall} W/m²·K causes ${tr.qW} W wall heat loss.`);
      recommendations.push('Upgrade wall insulation to ≥10 cm mineral wool to reduce U-value below 0.30 W/m²·K.');
      costSaving.push('Adding 10 cm EPS insulation typically cuts heating/cooling costs by 25–35 %.');
    }
    const wallArea = 2 * (tf.length + tf.width) * tf.height;
    const winRatio = wallArea > 0 ? tf.windowArea / wallArea : 0;
    if (winRatio > 0.30) {
      inefficiencies.push(`High glazing ratio (${(winRatio*100).toFixed(0)} % of wall area): windows account for ${tr.qWin} W heat loss.`);
      recommendations.push('Replace with triple-glazed low-E units (U ≤ 1.1 W/m²·K) to cut window losses by up to 60 %.');
      costSaving.push('Triple glazing pays back in 7–10 years and improves occupant comfort significantly.');
    }
    if (tr.qV > tr.qW) {
      inefficiencies.push(`Ventilation is the dominant heat loss path (${tr.qV} W > walls ${tr.qW} W).`);
      recommendations.push('Install Heat Recovery Ventilation (HRV) with ≥80 % efficiency.');
      costSaving.push('HRV reduces ventilation heat loss by up to 80 %, payback 3–5 years.');
    }
    if (['A','B'].includes(tr.grade))
      recommendations.push('Thermal envelope is well-optimised. Focus on smart HVAC scheduling and occupancy sensors.');
  }

  if (includeSolar && sr) {
    if (sr.payback > 12) {
      inefficiencies.push(`Long solar payback (${sr.payback} years) — consider negotiating lower installation cost or applying for MASEN subsidies.`);
      costSaving.push('MASEN / ONEE solar subsidies can reduce upfront cost by 15–30 %.');
    } else {
      recommendations.push(`Solar investment is financially attractive: ${sr.payback}-year payback, ${sr.roi20} % ROI over 20 years.`);
    }
    recommendations.push(`Install ${sr.peak} kWp PV system → ${sr.e1.toLocaleString()} kWh/year, saves ${sr.sav.toLocaleString()} MAD/year, offsets ${sr.co2.toLocaleString()} kg CO₂.`);
    costSaving.push('Pair PV with battery storage to increase self-consumption above 80 % and avoid peak-tariff import.');
  }

  recommendations.push('Install occupancy sensors to auto-dim lighting and reduce HVAC load in empty zones.');
  recommendations.push('Deploy a Building Management System (BMS) with 15-min interval sub-metering.');
  costSaving.push('LED retrofit delivers 50–70 % lighting energy savings vs fluorescent, with <2 year payback.');
  costSaving.push('Programmable thermostats and BMS scheduling can cut HVAC energy by 10–20 %.');

  if (!inefficiencies.length)
    inefficiencies.push('No major inefficiencies detected — building parameters are within best-practice ranges.');

  let summary = `Energy Analysis Report — ${buildingName}. `;
  if (tr) summary += `Thermal grade: ${tr.grade} | Total heat loss: ${tr.total} W | Heating: ${tr.heatKw} kW | Cooling: ${tr.coolKw} kW. `;
  if (sr) summary += `Solar: ${sr.e1.toLocaleString()} kWh/yr | Savings: ${sr.sav.toLocaleString()} MAD | Payback: ${sr.payback} years | CO₂ saved: ${sr.co2.toLocaleString()} kg/yr. `;
  summary += `${inefficiencies.length} inefficiency(ies), ${recommendations.length} recommendations.`;

  return { summary, inefficiencies, recommendations, costSaving };
}

/* ── Render report to page ──────────────────────────────────────────────── */
function renderReport(result, buildingName, tr, sr) {
  document.getElementById('report-output').classList.add('visible');

  document.getElementById('rpt-building').textContent = buildingName;
  document.getElementById('rpt-date').textContent = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('rpt-summary').textContent = result.summary;

  const listEl = (items, bulletColor) =>
    items.map(t => `<li><span class="report-bullet" style="color:${bulletColor}">•</span>${t}</li>`).join('');

  document.getElementById('rpt-ineff').innerHTML   = listEl(result.inefficiencies,  '#dc2626');
  document.getElementById('rpt-recs').innerHTML    = listEl(result.recommendations, '#16a34a');
  document.getElementById('rpt-saving').innerHTML  = listEl(result.costSaving,      '#ca8a04');

  // Thermal mini table
  if (tr) {
    document.getElementById('thermal-summary').style.display = 'grid';
    document.getElementById('rs-grade').textContent    = tr.grade;
    document.getElementById('rs-loss').textContent     = tr.total + ' W';
    document.getElementById('rs-heating').textContent  = tr.heatKw + ' kW';
    document.getElementById('rs-cooling').textContent  = tr.coolKw + ' kW';
  } else {
    document.getElementById('thermal-summary').style.display = 'none';
  }

  // Solar mini table
  if (sr) {
    document.getElementById('solar-summary').style.display = 'grid';
    document.getElementById('rs-energy').textContent   = sr.e1.toLocaleString() + ' kWh';
    document.getElementById('rs-savings').textContent  = sr.sav.toLocaleString() + ' MAD';
    document.getElementById('rs-payback').textContent  = sr.payback + ' years';
    document.getElementById('rs-co2').textContent      = sr.co2.toLocaleString() + ' kg';
  } else {
    document.getElementById('solar-summary').style.display = 'none';
  }

  document.getElementById('report-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── PDF export ─────────────────────────────────────────────────────────── */
function exportPDF(result, buildingName, tr, sr) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210; const MARGIN = 18;

  // Header bar
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Smart Building Platform — Energy Report', W / 2, 14, { align: 'center' });

  let y = 30;
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Building: ${buildingName}`, MARGIN, y);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, W - MARGIN, y, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Executive Summary', MARGIN, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const lines = doc.splitTextToSize(result.summary, W - MARGIN * 2);
  doc.text(lines, MARGIN, y); y += lines.length * 5 + 6;

  const section = (title, items, color) => {
    doc.setFillColor(...color);
    doc.rect(MARGIN - 2, y - 4, W - (MARGIN - 2) * 2, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(title, MARGIN, y); y += 7;
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    items.forEach(item => {
      const ls = doc.splitTextToSize('• ' + item, W - MARGIN * 2);
      if (y + ls.length * 5 > 270) { doc.addPage(); y = 20; }
      doc.text(ls, MARGIN, y); y += ls.length * 5 + 2;
    });
    y += 4;
  };

  section('Identified Inefficiencies', result.inefficiencies,  [185, 28, 28]);
  section('Recommendations',           result.recommendations, [21, 128, 61]);
  section('Cost-Saving Ideas',         result.costSaving,      [30, 58, 138]);

  if (tr) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30,30,30);
    doc.text('Thermal Summary', MARGIN, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    [['Grade', tr.grade], ['Total Heat Loss', tr.total + ' W'], ['Heating Load', tr.heatKw + ' kW'], ['Cooling Load', tr.coolKw + ' kW']]
      .forEach(([l, v]) => { doc.text(l, MARGIN, y); doc.text(v, MARGIN + 60, y); y += 5; });
    y += 4;
  }

  if (sr) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30,30,30);
    doc.text('Solar Summary', MARGIN, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    [['Annual Production', sr.e1.toLocaleString() + ' kWh'], ['Annual Savings', sr.sav.toLocaleString() + ' MAD'], ['Payback Period', sr.payback + ' years'], ['CO₂ Saved / yr', sr.co2.toLocaleString() + ' kg']]
      .forEach(([l, v]) => { doc.text(l, MARGIN, y); doc.text(v, MARGIN + 60, y); y += 5; });
  }

  // Footer
  doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'italic');
  doc.text('Generated by Smart Building Platform — for educational/portfolio purposes', W / 2, 290, { align: 'center' });

  doc.save(`energy_report_${buildingName.replace(/\s+/g, '_')}.pdf`);
}

/* ── Event wiring ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  let lastResult = null, lastTR = null, lastSR = null, lastName = '';

  document.getElementById('report-form').addEventListener('submit', e => {
    e.preventDefault();

    const buildingName  = document.getElementById('r-name').value || 'My Building';
    const includeThermal = document.getElementById('r-inc-thermal').checked;
    const includeSolar   = document.getElementById('r-inc-solar').checked;

    const tf = includeThermal ? {
      length:     +document.getElementById('r-length').value,
      width:      +document.getElementById('r-width').value,
      height:     +document.getElementById('r-height').value,
      material:   document.getElementById('r-material').value,
      insulation: +document.getElementById('r-insulation').value,
      windowArea: +document.getElementById('r-window').value,
      indoor:     +document.getElementById('r-indoor').value,
      outdoor:    +document.getElementById('r-outdoor').value,
    } : null;

    const sf = includeSolar ? {
      location:  document.getElementById('r-location').value,
      price:     +document.getElementById('r-price').value,
      roofArea:  +document.getElementById('r-roof').value,
      efficiency:+document.getElementById('r-efficiency').value,
      cost:      +document.getElementById('r-cost').value,
    } : null;

    const tr = tf ? calcThermalR(tf) : null;
    const sr = sf ? calcSolarR(sf)   : null;
    const result = generateReport(buildingName, tf, sf, tr, sr, includeThermal, includeSolar);

    lastResult = result; lastTR = tr; lastSR = sr; lastName = buildingName;
    renderReport(result, buildingName, tr, sr);
  });

  document.getElementById('btn-pdf').addEventListener('click', () => {
    if (lastResult) exportPDF(lastResult, lastName, lastTR, lastSR);
  });

  // Toggle thermal/solar sections
  document.getElementById('r-inc-thermal').addEventListener('change', e => {
    document.getElementById('thermal-fields').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('r-inc-solar').addEventListener('change', e => {
    document.getElementById('solar-fields').style.display = e.target.checked ? 'block' : 'none';
  });
});
