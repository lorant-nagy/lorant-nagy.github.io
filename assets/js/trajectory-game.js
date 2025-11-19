// --- Grid configuration ---
let gridRows = 50;
let gridCols = 80;
let cellW, cellH;

// --- Time & market primitives ---
let terminalTime = 40; // t = 0..terminalTime
let currentTime = 0;

let assetPrice = [];       // AR(1) mid-price deviations
let depthSeries = [];      // depth[t]
let resilienceSeries = []; // resilience[t]

// min/max for chart scaling
let minPrice = 0, maxPrice = 0;
let minDepth = 0, maxDepth = 0;
let minRes = 0, maxRes = 0;

// AR(1) parameters (mirroring your Python idea)
const arParams = {
  alphaAp: 0.7,
  alphaDp: -0.6,
  alphaRe: -0.5,
  offsetDp: 6.0,
  offsetRe: 7.0
};

// --- Trading state ---
let basePriceLevel = 100.0; // center around 100
let currentPrice = basePriceLevel;
let currentDepth = 0.0;
let currentResilience = 0.0;

let initialCash = 1.0;
let initialInventory = 1.0;

let cash = initialCash;
let inventory = initialInventory;
let pnl = 0;

// animation control
let isRunning = false;
let stepFrames = 15; // frames between time steps (~0.5s at 30fps)

// --- Dynamic spread / friction (LinearSpread) ---
class LinearSpread {
  constructor() {
    this.zetaHistory = [0.0];
  }

  reset() {
    this.zetaHistory = [0.0];
  }

  // analog of __call__(action, depth, resilience)
  valueFor(action, depth, resilience) {
    const prevZeta = this.zetaHistory[this.zetaHistory.length - 1];
    const newZeta =
      Math.exp(-resilience) * prevZeta +
      (1.0 / Math.max(0.1, depth)) * Math.abs(action); // keep depth > 0

    this.zetaHistory.push(newZeta);
    return newZeta * Math.abs(action);
  }
}

let linearSpread = new LinearSpread();

// --- UI elements inside canvas ---
let buttons = [];

// =====================================================
// p5 lifecycle
// =====================================================
function setup() {
  const canvas = createCanvas(800, 500);
  canvas.parent('game-container');

  cellW = width / gridCols;
  cellH = height / gridRows;

  generateMarketPrimitives();

  currentTime = 0;
  cash = initialCash;
  inventory = initialInventory;
  updateFromTime(); // sets currentPrice, depth, resilience, PnL

  initButtons();
}

function draw() {
  background(255);

  // Advance time if running
  if (isRunning && frameCount % stepFrames === 0 && currentTime < terminalTime) {
    currentTime++;
    updateFromTime();

    if (currentTime >= terminalTime) {
      isRunning = false;
      console.log('Reached terminal time.');
    }
  }

  // 1) Grid as background
  drawGrid();

  // 2) Charts for price, depth, resilience
  drawCharts();

  // 3) Control bar, buttons, HUD
  drawControlBar();
  drawButtons();
  drawHUD();
}

// =====================================================
// Drawing helpers
// =====================================================
function drawGrid() {
  stroke(240);
  strokeWeight(1);

  // horizontal lines
  for (let r = 0; r <= gridRows; r++) {
    const y = r * cellH;
    line(0, y, width, y);
  }

  // vertical lines
  for (let c = 0; c <= gridCols; c++) {
    const x = c * cellW;
    line(x, 0, x, height);
  }
}

// A light bar at the bottom for controls/HUD
function drawControlBar() {
  noStroke();
  fill(245);
  rect(0, height - 80, width, 80);
}

function drawButtons() {
  textAlign(CENTER, CENTER);
  textSize(14);

  buttons.forEach(btn => {
    // button background
    stroke(0);
    fill(235);
    rect(btn.x, btn.y, btn.w, btn.h, 5);

    // label
    noStroke();
    fill(0);
    text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  });
}

