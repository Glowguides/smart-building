/* ═══════════════════════════════════════════════════════════════════════════
   ADVISOR.JS — Location-based energy & panel orientation advisor
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Data tables ─────────────────────────────────────────────────────────── */
const IRRADIANCE_TABLE = {
  /* kWh/m²/day by approximate latitude band */
  /* More precise values are fetched via rules below */
};

function getSolarIrradiance(lat) {
  const a = Math.abs(lat);
  if (a <  5)  return 5.2;
  if (a < 10)  return 5.5;
  if (a < 15)  return 5.7;
  if (a < 20)  return 5.9;
  if (a < 25)  return 6.1;
  if (a < 30)  return 5.8;
  if (a < 35)  return 5.3;
  if (a < 40)  return 4.7;
  if (a < 45)  return 4.0;
  if (a < 50)  return 3.3;
  if (a < 55)  return 2.7;
  if (a < 60)  return 2.2;
  return 1.6;
}

function getClimateZone(lat, lon) {
  const a = Math.abs(lat);
  /* Very simplified Köppen-like classification */
  if (a < 10)  return { zone: 'Tropical',       emoji: '🌴', desc: 'High humidity, abundant rainfall. Excellent solar potential. Hydro and biomass highly viable.' };
  if (a < 20)  return { zone: 'Savanna',         emoji: '🌾', desc: 'Distinct wet/dry seasons. Very high solar irradiance. Wind energy viable in coastal zones.' };
  if (a < 30) {
    /* Distinguish arid vs humid by rough longitude heuristic */
    if ((lon > -20 && lon < 60) || (lon > 100)) {
      return { zone: 'Arid / Desert',    emoji: '🏜️', desc: 'Exceptional solar resource. Very low humidity. PV and concentrated solar power are optimal.' };
    }
    return { zone: 'Subtropical',        emoji: '🌤️', desc: 'Warm climate with high solar hours. PV panels offer outstanding ROI in this zone.' };
  }
  if (a < 40)  return { zone: 'Mediterranean',   emoji: '🌊', desc: 'Mild winters, hot dry summers. Excellent solar resource. Wind energy viable near coasts.' };
  if (a < 50)  return { zone: 'Temperate',        emoji: '🌧️', desc: 'Moderate solar, good wind resources. Hybrid solar + wind setup recommended.' };
  if (a < 60)  return { zone: 'Continental',      emoji: '❄️', desc: 'Strong seasonal variation. Focus on wind energy and thermal optimization in winter.' };
  return         { zone: 'Subarctic / Polar',  emoji: '🧊', desc: 'Limited solar in winter. Wind energy is the primary renewable resource. Geothermal viable.' };
}

function getWindPotential(lat, lon) {
  const a = Math.abs(lat);
  /* High wind zones: >40° lat, coastal areas, plains */
  let score;
  if (a > 50) score = 85;
  else if (a > 40) score = 70;
  else if (a > 30) score = 50;
  else if (a > 20) score = 35;
  else score = 25;

  /* Rough coastal bonus (longitudes near ocean edges) */
  const isCoastal = (lon < -60 || lon > 100 || (lon > -15 && lon < 5));
  if (isCoastal) score = Math.min(score + 20, 95);

  let label, cls;
  if (score >= 75) { label = 'High';        cls = 'rec-best'; }
  else if (score >= 50) { label = 'Moderate';    cls = 'rec-good'; }
  else if (score >= 30) { label = 'Low-Moderate'; cls = 'rec-fair'; }
  else                  { label = 'Low';          cls = 'rec-low'; }

  const descs = {
    'High':         'Strong, consistent winds. Wind turbines highly cost-effective.',
    'Moderate':     'Seasonal wind energy viable. Suitable for small to mid turbines.',
    'Low-Moderate': 'Limited wind. Micro-turbines may supplement solar.',
    'Low':          'Wind energy not economical. Focus on solar & other sources.',
  };

  return { score, label, cls, desc: descs[label] };
}

