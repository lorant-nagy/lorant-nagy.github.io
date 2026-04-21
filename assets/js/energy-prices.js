/* energy-prices.js
   Reads Brent crude + Henry Hub natural gas daily prices from Firebase.
   Renders a 60-day dual-axis line chart.
   Data source: U.S. Energy Information Administration (EIA)
*/

const EnergyPrices = (() => {

  const DATABASE_URL = "https://github-page-edfd8-default-rtdb.asia-southeast1.firebasedatabase.app";
  const DISPLAY_DAYS = 60;

  let chart = null;

  // ── Firebase fetch ───────────────────────────────────────────────────────

  async function fetchPrices() {
    const url = `${DATABASE_URL}/energy/prices.json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Firebase error: ${resp.status}`);
    const data = await resp.json();
    return data || null;
  }

  // ── chart ────────────────────────────────────────────────────────────────

  function renderChart(canvas, series) {
    // take last DISPLAY_DAYS points, skip entries where both values are null
    const points = series
      .filter(p => p.brent !== null || p.gas !== null)
      .slice(-DISPLAY_DAYS);

    const labels     = points.map(p => {
      const d = new Date(p.date + "T12:00:00Z");
      return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    });
    const brentData  = points.map(p => p.brent ?? null);
    const gasData    = points.map(p => p.gas ?? null);

    const isDark    = matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Brent crude",
            data: brentData,
            borderColor: "#BA7517",
            backgroundColor: "rgba(186,117,23,0.07)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 1.5,
            spanGaps: true,
            yAxisID: "y",
          },
          {
            label: "Henry Hub gas",
            data: gasData,
            borderColor: "#534AB7",
            backgroundColor: "rgba(83,74,183,0.07)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 1.5,
            spanGaps: true,
            yAxisID: "y2",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { font: { size: 10 }, color: textColor, autoSkip: true, maxTicksLimit: 10, maxRotation: 0 },
            grid: { display: false },
          },
          y: {
            position: "left",
            title: { display: true, text: "Brent (USD/bbl)", font: { size: 11 }, color: "#BA7517" },
            ticks: { font: { size: 10 }, color: "#BA7517" },
            grid: { color: gridColor },
          },
          y2: {
            position: "right",
            title: { display: true, text: "Gas (USD/MMBtu)", font: { size: 11 }, color: "#534AB7" },
            ticks: { font: { size: 10 }, color: "#534AB7" },
            grid: { display: false },
          },
        },
      },
    });
  }

  // ── main render ──────────────────────────────────────────────────────────

  function renderError(container) {
    container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);padding:1rem 0;">Energy prices unavailable.</p>`;
  }

  async function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // skeleton
    container.innerHTML = `
      <h2 style="font-size:18px;font-weight:500;margin-bottom:0.5rem;">Energy prices</h2>
      <div style="display:flex;gap:18px;margin-bottom:8px;font-size:12px;color:var(--color-text-secondary);">
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:#BA7517;flex-shrink:0;"></span>Brent crude (left, USD/bbl)
        </span>
        <span style="display:flex;align-items:center;gap:5px;">
          <span style="width:10px;height:10px;border-radius:2px;background:#534AB7;flex-shrink:0;"></span>Henry Hub gas (right, USD/MMBtu)
        </span>
      </div>
      <div id="ep-chart-host" style="position:relative;width:100%;height:210px;margin-bottom:0.75rem;"></div>
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
      if (!data || !data.series || data.series.length === 0) {
        renderError(container);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "60-day chart of Brent crude and Henry Hub natural gas prices");
      container.querySelector("#ep-chart-host").appendChild(canvas);

      renderChart(canvas, data.series);

      if (data.generated_at) {
        const updatedAt = new Date(data.generated_at).toLocaleString("en-GB", {
          timeZone: "Europe/Budapest", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
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