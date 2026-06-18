/* ═══════════════════════════════════════════════════════════════════════════
   Smart Building Platform — Claude chatbot proxy (Cloudflare Worker)

   Holds the Anthropic API key as an encrypted secret (set via
   `wrangler secret put ANTHROPIC_API_KEY`). The browser never sees it.

   The browser POSTs { messages, context } here; this Worker runs an agentic
   tool-use loop against the Claude API (calculators + live data), then returns
   { reply }. CORS is locked to ALLOWED_ORIGINS below.
   ═══════════════════════════════════════════════════════════════════════════ */

const MODEL = "claude-opus-4-8";

// Lock CORS to your site. Add your custom domain here too if you have one.
const ALLOWED_ORIGINS = [
  "https://glowguides.github.io",
  "http://localhost:4201",
  "http://localhost:4200",
];

/* ── Tool definitions exposed to Claude ─────────────────────────────────────── */
const TOOLS = [
  {
    name: "solar_roi",
    description:
      "Estimate solar PV production, annual savings, payback period and ROI for a rooftop system. Use when the user asks about solar panels, PV, payback, or whether solar is worth it.",
    input_schema: {
      type: "object",
      properties: {
        irradiance_kwh_m2_day: { type: "number", description: "Daily solar irradiance in kWh/m²/day. Casablanca≈5.2, Marrakech≈5.8, Agadir≈6.0, Paris≈3.0, Dubai≈5.9. Default 5.2 if unknown." },
        roof_area_m2: { type: "number", description: "Available roof area in m²" },
        panel_efficiency: { type: "number", description: "Panel efficiency 0-1, default 0.20" },
        price_per_kwh: { type: "number", description: "Electricity price in MAD/kWh, default 1.20" },
        system_cost: { type: "number", description: "Total system cost in MAD, default 80000" },
      },
      required: ["roof_area_m2"],
    },
  },
  {
    name: "thermal_load",
    description:
      "Estimate building heat loss and a simple efficiency grade using a simplified ISO 13790 steady-state model. Use for heating/cooling load, insulation, or thermal efficiency questions.",
    input_schema: {
      type: "object",
      properties: {
        floor_area_m2: { type: "number", description: "Heated floor area in m²" },
        wall_u_value: { type: "number", description: "Average wall U-value W/m²K (well-insulated≈0.3, average≈1.0, poor≈2.0). Default 1.0" },
        window_area_m2: { type: "number", description: "Total window area m². Default 15% of floor area" },
        indoor_temp_c: { type: "number", description: "Target indoor temp °C, default 21" },
        outdoor_temp_c: { type: "number", description: "Design outdoor temp °C, default 5" },
      },
      required: ["floor_area_m2"],
    },
  },
  {
    name: "building_advisor",
    description:
      "Given a location name, geocode it and return the climate zone, optimal solar panel orientation (tilt + azimuth), and a ranked renewable-energy mix (solar/wind/hydro/geothermal) adapted to geography and climate. Use when the user asks what energy source suits a location or building.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or address, e.g. 'Marrakech, Morocco'" },
      },
      required: ["location"],
    },
  },
  {
    name: "get_live_building_data",
    description:
      "Return the current simulated live sensor readings for the demo building (per-zone temperature, humidity, occupancy, HVAC/lighting load, totals). Use for questions about current building status, load, or which zone uses the most energy.",
    input_schema: { type: "object", properties: {} },
  },
];

/* ── Tool implementations (ported from the site's own JS) ───────────────────── */
function sinWave(h, base, amp, peak = 14) {
  return base + amp * Math.sin((Math.PI * (h - peak + 12)) / 12);
}
function rand(a, b) { return Math.random() * (b - a) + a; }

function toolSolarRoi(a) {
  const irr = a.irradiance_kwh_m2_day ?? 5.2;
  const area = a.roof_area_m2;
  const eff = a.panel_efficiency ?? 0.2;
  const price = a.price_per_kwh ?? 1.2;
  const cost = a.system_cost ?? 80000;
  const pPeak = area * eff;                 // kWp  (area × η × 1kW/m²)
  const eAnnual = pPeak * irr * 365 * 0.8;  // kWh/yr (PR 0.80)
  const savings = eAnnual * price;
  const payback = savings > 0 ? cost / savings : Infinity;
  const roi20 = ((savings * 20 - cost) / cost) * 100;
  const co2 = eAnnual * 0.55;
  return {
    peak_power_kwp: +pPeak.toFixed(2),
    annual_production_kwh: Math.round(eAnnual),
    annual_savings_mad: Math.round(savings),
    payback_years: +payback.toFixed(1),
    roi_20yr_pct: Math.round(roi20),
    co2_saved_kg_yr: Math.round(co2),
    irradiance_used: irr,
  };
}