function getHydroPotential(lat) {
  const a = Math.abs(lat);
  let score, label, cls, desc;
  if (a < 15) { score=80; label='High';    cls='rec-best'; desc='Tropical rainfall supports micro-hydro generation.'; }
  else if (a < 30) { score=40; label='Moderate'; cls='rec-fair'; desc='Seasonal rivers may support small hydro systems.'; }
  else if (a < 50) { score=55; label='Moderate'; cls='rec-good'; desc='Temperate rivers & streams suitable for run-of-river hydro.'; }
  else { score=35; label='Low'; cls='rec-low'; desc='Cold climate limits hydro to summer months only.'; }
  return { score, label, cls, desc };
}

function getGeothermal(lat) {
  const a = Math.abs(lat);
  /* Active zones: Iceland, NZ, Japan, western Americas, east Africa */
  let score = 30, label, cls, desc;
  if (a > 60) { score = 75; }        /* Nordic/Arctic — Iceland etc */
  else if (a > 40) { score = 45; }
  else { score = 25; }
  if (score >= 70) { label='High';     cls='rec-best'; desc='Active geothermal zone. Ground-source heat pumps & power plants viable.'; }
  else if (score >= 45) { label='Moderate'; cls='rec-fair'; desc='Ground-source heat pumps can offset heating/cooling loads significantly.'; }
  else { label='Low'; cls='rec-low'; desc='Deep geothermal drilling required. Focus on surface-level heat pumps for HVAC efficiency.'; }
  return { score, label, cls, desc };
}

function getOptimalOrientation(lat) {
  const absLat  = Math.abs(lat);
  const isNorth = lat >= 0;
  const tilt    = Math.round(absLat * 0.87 + 3);     /* Optimized fixed tilt */
  const azimuth = isNorth ? 180 : 0;                 /* Face equator */
  const aziLabel= isNorth ? '180° South' : '0° North';
  const peakSun = getSolarIrradiance(lat);
  const note = isNorth
    ? `Face panels due South (${aziLabel}) and tilt ${tilt}° from horizontal. In summer, reduce tilt by ~15° for optimal yield. In winter, increase tilt by ~15°.`
    : `Face panels due North (${aziLabel}) and tilt ${tilt}° from horizontal. Seasonal adjustment: +15° in winter, −15° in summer.`;
  return { tilt, azimuth, aziLabel, peakSun: peakSun.toFixed(1), note };
}

function computeEnergyMix(solar, wind, hydro, geo, climate) {
  const total = solar.score + wind.score + hydro.score + geo.score;
  const bars = [
    { label: '☀️ Solar PV',       pct: Math.round(solar.score / total * 100), color: 'linear-gradient(90deg,#f59e0b,#fcd34d)', score: solar.score },
    { label: '💨 Wind',            pct: Math.round(wind.score  / total * 100), color: 'linear-gradient(90deg,#3b82f6,#60a5fa)', score: wind.score },
    { label: '💧 Hydro',           pct: Math.round(hydro.score / total * 100), color: 'linear-gradient(90deg,#06b6d4,#67e8f9)', score: hydro.score },
    { label: '🌋 Geothermal',      pct: Math.round(geo.score   / total * 100), color: 'linear-gradient(90deg,#a855f7,#c084fc)', score: geo.score },
  ].sort((a,b) => b.pct - a.pct);

  /* Normalize to 100% */
  const pctSum = bars.reduce((s,b) => s+b.pct, 0);
  if (pctSum !== 100) bars[0].pct += (100 - pctSum);

  const best = bars[0];
  const second = bars[1];
  const rec = `Based on ${climate.zone} climate at this location, ${best.label.replace(/[^\w\s]/g,'')} is your dominant renewable resource (${best.pct}% of mix). Combine with ${second.label.replace(/[^\w\s]/g,'')} (${second.pct}%) for a resilient hybrid system. Estimated self-sufficiency with this mix: ${Math.min(95, Math.round((best.score + second.score) / 2))}%.`;

  return { bars, rec };
}

/* ── Animation helpers ───────────────────────────────────────────────────── */
function buildSunRays() {
  const wrap = document.getElementById('sun-rays');
  wrap.innerHTML = '';
  const count = 8;
  for (let i = 0; i < count; i++) {
    const ray = document.createElement('div');
    ray.className = 'sun-ray';
    const angle = (360 / count) * i;
    ray.style.cssText = `
      position:absolute; width:3px; border-radius:2px;
      background:linear-gradient(to bottom,#fcd34d,rgba(252,211,77,0));
      left:50%; margin-left:-1.5px; top:2px;
      height:${14 + (i % 3) * 4}px;
      transform-origin:1.5px ${50}px;
      transform:rotate(${angle}deg);
    `;
    wrap.appendChild(ray);
  }
}