function drawHUD() {
  // HUD panel on the right side of the control bar
  const panelX = width - 260;
  const panelY = height - 75;
  const panelW = 240;
  const panelH = 110;

  // background
  stroke(200);
  fill(255);
  rect(panelX, panelY, panelW, panelH, 5);

  // text
  noStroke();
  fill(0);
  textAlign(LEFT, CENTER);
  textSize(12);

  const x = panelX + 10;
  let y = panelY + 16;

  text(`t: ${currentTime} / ${terminalTime}`, x, y);
  y += 15;
  text(`Price: ${currentPrice.toFixed(2)}`, x, y);
  y += 15;
  text(`Depth: ${currentDepth.toFixed(2)}`, x, y);
  y += 15;
  text(`Resilience: ${currentResilience.toFixed(2)}`, x, y);
  y += 15;
  text(`Inventory: ${inventory.toFixed(2)}`, x, y);
  y += 15;
  text(`Cash: ${cash.toFixed(2)}`, x, y);
  y += 15;
  text(`PnL: ${pnl.toFixed(2)}`, x, y);
}

// -----------------------------------------------------
// Time-series charts for price, depth, resilience
// -----------------------------------------------------
function drawCharts() {
  const left = 40;
  const right = width - 40;

  const priceTop = 20;
  const priceHeight = 150;

  const depthTop = priceTop + priceHeight + 10; // ~180
  const depthHeight = 70;

  const resTop = depthTop + depthHeight + 10; // ~260
  const resHeight = 70;

  drawPriceChart(left, right, priceTop, priceHeight);
  drawDepthChart(left, right, depthTop, depthHeight);
  drawResilienceChart(left, right, resTop, resHeight);
}

function drawPriceChart(left, right, top, height) {
  if (!assetPrice || assetPrice.length === 0) return;

  const nSteps = assetPrice.length - 1;
  if (nSteps <= 0) return;

  const xSpan = right - left;
  const endIndex = Math.min(currentTime, nSteps);

  // panel background
  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, xSpan + 20, height + 10, 5);

  // label
  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);
  text('Price', left - 5, top - 18);

  if (maxPrice <= minPrice) return;

  // series
  stroke(0);
  strokeWeight(1.5);
  noFill();

  beginShape();
  for (let t = 0; t <= endIndex; t++) {
    const price = basePriceLevel + assetPrice[t];
    const x = left + (t / nSteps) * xSpan;
    const y = mapValueToY(price, minPrice, maxPrice, top, height);
    vertex(x, y);
  }
  endShape();

  // current point highlight
  if (endIndex >= 0) {
    const price = basePriceLevel + assetPrice[endIndex];
    const x = left + (endIndex / nSteps) * xSpan;
    const y = mapValueToY(price, minPrice, maxPrice, top, height);
    noStroke();
    fill(0);
    circle(x, y, 5);
  }
}

function drawDepthChart(left, right, top, height) {
  if (!depthSeries || depthSeries.length === 0) return;

  const nSteps = depthSeries.length - 1;
  if (nSteps <= 0) return;

  const xSpan = right - left;
  const endIndex = Math.min(currentTime, nSteps);

  // panel background
  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, xSpan + 20, height + 10, 5);

  // label
  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);
  text('Depth', left - 5, top - 18);

  if (maxDepth <= minDepth) return;

  stroke(0);
  strokeWeight(1.2);
  noFill();

  beginShape();
  for (let t = 0; t <= endIndex; t++) {
    const d = depthSeries[t];
    const x = left + (t / nSteps) * xSpan;
    const y = mapValueToY(d, minDepth, maxDepth, top, height);
    vertex(x, y);
  }
  endShape();

  if (endIndex >= 0) {
    const d = depthSeries[endIndex];
    const x = left + (endIndex / nSteps) * xSpan;
    const y = mapValueToY(d, minDepth, maxDepth, top, height);
    noStroke();
    fill(0);
    circle(x, y, 4);
  }
}

function drawResilienceChart(left, right, top, height) {
  if (!resilienceSeries || resilienceSeries.length === 0) return;

  const nSteps = resilienceSeries.length - 1;
  if (nSteps <= 0) return;

  const xSpan = right - left;
  const endIndex = Math.min(currentTime, nSteps);

  // panel background
  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, xSpan + 20, height + 10, 5);

  // label
  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);
  text('Resilience', left - 5, top - 18);

  if (maxRes <= minRes) return;

  stroke(0);
  strokeWeight(1.2);
  noFill();

  beginShape();
  for (let t = 0; t <= endIndex; t++) {
    const r = resilienceSeries[t];
    const x = left + (t / nSteps) * xSpan;
    const y = mapValueToY(r, minRes, maxRes, top, height);
    vertex(x, y);
  }
  endShape();

  if (endIndex >= 0) {
    const r = resilienceSeries[endIndex];
    const x = left + (endIndex / nSteps) * xSpan;
    const y = mapValueToY(r, minRes, maxRes, top, height);
    noStroke();
    fill(0);
    circle(x, y, 4);
  }
}