function toolThermalLoad(a) {
  const area = a.floor_area_m2;
  const uWall = a.wall_u_value ?? 1.0;
  const winArea = a.window_area_m2 ?? area * 0.15;
  const tIn = a.indoor_temp_c ?? 21;
  const tOut = a.outdoor_temp_c ?? 5;
  const dT = tIn - tOut;
  // crude envelope: walls ~ perimeter×3m height, roof = floor area
  const wallArea = Math.sqrt(area) * 4 * 3;
  const uWin = 2.8, uRoof = 0.4;
  const qFabric = (uWall * (wallArea - winArea) + uWin * winArea + uRoof * area) * dT; // W
  const qVent = 0.33 * (area * 2.5) * 0.5 * dT; // W (0.5 ACH)
  const totalW = qFabric + qVent;
  const perM2 = totalW / area;
  const grade = perM2 < 30 ? "A" : perM2 < 50 ? "B" : perM2 < 80 ? "C" : perM2 < 120 ? "D" : "E";
  return {
    total_heat_loss_w: Math.round(totalW),
    heat_loss_per_m2_w: Math.round(perM2),
    annual_heating_kwh_est: Math.round((totalW * 1800) / 1000), // ~1800 equivalent full-load hrs
    efficiency_grade: grade,
    delta_t_c: dT,
  };
}

function getClimateZone(lat, lon) {
  const a = Math.abs(lat);
  if (a < 10) return { zone: "Tropical", emoji: "🌴", desc: "Hot, humid year-round" };
  if (a < 20) return { zone: "Savanna / Tropical", emoji: "🌾", desc: "Hot with wet & dry seasons" };
  if (a < 30) return { zone: "Arid / Subtropical", emoji: "🏜️", desc: "Hot, dry, high solar potential" };
  if (a < 38) return { zone: "Mediterranean", emoji: "🫒", desc: "Mild wet winters, hot dry summers" };
  if (a < 50) return { zone: "Temperate", emoji: "🌳", desc: "Four distinct seasons" };
  if (a < 60) return { zone: "Continental", emoji: "🌲", desc: "Cold winters, warm summers" };
  return { zone: "Subarctic", emoji: "❄️", desc: "Long cold winters, low sun" };
}
function getSolarIrradiance(lat) {
  const a = Math.abs(lat);
  if (a < 15) return 5.8; if (a < 25) return 6.0; if (a < 35) return 5.4;
  if (a < 45) return 4.3; if (a < 55) return 3.2; return 2.2;
}

async function toolBuildingAdvisor(a) {
  const q = encodeURIComponent(a.location);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en", "User-Agent": "SmartBuildingPlatform/1.0" } });
  const data = await res.json();
  if (!data || !data.length) return { error: `Could not find location "${a.location}".` };
  const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
  const climate = getClimateZone(lat, lon);
  const irr = getSolarIrradiance(lat);
  const tilt = +(Math.abs(lat) * 0.87 + 3).toFixed(0);
  const azimuth = lat >= 0 ? "180° (face South)" : "0° (face North)";

  const absLat = Math.abs(lat);
  const solarScore = Math.round(Math.min(98, irr / 6.1 * 100));
  const windScore = Math.round(Math.min(95, 35 + (absLat > 40 ? 30 : 10) + rand(0, 15)));
  const hydroScore = Math.round(absLat > 35 && absLat < 60 ? 60 + rand(0, 20) : 30 + rand(0, 15));
  const geoScore = Math.round(absLat > 60 || absLat < 12 ? 70 : 35 + rand(0, 15));
  const mix = [
    { source: "Solar", score: solarScore },
    { source: "Wind", score: windScore },
    { source: "Hydro", score: hydroScore },
    { source: "Geothermal", score: geoScore },
  ].sort((x, y) => y.score - x.score);
  const total = mix.reduce((s, m) => s + m.score, 0);
  mix.forEach(m => (m.share_pct = Math.round((m.score / total) * 100)));

  return {
    resolved_location: data[0].display_name,
    latitude: +lat.toFixed(2),
    longitude: +lon.toFixed(2),
    climate_zone: climate.zone,
    climate_desc: climate.desc,
    solar_irradiance_kwh_m2_day: irr,
    optimal_panel_tilt_deg: tilt,
    optimal_panel_azimuth: azimuth,
    recommended_energy_mix: mix,
    best_source: mix[0].source,
  };
}