function buildWindLines() {
  const wrap = document.getElementById('wind-wrap');
  wrap.innerHTML = '';
  const widths = [100, 80, 65, 90, 70];
  const tops   = [12, 28, 44, 58, 72];
  const delays = [0, 0.4, 0.8, 0.2, 1.0];
  widths.forEach((w, i) => {
    const line = document.createElement('div');
    line.className = 'wind-stream';
    line.style.cssText = `
      top:${tops[i]}%; width:${w}%; left:${(100-w)/2}%;
      animation-delay:${delays[i]}s;
      animation-duration:${2.4 + i * 0.3}s;
    `;
    wrap.appendChild(line);
  });
}

function buildWaterDrops() {
  const wrap = document.getElementById('water-wrap');
  for (let i = 0; i < 4; i++) {
    const drop = document.createElement('div');
    drop.className = 'water-drops';
    drop.style.cssText = `left:${15 + i*20}%;animation-delay:${i*0.5}s;`;
    wrap.appendChild(drop);
  }
}

function animatePanelTilt(tilt) {
  const panel = document.getElementById('panel-3d');
  if (!panel) return;
  panel.style.transform = `rotateX(0deg)`;
  setTimeout(() => {
    panel.style.transition = 'transform 1.4s cubic-bezier(.34,1.2,.64,1)';
    panel.style.transform  = `rotateX(-${tilt}deg)`;
  }, 100);
}

function renderScoreBadge(el, cls, label) {
  el.className = `recommendation-badge ${cls}`;
  el.textContent = label;
}

function renderMixBars(bars) {
  const el = document.getElementById('mix-bars');
  el.innerHTML = '';
  bars.forEach(b => {
    el.innerHTML += `
      <div class="mix-bar">
        <div class="mix-bar-label">
          <span>${b.label}</span>
          <span>${b.pct}%</span>
        </div>
        <div class="mix-track">
          <div class="mix-fill" data-width="${b.pct}" style="background:${b.color}"></div>
        </div>
      </div>`;
  });
  /* Animate fills */
  setTimeout(() => {
    el.querySelectorAll('.mix-fill').forEach(f => {
      f.style.width = f.dataset.width + '%';
    });
  }, 120);
}

/* ── Geocoding ───────────────────────────────────────────────────────────── */
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data.length === 0) return null;
    return {
      lat:          parseFloat(data[0].lat),
      lon:          parseFloat(data[0].lon),
      display_name: data[0].display_name,
    };
  } catch (e) {
    return null;
  }
}