// value in [minVal,maxVal] -> y in [top, top+height] (higher = bigger)
function mapValueToY(value, minVal, maxVal, top, height) {
  if (maxVal <= minVal) return top + height / 2;
  const ratio = (value - minVal) / (maxVal - minVal);
  const clamped = Math.min(1, Math.max(0, ratio));
  // invert so larger value is visually higher
  return top + (1 - clamped) * height;
}

// =====================================================
// Market primitives: AR(1) processes (asset, depth, resilience)
// =====================================================

// Standard normal via Box–Muller
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateMarketPrimitives() {
  assetPrice = [];
  depthSeries = [];
  resilienceSeries = [];

  // Initial values (similar to Python snippet)
  assetPrice.push(0.0);
  depthSeries.push(arParams.offsetDp);
  resilienceSeries.push(arParams.offsetRe);

  for (let t = 0; t < terminalTime; t++) {
    const apPrev = assetPrice[assetPrice.length - 1];
    const dpPrev = depthSeries[depthSeries.length - 1];
    const rePrev = resilienceSeries[resilienceSeries.length - 1];

    const ap = arParams.alphaAp * apPrev + randn();
    const dp = arParams.alphaDp * dpPrev + randn() + arParams.offsetDp;
    const re = arParams.alphaRe * rePrev + randn() + arParams.offsetRe;

    assetPrice.push(ap);
    depthSeries.push(Math.max(0.1, dp));
    resilienceSeries.push(Math.max(0.1, re));
  }

  // compute min/max for charts using actual values
  const prices = assetPrice.map(v => basePriceLevel + v);
  minPrice = Math.min(...prices);
  maxPrice = Math.max(...prices);

  minDepth = Math.min(...depthSeries);
  maxDepth = Math.max(...depthSeries);

  minRes = Math.min(...resilienceSeries);
  maxRes = Math.max(...resilienceSeries);

  linearSpread.reset();
}

// =====================================================
// Buttons & interactions inside the canvas
// =====================================================
function initButtons() {
  const y = height - 60;
  const w = 100;
  const h = 40;

  buttons = [
    { label: 'START', x: 30,  y, w, h, action: onStart },
    { label: 'RESET', x: 150, y, w, h, action: onReset },
    { label: 'BUY',   x: 270, y, w, h, action: () => onTrade(+1) },
    { label: 'SELL',  x: 390, y, w, h, action: () => onTrade(-1) },
  ];
}

// Handle clicks inside canvas
function mousePressed() {
  buttons.forEach(btn => {
    if (
      mouseX >= btn.x && mouseX <= btn.x + btn.w &&
      mouseY >= btn.y && mouseY <= btn.y + btn.h
    ) {
      btn.action();
    }
  });
}

// =====================================================
// Button actions
// =====================================================
function onStart() {
  if (currentTime >= terminalTime) {
    // If we've already finished, restart instead
    onReset();
  }
  isRunning = true;
  console.log('START clicked, isRunning =', isRunning);
}

function onReset() {
  isRunning = false;

  generateMarketPrimitives();

  currentTime = 0;
  cash = initialCash;
  inventory = initialInventory;
  updateFromTime();

  console.log('RESET clicked, market & state reset');
}

// Unified trade handler: action = +1 (buy), -1 (sell)
function onTrade(action) {
  // Use current depth & resilience at this time
  const depth = currentDepth;
  const resilience = currentResilience;

  // Dynamic spread / friction
  const frictionCost = linearSpread.valueFor(action, depth, resilience);

  // Cash change: - (action * price + friction)
  cash += -action * currentPrice - frictionCost;

  // Inventory update
  inventory += action;

  recomputePnL();

  console.log(
    `TRADE action=${action}, t=${currentTime}, price=${currentPrice.toFixed(2)}, ` +
    `depth=${depth.toFixed(2)}, res=${resilience.toFixed(2)}, friction=${frictionCost.toFixed(4)}`
  );
}

// =====================================================
// Helpers
// =====================================================
function updateFromTime() {
  const idx = Math.min(currentTime, terminalTime);
  currentPrice = basePriceLevel + assetPrice[idx];
  currentDepth = depthSeries[idx];
  currentResilience = resilienceSeries[idx];
  recomputePnL();
}

// Mark-to-market PnL: inventory * currentPrice + cash
function recomputePnL() {
  pnl = inventory * currentPrice + cash;
}
