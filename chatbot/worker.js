/* ═══════════════════════════════════════════════════════════════════════════
   Smart Building Platform — chatbot proxy (Cloudflare Worker, Google Gemini)

   Holds the Gemini API key as an encrypted secret (set via
   `wrangler secret put GEMINI_API_KEY`). The browser never sees it.

   Uses Google's FREE Gemini API tier (no credit card). The browser POSTs
   { messages, context } here; this Worker runs a function-calling loop against
   Gemini (calculators + live data), then returns { reply }. CORS is locked to
   ALLOWED_ORIGINS below.

   Get a free key: https://aistudio.google.com  →  "Get API key"
   ═══════════════════════════════════════════════════════════════════════════ */

const MODEL = "gemini-2.5-flash"; // free-tier model; "gemini-2.0-flash" also works

const ALLOWED_ORIGINS = [
  "https://glowguides.github.io",
  "http://localhost:4201",
  "http://localhost:4200",
];

/* ── Tool (function) declarations for Gemini ────────────────────────────────── */
const FUNCTION_DECLARATIONS = [
  {
    name: "solar_roi",
    description:
      "Estimate solar PV production, annual savings, payback period and ROI for a rooftop system. Use when the user asks about solar panels, PV, payback, or whether solar is worth it.",
    parameters: {
      type: "OBJECT",
      properties: {
        irradiance_kwh_m2_day: { type: "NUMBER", description: "Daily solar irradiance kWh/m²/day. Casablanca≈5.2, Marrakech≈5.8, Agadir≈6.0, Paris≈3.0, Dubai≈5.9. Default 5.2." },
        roof_area_m2: { type: "NUMBER", description: "Available roof area in m²" },
        panel_efficiency: { type: "NUMBER", description: "Panel efficiency 0-1, default 0.20" },
        price_per_kwh: { type: "NUMBER", description: "Electricity price MAD/kWh, default 1.20" },
        system_cost: { type: "NUMBER", description: "Total system cost MAD, default 80000" },
      },
      required: ["roof_area_m2"],
    },
  },
  {
    name: "thermal_load",
    description:
      "Estimate building heat loss and a simple efficiency grade using a simplified ISO 13790 steady-state model. Use for heating/cooling load, insulation, or thermal efficiency questions.",
    parameters: {
      type: "OBJECT",
      properties: {
        floor_area_m2: { type: "NUMBER", description: "Heated floor area m²" },
        wall_u_value: { type: "NUMBER", description: "Wall U-value W/m²K (good≈0.3, average≈1.0, poor≈2.0). Default 1.0" },
        window_area_m2: { type: "NUMBER", description: "Total window area m². Default 15% of floor area" },
        indoor_temp_c: { type: "NUMBER", description: "Target indoor temp °C, default 21" },
        outdoor_temp_c: { type: "NUMBER", description: "Design outdoor temp °C, default 5" },
      },
      required: ["floor_area_m2"],
    },
  },
  {
    name: "building_advisor",
    description:
      "Given a location name, geocode it and return the climate zone, REAL annual solar irradiance (via Open-Meteo), optimal panel tilt/azimuth, and a ranked renewable-energy mix. Use when the user asks what energy source suits a location or building.",
    parameters: {
      type: "OBJECT",
      properties: {
        location: { type: "STRING", description: "City or address, e.g. 'Marrakech, Morocco'" },
      },
      required: ["location"],
    },
  },
  {
    name: "get_live_building_data",
    description:
      "Return the current simulated live sensor readings for the demo building (per-zone temperature, humidity, occupancy, HVAC/lighting load, totals). Use for questions about current building status or load.",
    parameters: { type: "OBJECT", properties: {} },
  },
];

/* ── Tool implementations ───────────────────────────────────────────────────── */
function sinWave(h, base, amp, peak = 14) { return base + amp * Math.sin((Math.PI * (h - peak + 12)) / 12); }
function rand(a, b) { return Math.random() * (b - a) + a; }

function toolSolarRoi(a) {
  const irr = a.irradiance_kwh_m2_day ?? 5.2, area = a.roof_area_m2, eff = a.panel_efficiency ?? 0.2;
  const price = a.price_per_kwh ?? 1.2, cost = a.system_cost ?? 80000;
  const pPeak = area * eff, eAnnual = pPeak * irr * 365 * 0.8;
  const savings = eAnnual * price, payback = savings > 0 ? cost / savings : Infinity;
  return {
    peak_power_kwp: +pPeak.toFixed(2), annual_production_kwh: Math.round(eAnnual),
    annual_savings_mad: Math.round(savings), payback_years: +payback.toFixed(1),
    roi_20yr_pct: Math.round(((savings * 20 - cost) / cost) * 100),
    co2_saved_kg_yr: Math.round(eAnnual * 0.55), irradiance_used: irr,
  };
}

