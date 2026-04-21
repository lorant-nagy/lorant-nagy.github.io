/* arxiv-stats.js
   Reads arXiv daily data from Firebase, renders:
   - 30-day dual-axis time series (q-fin / q-bio)
   - paper list with 5-day navigation
*/

const ArxivStats = (() => {

  const DATABASE_URL = "https://github-page-edfd8-default-rtdb.asia-southeast1.firebasedatabase.app";
  const TIMESERIES_DAYS = 30;
  const NAV_DAYS = 5;

  // ── state ──────────────────────────────────────────────────────────────
  let allDays = {};        // { "2026-04-21": { q_fin_count, q_bio_count, q_fin, q_bio }, ... }
  let sortedKeys = [];     // date keys sorted ascending
  let navOffset = 0;       // 0 = today, -1 = yesterday, ..., -(NAV_DAYS-1)
  let chart = null;

  // ── date helpers ────────────────────────────────────────────────────────

  function budapestToday() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Budapest" });
  }

  function offsetKey(offset) {
    // returns the date key for navOffset days from the most recent available key
    const idx = sortedKeys.length - 1 + offset;
    return sortedKeys[Math.max(0, idx)] || null;
  }

  function friendlyDate(key, isLatest) {
    if (!key) return "—";
    const d = new Date(key + "T12:00:00Z");
    const label = d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
    return isLatest ? label + " (latest)" : label;
  }

  // ── Firebase fetch ───────────────────────────────────────────────────────

  async function fetchAllDays() {
    // We fetch the last max(TIMESERIES_DAYS, NAV_DAYS) days in one request
    // using Firebase's orderByKey + limitToLast
    const limit = Math.max(TIMESERIES_DAYS, NAV_DAYS) + 5; // small buffer
    const url = `${DATABASE_URL}/arxiv/daily.json?orderBy="$key"&limitToLast=${limit}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Firebase error: ${resp.status}`);
    const data = await resp.json();
    return data || {};
  }

  // ── chart ────────────────────────────────────────────────────────────────

  function buildChart(container) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;width:100%;height:210px;margin-bottom:1.75rem;";
    const canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "30-day time series of daily q-fin and q-bio arXiv paper counts");
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
    return canvas;
  }

  function renderChart(canvas) {
    // take last TIMESERIES_DAYS keys
    const keys = sortedKeys.slice(-TIMESERIES_DAYS);
    const labels = keys.map(k => {
      const d = new Date(k + "T12:00:00Z");
      return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    });
    const qfinData = keys.map(k => allDays[k]?.q_fin_count ?? 0);
    const qbioData = keys.map(k => allDays[k]?.q_bio_count ?? 0);

    const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "q-fin",
            data: qfinData,
            borderColor: "#378ADD",
            backgroundColor: "rgba(55,138,221,0.07)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 1.5,
            yAxisID: "y",
          },
          {
            label: "q-bio",
            data: qbioData,
            borderColor: "#1D9E75",
            backgroundColor: "rgba(29,158,117,0.07)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 1.5,
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
            title: { display: true, text: "q-fin", font: { size: 11 }, color: "#378ADD" },
            ticks: { font: { size: 10 }, color: "#378ADD" },
            grid: { color: gridColor },
            min: 0,
          },
          y2: {
            position: "right",
            title: { display: true, text: "q-bio", font: { size: 11 }, color: "#1D9E75" },
            ticks: { font: { size: 10 }, color: "#1D9E75" },
            grid: { display: false },
            min: 0,
          },
        },
      },
    });
  }

  // ── paper list ───────────────────────────────────────────────────────────

  function renderPaperList(listContainer, navContainer) {
    const key = offsetKey(navOffset);
    const isLatest = navOffset === 0;
    const day = key ? allDays[key] : null;

    // day label + nav buttons
    const minOffset = -(Math.min(NAV_DAYS, sortedKeys.length) - 1);
    navContainer.innerHTML = `
      <button id="ax-prev" style="background:none;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:3px 10px;font-size:12px;color:var(--color-text-secondary);cursor:pointer;" ${navOffset <= minOffset ? "disabled" : ""}>← prev</button>
      <span style="flex:1;text-align:center;font-size:12px;color:var(--color-text-secondary);">
        <b style="color:var(--color-text-primary);">${friendlyDate(key, isLatest)}</b>
        ${day ? `<span style="margin-left:8px;color:var(--color-text-tertiary);font-size:11px;">q-fin ${day.q_fin_count} · q-bio ${day.q_bio_count}</span>` : ""}
      </span>
      <button id="ax-next" style="background:none;border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:3px 10px;font-size:12px;color:var(--color-text-secondary);cursor:pointer;" ${navOffset >= 0 ? "disabled" : ""}>next →</button>
    `;

    navContainer.querySelector("#ax-prev")?.addEventListener("click", () => { navOffset--; renderPaperList(listContainer, navContainer); });
    navContainer.querySelector("#ax-next")?.addEventListener("click", () => { navOffset++; renderPaperList(listContainer, navContainer); });

    // papers
    if (!day) {
      listContainer.innerHTML = `<p style="font-size:13px;color:var(--color-text-tertiary);padding:1rem 0;">No data for this day.</p>`;
      return;
    }

    const makeList = (papers, cls) => {
      if (!papers || papers.length === 0)
        return `<p style="font-size:12px;color:var(--color-text-tertiary);">No papers.</p>`;
      return papers.map(p => `
        <div style="padding:6px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
          <div style="font-size:12px;line-height:1.4;">
            <span style="font-size:10px;font-weight:500;border-radius:3px;padding:1px 5px;margin-right:4px;background:var(--color-background-${cls});color:var(--color-text-${cls});">${p.primary_category}</span>
            <a href="${p.url}" target="_blank" rel="noopener" style="color:var(--color-text-primary);text-decoration:none;">${p.title}</a>
          </div>
          <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:2px;">${(p.authors || []).slice(0, 3).join(", ")}${(p.authors || []).length > 3 ? " et al." : ""}</div>
        </div>
      `).join("");
    };

    listContainer.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;">
        <div>
          <div style="font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem;">q-fin</div>
          ${makeList(day.q_fin, "info")}
        </div>
        <div>
          <div style="font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem;">q-bio</div>
          ${makeList(day.q_bio, "success")}
        </div>
      </div>
    `;
  }

  // ── main render ──────────────────────────────────────────────────────────

  function renderError(container) {
    container.innerHTML = `<p style="font-size:13px;color:var(--color-text-secondary);padding:1rem 0;">ArXiv stats unavailable.</p>`;
  }

  function buildSkeleton(container) {
    container.innerHTML = `
      <h2 style="font-size:18px;font-weight:500;margin-bottom:0.5rem;">ArXiv stats</h2>
      <div id="ax-meta" style="display:flex;gap:1.2rem;align-items:center;margin-bottom:1.25rem;font-size:12px;color:var(--color-text-secondary);flex-wrap:wrap;">
        <span id="ax-updated">loading…</span>
        <span id="ax-pill-fin" style="background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:99px;padding:2px 9px;"></span>
        <span id="ax-pill-bio" style="background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:99px;padding:2px 9px;"></span>
      </div>
      <div style="display:flex;gap:18px;margin-bottom:8px;font-size:12px;color:var(--color-text-secondary);">
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#378ADD;flex-shrink:0;"></span>q-fin (left)</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:#1D9E75;flex-shrink:0;"></span>q-bio (right)</span>
      </div>
      <div id="ax-chart-host"></div>
      <div style="border-top:0.5px solid var(--color-border-tertiary);padding-top:1rem;margin-top:0.25rem;">
        <div id="ax-nav" style="display:flex;align-items:center;gap:8px;padding-bottom:10px;"></div>
        <div id="ax-papers"></div>
      </div>
    `;
  }

  async function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    buildSkeleton(container);

    // load Chart.js dynamically if not already present
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
      allDays = await fetchAllDays();
      sortedKeys = Object.keys(allDays).sort();

      if (sortedKeys.length === 0) {
        renderError(container);
        return;
      }

      // update meta row using latest available day
      const latestKey = sortedKeys[sortedKeys.length - 1];
      const latest = allDays[latestKey];
      const updatedAt = latest.generated_at
        ? new Date(latest.generated_at).toLocaleString("en-GB", { timeZone: "Europe/Budapest", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : latestKey;

      container.querySelector("#ax-updated").textContent = `updated: ${updatedAt}`;
      container.querySelector("#ax-pill-fin").innerHTML = `q-fin today <b style="color:var(--color-text-primary);font-weight:500;">${latest.q_fin_count}</b>`;
      container.querySelector("#ax-pill-bio").innerHTML = `q-bio today <b style="color:var(--color-text-primary);font-weight:500;">${latest.q_bio_count}</b>`;

      // chart
      const chartCanvas = buildChart(container.querySelector("#ax-chart-host"));
      renderChart(chartCanvas);

      // paper list
      renderPaperList(
        container.querySelector("#ax-papers"),
        container.querySelector("#ax-nav")
      );

    } catch (err) {
      console.error("ArxivStats error:", err);
      renderError(container);
    }
  }

  return { init };

})();