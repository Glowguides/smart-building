# Smart Building Platform

A static website for smart building energy analysis — no backend, no build step, pure HTML/CSS/JavaScript.

**Live demo:** deploy to GitHub Pages in 30 seconds (see below).

---

## Pages

| Page | File | Description |
|------|------|-------------|
| Landing | `index.html` | Hero, features overview, tech stack |
| Dashboard | `dashboard.html` | Simulated live sensor data, charts, zone table |
| Thermal Calculator | `thermal.html` | Heat loss estimation, efficiency grade A–E |
| Solar ROI | `solar.html` | PV production, payback, 20-year ROI chart |
| Energy Report | `report.html` | Full report + PDF export (client-side) |

---

## Run locally

No install required. Just open any `.html` file in your browser:

```bash
# Option 1 — double-click index.html in File Explorer

# Option 2 — VS Code Live Server extension (recommended)
# Right-click index.html → "Open with Live Server"

# Option 3 — Python one-liner
python -m http.server 3000
# then open http://localhost:3000
```

---

## Deploy to GitHub Pages (free)

1. Create a new GitHub repository
2. Upload all files (drag & drop into GitHub UI, or use git):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smart-building.git
git push -u origin main
```

3. Go to **Settings → Pages → Source → Deploy from branch → main / root**
4. Your site is live at `https://YOUR_USERNAME.github.io/smart-building/`

---

## File structure

```
smart-building-website/
├── index.html          # Landing page
├── dashboard.html      # Sensor dashboard
├── thermal.html        # Thermal load calculator
├── solar.html          # Solar ROI calculator
├── report.html         # Energy report + PDF export
├── css/
│   └── style.css       # All styles (dark mode, layout, components)
└── js/
    ├── main.js         # Shared: dark mode, sidebar, helpers
    ├── dashboard.js    # Simulated sensor data + Chart.js
    ├── thermal.js      # Heat loss formulas + doughnut chart
    ├── solar.js        # Solar ROI formulas + line chart
    └── report.js       # Report engine + jsPDF export
```

---

## Formulas

### Thermal Load (ISO 13790 simplified)
```
U_wall     = 1 / (t_mat/λ_mat + t_ins/λ_ins + 0.17)
Q_walls    = U_wall × A_net_walls × ΔT          [W]
Q_windows  = 2.8 × A_windows × ΔT               [W]  (double glazed)
Q_vent     = 0.33 × 0.5 ACH × Volume × ΔT       [W]
Grade      : A(≥80) B(≥60) C(≥40) D(≥20) E(<20)  based on U-value score
```

### Solar ROI
```
P_peak     = roof_area × η_panel × 1 kW/m²      [kWp]
E_annual   = P_peak × sun_hours/day × 365 × 0.80 [kWh]
Payback    = system_cost / (E_annual × price)    [years]
CO₂ saved  = E_annual × 0.55 kg/kWh             [kg/yr]
```

---

## CDN libraries used (no npm needed)

- [Chart.js 4.4](https://cdn.jsdelivr.net/npm/chart.js) — dashboard & calculator charts
- [jsPDF 2.5](https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js) — PDF export
- [Google Fonts — Inter](https://fonts.google.com/specimen/Inter)