function toolLiveBuildingData() {
  const ZONES = ["Office A", "Server Room", "Lobby", "Meeting Room", "Rooftop"];
  const h = new Date().getHours();
  const zones = ZONES.map((zone) => {
    const hvac = +(Math.abs(sinWave(h, 3, 2)) + rand(0, 0.5)).toFixed(2);
    const light = +Math.max(0, sinWave(h, 1, 0.8, 13) + rand(0, 0.1)).toFixed(2);
    return {
      zone,
      temperature_c: +(sinWave(h, 22, 3) + rand(-0.5, 0.5)).toFixed(1),
      humidity_pct: Math.round(Math.max(20, Math.min(90, sinWave(h, 50, 10, 6) + rand(-2, 2)))),
      occupancy_pct: Math.round(Math.max(0, Math.min(100, sinWave(h, 50, 45, 12) + rand(-5, 5)))),
      hvac_kw: hvac, lighting_kw: light, total_kw: +(hvac + light).toFixed(2),
    };
  });
  const totalLoad = +zones.reduce((s, z) => s + z.total_kw, 0).toFixed(2);
  return { local_time: new Date().toLocaleTimeString(), zones, total_load_kw: totalLoad };
}

async function runTool(name, input) {
  switch (name) {
    case "solar_roi": return toolSolarRoi(input);
    case "thermal_load": return toolThermalLoad(input);
    case "building_advisor": return await toolBuildingAdvisor(input);
    case "get_live_building_data": return toolLiveBuildingData();
    default: return { error: `Unknown tool ${name}` };
  }
}

/* ── System prompt ──────────────────────────────────────────────────────────── */
function systemPrompt(context) {
  return `You are the "Building Assistant" — a friendly, expert energy & sustainability advisor embedded in the Smart Building Platform, a web app for analyzing building energy.

The site has these pages (link with relative paths so they work on GitHub Pages):
- dashboard.html — live sensor dashboard (energy load, zones, source mix, efficiency)
- thermal.html — thermal load calculator
- solar.html — solar ROI calculator
- advisor.html — building energy advisor (location → best energy source + panel orientation)
- report.html — PDF energy report generator

You can DO things, not just describe them, using your tools:
- solar_roi — run a real solar payback calculation
- thermal_load — estimate heat loss & efficiency grade
- building_advisor — geocode a location and recommend the optimal energy mix + panel orientation
- get_live_building_data — read the demo building's current live sensor readings

Guidance:
- When a question maps to a tool, CALL THE TOOL and report concrete numbers rather than guessing.
- Be concise and practical. Use short paragraphs or tight bullet lists. Lead with the answer.
- Currency is MAD (Moroccan Dirham) by default. Use metric units.
- When pointing users to a feature, mention the page by name and that they can open it from the sidebar.
- For general green-building questions, answer directly with accurate, current knowledge.
- If you lack a required detail for a calculation, ask one brief clarifying question, or state the sensible default you're assuming and proceed.

Current page the user is on: ${context?.page || "unknown"}.`;
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
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return json({ error: "POST only" }, 405, cors);
    if (!env.ANTHROPIC_API_KEY)
      return json({ error: "Server not configured: missing ANTHROPIC_API_KEY secret." }, 500, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400, cors); }

    const userMessages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    if (!userMessages.length) return json({ error: "No messages provided" }, 400, cors);

    const messages = userMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 8000),
    }));

    const sys = systemPrompt(body.context);

    try {
      // Agentic loop: keep going while Claude calls tools (cap iterations).
      for (let i = 0; i < 6; i++) {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 1500,
            system: sys,
            tools: TOOLS,
            messages,
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          return json({ error: `Claude API ${resp.status}`, detail: txt.slice(0, 500) }, 502, cors);
        }

        const data = await resp.json();

        if (data.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content: data.content });
          const results = [];
          for (const block of data.content) {
            if (block.type === "tool_use") {
              const out = await runTool(block.name, block.input || {});
              results.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(out),
              });
            }
          }
          messages.push({ role: "user", content: results });
          continue; // let Claude read the results
        }

        // Final answer
        const reply = (data.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return json({ reply: reply || "(no response)" }, 200, cors);
      }
      return json({ reply: "Sorry — that took too many steps. Try rephrasing?" }, 200, cors);
    } catch (err) {
      return json({ error: "Worker error", detail: String(err).slice(0, 300) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