function toolThermalLoad(a) {
  const area = a.floor_area_m2, uWall = a.wall_u_value ?? 1.0, winArea = a.window_area_m2 ?? area * 0.15;
  const dT = (a.indoor_temp_c ?? 21) - (a.outdoor_temp_c ?? 5);
  const wallArea = Math.sqrt(area) * 4 * 3, uWin = 2.8, uRoof = 0.4;
  const qFabric = (uWall * (wallArea - winArea) + uWin * winArea + uRoof * area) * dT;
  const qVent = 0.33 * (area * 2.5) * 0.5 * dT;
  const totalW = qFabric + qVent, perM2 = totalW / area;
  const grade = perM2 < 30 ? "A" : perM2 < 50 ? "B" : perM2 < 80 ? "C" : perM2 < 120 ? "D" : "E";
  return {
    total_heat_loss_w: Math.round(totalW), heat_loss_per_m2_w: Math.round(perM2),
    annual_heating_kwh_est: Math.round((totalW * 1800) / 1000), efficiency_grade: grade, delta_t_c: dT,
  };
}

function getClimateZone(lat) {
  const a = Math.abs(lat);
  if (a < 10) return { zone: "Tropical", desc: "Hot, humid year-round" };
  if (a < 20) return { zone: "Savanna / Tropical", desc: "Hot with wet & dry seasons" };
  if (a < 30) return { zone: "Arid / Subtropical", desc: "Hot, dry, high solar potential" };
  if (a < 38) return { zone: "Mediterranean", desc: "Mild wet winters, hot dry summers" };
  if (a < 50) return { zone: "Temperate", desc: "Four distinct seasons" };
  if (a < 60) return { zone: "Continental", desc: "Cold winters, warm summers" };
  return { zone: "Subarctic", desc: "Long cold winters, low sun" };
}
function ruleIrradiance(lat) {
  const a = Math.abs(lat);
  if (a < 15) return 5.8; if (a < 25) return 6.0; if (a < 35) return 5.4;
  if (a < 45) return 4.3; if (a < 55) return 3.2; return 2.2;
}
async function fetchRealIrradiance(lat, lon) {
  try {
    const end = new Date(), start = new Date(); start.setFullYear(start.getFullYear() - 1);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=shortwave_radiation_sum,temperature_2m_mean&timezone=auto`;
    const r = await fetch(url); if (!r.ok) throw 0;
    const d = await r.json();
    const rad = (d.daily?.shortwave_radiation_sum || []).filter((v) => v != null);
    const temp = (d.daily?.temperature_2m_mean || []).filter((v) => v != null);
    if (!rad.length) throw 0;
    return {
      irradiance: +((rad.reduce((s, v) => s + v, 0) / rad.length) / 3.6).toFixed(2),
      mean_temp_c: temp.length ? +(temp.reduce((s, v) => s + v, 0) / temp.length).toFixed(1) : null,
      source: "Open-Meteo (live)",
    };
  } catch { return null; }
}

async function toolBuildingAdvisor(a) {
  const q = encodeURIComponent(a.location);
  const geo = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
    headers: { "Accept-Language": "en", "User-Agent": "SmartBuildingPlatform/1.0" },
  });
  const gd = await geo.json();
  if (!gd || !gd.length) return { error: `Could not find location "${a.location}".` };
  const lat = parseFloat(gd[0].lat), lon = parseFloat(gd[0].lon);
  const climate = getClimateZone(lat);
  const real = await fetchRealIrradiance(lat, lon);
  const irr = real ? real.irradiance : ruleIrradiance(lat);
  const tilt = +(Math.abs(lat) * 0.87 + 3).toFixed(0);
  const azimuth = lat >= 0 ? "180° (face South)" : "0° (face North)";
  const absLat = Math.abs(lat);
  const mix = [
    { source: "Solar", score: Math.round(Math.min(98, (irr / 6.1) * 100)) },
    { source: "Wind", score: Math.round(Math.min(95, 35 + (absLat > 40 ? 30 : 10) + rand(0, 15))) },
    { source: "Hydro", score: Math.round(absLat > 35 && absLat < 60 ? 60 + rand(0, 20) : 30 + rand(0, 15)) },
    { source: "Geothermal", score: Math.round(absLat > 60 || absLat < 12 ? 70 : 35 + rand(0, 15)) },
  ].sort((x, y) => y.score - x.score);
  const total = mix.reduce((s, m) => s + m.score, 0);
  mix.forEach((m) => (m.share_pct = Math.round((m.score / total) * 100)));
  return {
    resolved_location: gd[0].display_name, latitude: +lat.toFixed(2), longitude: +lon.toFixed(2),
    climate_zone: climate.zone, climate_desc: climate.desc,
    solar_irradiance_kwh_m2_day: irr, irradiance_source: real ? real.source : "latitude estimate",
    annual_mean_temp_c: real ? real.mean_temp_c : null,
    optimal_panel_tilt_deg: tilt, optimal_panel_azimuth: azimuth,
    recommended_energy_mix: mix, best_source: mix[0].source,
  };
}

function toolLiveBuildingData() {
  const ZONES = ["Office A", "Server Room", "Lobby", "Meeting Room", "Rooftop"];
  const h = new Date().getHours();
  const zones = ZONES.map((zone) => {
    const hvac = +(Math.abs(sinWave(h, 3, 2)) + rand(0, 0.5)).toFixed(2);
    const light = +Math.max(0, sinWave(h, 1, 0.8, 13) + rand(0, 0.1)).toFixed(2);
    return {
      zone, temperature_c: +(sinWave(h, 22, 3) + rand(-0.5, 0.5)).toFixed(1),
      humidity_pct: Math.round(Math.max(20, Math.min(90, sinWave(h, 50, 10, 6) + rand(-2, 2)))),
      occupancy_pct: Math.round(Math.max(0, Math.min(100, sinWave(h, 50, 45, 12) + rand(-5, 5)))),
      hvac_kw: hvac, lighting_kw: light, total_kw: +(hvac + light).toFixed(2),
    };
  });
  return { local_time: new Date().toLocaleTimeString(), zones, total_load_kw: +zones.reduce((s, z) => s + z.total_kw, 0).toFixed(2) };
}

async function runTool(name, args) {
  switch (name) {
    case "solar_roi": return toolSolarRoi(args || {});
    case "thermal_load": return toolThermalLoad(args || {});
    case "building_advisor": return await toolBuildingAdvisor(args || {});
    case "get_live_building_data": return toolLiveBuildingData();
    default: return { error: `Unknown tool ${name}` };
  }
}

/* ── System prompt ──────────────────────────────────────────────────────────── */
function systemPrompt(context) {
  return `You are the "Building Assistant" — a friendly, expert energy & sustainability advisor embedded in the Smart Building Platform, a web app for analyzing building energy.

The site has these pages (refer to them by name; they open from the sidebar):
- dashboard.html — live sensor dashboard
- thermal.html — thermal load calculator
- solar.html — solar ROI calculator
- advisor.html — building energy advisor (location → best energy source + panel orientation)
- report.html — PDF energy report generator

You can DO things using your functions:
- solar_roi — run a real solar payback calculation
- thermal_load — estimate heat loss & efficiency grade
- building_advisor — geocode a location and recommend the optimal energy mix + panel orientation (uses REAL live solar data)
- get_live_building_data — read the demo building's current live sensor readings

Guidance:
- When a question maps to a function, CALL IT and report concrete numbers rather than guessing.
- Be concise and practical. Lead with the answer; use short paragraphs or tight bullet lists.
- Currency is MAD (Moroccan Dirham) by default; use metric units.
- For general green-building questions, answer directly with accurate knowledge.
- If a required detail is missing, state the sensible default you're assuming and proceed.

The user is currently on page: ${context?.page || "unknown"}.`;
}

/* ── CORS ───────────────────────────────────────────────────────────────────── */
function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

/* ── Main handler ───────────────────────────────────────────────────────────── */
export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get("Origin") || "");
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (!env.GEMINI_API_KEY)
      return json({ error: "Server not configured: missing GEMINI_API_KEY secret." }, 500, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, cors); }

    const userMessages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    if (!userMessages.length) return json({ error: "No messages provided" }, 400, cors);

    // Build Gemini contents (roles: user / model)
    const contents = userMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 8000) }],
    }));

    const reqBody = {
      systemInstruction: { parts: [{ text: systemPrompt(body.context) }] },
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.7 },
      contents,
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    try {
      for (let i = 0; i < 6; i++) {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify(reqBody),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          return json({ error: `Gemini API ${resp.status}`, detail: txt.slice(0, 500) }, 502, cors);
        }

        const data = await resp.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const calls = parts.filter((p) => p.functionCall);

        if (calls.length) {
          // echo the model's function-call turn
          reqBody.contents.push({ role: "model", parts });
          // run tools, return responses
          const responseParts = [];
          for (const c of calls) {
            const out = await runTool(c.functionCall.name, c.functionCall.args);
            responseParts.push({ functionResponse: { name: c.functionCall.name, response: out } });
          }
          reqBody.contents.push({ role: "user", parts: responseParts });
          continue;
        }

        const reply = parts.filter((p) => p.text).map((p) => p.text).join("\n").trim();
        return json({ reply: reply || "(no response)" }, 200, cors);
      }
      return json({ reply: "Sorry — that took too many steps. Try rephrasing?" }, 200, cors);
    } catch (err) {
      return json({ error: "Worker error", detail: String(err).slice(0, 300) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}