/* ── Render results ──────────────────────────────────────────────────────── */
function showResults(loc) {
  const { lat, lon } = loc;

  const climate = getClimateZone(lat, lon);
  const solar   = { score: Math.round(getSolarIrradiance(lat) / 6.1 * 100), irr: getSolarIrradiance(lat) };
  const wind    = getWindPotential(lat, lon);
  const hydro   = getHydroPotential(lat);
  const geo     = getGeothermal(lat);
  const orient  = getOptimalOrientation(lat);
  const mix     = computeEnergyMix(solar, wind, hydro, geo, climate);

  /* Climate */
  document.getElementById('res-climate-badge').textContent = `${climate.emoji} ${climate.zone}`;
  document.getElementById('res-climate-desc').textContent  = climate.desc;

  /* Solar */
  document.getElementById('res-solar-score').textContent = solar.score + '/100';
  document.getElementById('res-solar-irr').textContent   = solar.irr.toFixed(1) + ' kWh/m²/day avg irradiance';
  const solarCls = solar.score >= 80 ? 'rec-best' : solar.score >= 60 ? 'rec-good' : solar.score >= 40 ? 'rec-fair' : 'rec-low';
  const solarLbl = solar.score >= 80 ? 'Excellent' : solar.score >= 60 ? 'Good' : solar.score >= 40 ? 'Moderate' : 'Low';
  renderScoreBadge(document.getElementById('res-solar-badge'), solarCls, solarLbl);

  /* Wind */
  document.getElementById('res-wind-score').textContent = wind.score + '/100';
  document.getElementById('res-wind-desc').textContent  = wind.desc;
  renderScoreBadge(document.getElementById('res-wind-badge'), wind.cls, wind.label);

  /* Hydro */
  document.getElementById('res-hydro-score').textContent = hydro.score + '/100';
  document.getElementById('res-hydro-desc').textContent  = hydro.desc;
  renderScoreBadge(document.getElementById('res-hydro-badge'), hydro.cls, hydro.label);

  /* Geo */
  document.getElementById('res-geo-score').textContent = geo.score + '/100';
  document.getElementById('res-geo-desc').textContent  = geo.desc;
  renderScoreBadge(document.getElementById('res-geo-badge'), geo.cls, geo.label);

  /* Panel orientation */
  document.getElementById('res-tilt').textContent        = orient.tilt + '°';
  document.getElementById('res-azimuth').textContent     = orient.aziLabel;
  document.getElementById('res-peak-sun').textContent    = orient.peakSun + ' h';
  document.getElementById('res-orient-note').textContent = orient.note;

  /* Mix */
  renderMixBars(mix.bars);
  document.getElementById('res-recommendation').textContent = mix.rec;

  /* Panel 3D animation */
  animatePanelTilt(orient.tilt);

  /* Animations */
  buildSunRays();
  buildWindLines();
  buildWaterDrops();

  /* Show */
  document.getElementById('adv-empty').style.display   = 'none';
  document.getElementById('adv-loading').style.display = 'none';
  const resEl = document.getElementById('adv-results');
  resEl.style.display = 'block';
  resEl.style.animation = 'fade-up .5s cubic-bezier(.4,0,.2,1)';

  /* Trigger reveal for newly shown elements */
  setTimeout(() => initReveal && initReveal(), 50);

  showToast('Analysis complete for ' + loc.display_name.split(',')[0], 'success');
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const geocodeBtn = document.getElementById('geocode-btn');
  const locationInput = document.getElementById('adv-location');
  const analyzeBtn = document.getElementById('analyze-btn');

  let currentLocation = null;

  async function doGeocode() {
    const q = locationInput.value.trim();
    if (!q) { showToast('Enter a city or address first', 'error'); return; }
    geocodeBtn.disabled = true;
    geocodeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin-slow 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>';
    const result = await geocode(q);
    geocodeBtn.disabled = false;
    geocodeBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    if (!result) { showToast('Location not found — try a different query', 'error'); return; }
    currentLocation = result;
    const foundEl = document.getElementById('location-found');
    foundEl.style.display = 'flex';
    document.getElementById('location-name').textContent   = result.display_name.length > 50 ? result.display_name.slice(0, 50) + '…' : result.display_name;
    document.getElementById('location-coords').textContent = `${result.lat.toFixed(3)}°, ${result.lon.toFixed(3)}°`;
    showToast('Location found!', 'success');
  }

  geocodeBtn.addEventListener('click', doGeocode);
  locationInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doGeocode(); } });

  analyzeBtn.addEventListener('click', async () => {
    /* Auto-geocode if not done yet */
    if (!currentLocation) {
      const q = locationInput.value.trim();
      if (!q) { showToast('Please enter a location first', 'error'); return; }
      document.getElementById('adv-loading').style.display = 'block';
      document.getElementById('adv-empty').style.display   = 'none';
      const result = await geocode(q);
      if (!result) {
        document.getElementById('adv-loading').style.display = 'none';
        document.getElementById('adv-empty').style.display   = 'block';
        showToast('Location not found', 'error'); return;
      }
      currentLocation = result;
      document.getElementById('location-found').style.display = 'flex';
      document.getElementById('location-name').textContent    = result.display_name.slice(0, 50);
      document.getElementById('location-coords').textContent  = `${result.lat.toFixed(3)}°, ${result.lon.toFixed(3)}°`;
    } else {
      document.getElementById('adv-loading').style.display = 'block';
      document.getElementById('adv-results').style.display  = 'none';
      document.getElementById('adv-empty').style.display    = 'none';
    }

    /* Simulate analysis delay for animation effect */
    setTimeout(() => showResults(currentLocation), 1200);
  });

  /* Default: pre-fill a city so user can see it works immediately */
  locationInput.value = 'Casablanca, Morocco';
});
