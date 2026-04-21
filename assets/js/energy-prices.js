/* energy-prices.js
   Reads energy data from Firebase and renders a 2x3 grid of charts.
   Data source: U.S. Energy Information Administration (EIA)
*/

const EnergyPrices = (() => {

  const DATABASE_URL = "https://github-page-edfd8-default-rtdb.asia-southeast1.firebasedatabase.app";

  // ── chart colour palette ─────────────────────────────────────────────────
  const COLORS = {
    brent:        { line: "#BA7517", fill: "rgba(186,117,23,0.07)"   },
    henry_hub:    { line: "#534AB7", fill: "rgba(83,74,183,0.07)"    },
    gasoline:     { line: "#D85A30", fill: "rgba(216,90,48,0.07)"    },
    diesel:       { line: "#0F6E56", fill: "rgba(15,110,86,0.07)"    },
    crude_stocks: { line: "#378ADD", fill: "rgba(55,138,221,0.07)"   },
    gas_storage:  { line: "#1D9E75", fill: "rgba(29,158,117,0.07)"   },
  };

  // ── Firebase fetch ───────────────────────────────────────────────────────

  async function fetchPrices() {
    const url = `${DATABASE_URL}/energy/prices.json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Firebase error: ${resp.status}`);
    return await resp.json();
  }

  // ── single chart builder ─────────────────────────────────────────────────

  function makeChart(canvas, series, colorKey, yLabel) {
    const points  = (series || []).filter(p => p.value !== null);
    const labels  = points.map(p => {
      const d = new Date(p.date + "T12:00:00Z");
      return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    });
    const values  = points.map(p => p.value);
    const c       = COLORS[colorKey];

    const isDark    = matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
    const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

    return new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data:            values,
          borderColor:     c.line,
          backgroundColor: c.fill,
          fill:            true,
          tension:         0.3,
          pointRadius:     0,
          pointHoverRadius: 3,
          borderWidth:     1.5,
          spanGaps:        true,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction:         { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.raw.toFixed(2)} ${yLabel}`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              font: { size: 9 }, color: textColor,
              autoSkip: true, maxTicksLimit: 6, maxRotation: 0,
            },
            grid: { display: false },
          },
          y: {
            ticks: { font: { size: 9 }, color: textColor },
            grid:  { color: gridColor },
            title: { display: true, text: yLabel, font: { size: 9 }, color: textColor },
          },
        },
      },
    });
  }

  // ── grid cell builder ────────────────────────────────────────────────────

  function makeCell(title, colorKey, series, unitLabel, unitShort) {
    const cell = document.createElement("div");
    cell.style.cssText = "background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:8px;padding:12px 14px;";

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:baseline;gap:8px;margin-bottom:8px;";
    header.innerHTML = `
      <span style="font-size:12px;font-weight:500;color:var(--color-text-primary);">${title}</span>
      <span style="font-size:10px;color:var(--color-text-tertiary);">${unitLabel}</span>
    `;

    const chartWrap = document.createElement("div");
    chartWrap.style.cssText = "position:relative;width:100%;height:130px;";

    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${title} chart`);
    chartWrap.appendChild(canvas);

    cell.appendChild(header);
    cell.appendChild(chartWrap);

    // latest value badge
    const latest = (series || []).filter(p => p.value !== null).slice(-1)[0];
    if (latest) {
      const badge = document.createElement("div");
      badge.style.cssText = "margin-top:6px;font-size:11px;color:var(--color-text-secondary);";
      badge.textContent = `latest: ${latest.value.toFixed(2)} ${unitShort}  (${latest.date})`;
      cell.appendChild(badge);
    }

    return { cell, canvas, chartWrap };
  }

  // ── chart definitions ────────────────────────────────────────────────────

  function chartDefs(data) {
    return [
      {
        key:       "brent",
        title:     "Brent crude",
        unitLabel: "USD / barrel",
        unitShort: "$/bbl",
        series:    data.brent?.series,
      },
      {
        key:       "henry_hub",
        title:     "Henry Hub gas",
        unitLabel: "USD / MMBtu",
        unitShort: "$/MMBtu",
        series:    data.henry_hub?.series,
      },
      {
        key:       "gasoline",
        title:     "US gasoline (regular)",
        unitLabel: "USD / gallon",
        unitShort: "$/gal",
        series:    data.gasoline?.series,
      },
      {
        key:       "diesel",
        title:     "US diesel",
        unitLabel: "USD / gallon",
        unitShort: "$/gal",
        series:    data.diesel?.series,
      },
      {
        key:       "crude_stocks",
        title:     "Crude oil stocks",
        unitLabel: "thousand barrels",
        unitShort: "kb",
        series:    data.crude_stocks?.series,
      },
      {
        key:       "gas_storage",
        title:     "Natural gas storage",
        unitLabel: "Bcf",
        unitShort: "Bcf",
        series:    data.gas_storage?.series,
      },
    ];
  }

  // ── main render ──────────────────────────────────────────────────────────

  function renderError(container) {
    container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);padding:1rem 0;">Energy prices unavailable.</p>`;
  }

  async function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <h2 style="font-size:18px;font-weight:500;margin-bottom:1.25rem;">Energy</h2>
      <div id="ep-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0.75rem;"></div>
      <div style="font-size:11px;color:var(--color-text-tertiary);" id="ep-updated"></div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:2px;">source: U.S. Energy Information Administration (EIA)</div>
    `;

    if (!window.Chart) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    try {
      const data = await fetchPrices();
      if (!data) { renderError(container); return; }

      const grid = container.querySelector("#ep-grid");
      const defs = chartDefs(data);

      for (const def of defs) {
        const { cell, canvas } = makeCell(def.title, def.key, def.series, def.unitLabel, def.unitShort);
        grid.appendChild(cell);
        // defer chart render slightly so layout is settled
        setTimeout(() => makeChart(canvas, def.series, def.key, def.unitShort), 0);
      }

      if (data.generated_at) {
        const updatedAt = new Date(data.generated_at).toLocaleString("en-GB", {
          timeZone: "Europe/Budapest", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
        container.querySelector("#ep-updated").textContent = `updated: ${updatedAt}`;
      }

    } catch (err) {
      console.error("EnergyPrices error:", err);
      renderError(container);
    }
  }

  return { init };

})();