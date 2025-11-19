// --- Grid configuration ---
let gridRows = 50;
let gridCols = 80;
let cellW, cellH;

// --- Time & market primitives ---
let terminalTime = 40; // number of steps (t = 0..terminalTime)
let currentTime = 0;

let assetPrice = [];      // raw AR(1) series around 0
let depthSeries = [];     // depth[t]
let resilienceSeries = []; // resilience[t]

// AR(1) parameters (mirroring your Python)
const arParams = {
  alphaAp: 0.7,
  alphaDp: -0.6,
  alphaRe: -0.5,
  offsetDp: 6.0,
  offsetRe: 7.0
};

// --- Trading state ---
let basePriceLevel = 100.0; // shifts AR(1) mid-price to a nicer level
let currentPrice = basePriceLevel; // displayed price (base + assetPrice[t])

let initialCash = 1.0;
let initialInventory = 1.0;

let cash = initialCash;
let inventory = initialInventory;
let pnl = 0;
let isRunning = false; // will control price animation later

// --- Dynamic spread / friction (LinearSpread) ---
class LinearSpread {
  constructor() {
    this.zetaHistory = [0.0];
  }

  reset() {
    this.zetaHistory = [0.0];
  }

  // JS analog of __call__(action, depth, resilience)
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

// ---------------------------------------------------------
// p5 lifecycle
// ---------------------------------------------------------
function setup() {
  const canvas = createCanvas(800, 500);
  canvas.parent('game-container');

  cellW = width / gridCols;
  cellH = height / gridRows;

  generateMarketPrimitives();

  currentTime = 0;
  currentPrice = basePriceLevel + assetPrice[currentTime];

  cash = initialCash;
  inventory = initialInventory;
  recomputePnL();

  initButtons();
}

function draw() {
  background(255);

  // 1) Draw grid
  drawGrid();

  // 2) (Later) draw price trajectory here, advancing when isRunning === true

  // 3) Draw control bar, buttons, and HUD
  drawControlBar();
  drawButtons();
  drawHUD();
}

// ---------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------
function drawGrid() {
  stroke(220);
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
  // small panel on the right side of the control bar
  const panelX = width - 260;
  const panelY = height - 75;
  const panelW = 240;
  const panelH = 65;

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
  let y = panelY + 18;

  text(`Price: ${currentPrice.toFixed(2)}`, x, y);
  y += 15;
  text(`Inventory: ${inventory.toFixed(2)}`, x, y);
  y += 15;
  text(`Cash: ${cash.toFixed(2)}`, x, y);
  y += 15;
  text(`PnL: ${pnl.toFixed(2)}`, x, y);
}

// ---------------------------------------------------------
// Market primitives: AR(1) processes (asset, depth, resilience)
// ---------------------------------------------------------

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

  // Initial values (mirror your Python snippet)
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
    depthSeries.push(Math.max(0.1, dp));  // keep positive-ish
    resilienceSeries.push(Math.max(0.1, re));
  }

  // Reset spread process whenever we regenerate market primitives
  linearSpread.reset();
}

// ---------------------------------------------------------
// Buttons & interactions inside the canvas
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// Button actions
// ---------------------------------------------------------
function onStart() {
  isRunning = true;
  // Next step: use this to advance currentTime and reveal the price path
  console.log('START clicked, isRunning =', isRunning);
}

function onReset() {
  isRunning = false;

  generateMarketPrimitives();

  currentTime = 0;
  currentPrice = basePriceLevel + assetPrice[currentTime];

  cash = initialCash;
  inventory = initialInventory;
  recomputePnL();

  console.log('RESET clicked, market & state reset');
}

// Unified trade handler: action = +1 (buy), -1 (sell)
function onTrade(action) {
  // Use current depth & resilience at this time
  const depth = depthSeries[Math.min(currentTime, depthSeries.length - 1)];
  const resilience = resilienceSeries[Math.min(currentTime, resilienceSeries.length - 1)];

  // Dynamic spread / friction
  const frictionCost = linearSpread.valueFor(action, depth, resilience);

  // Cash change: - (action * price + friction)
  // - Buy (action>0): spend cash and pay cost
  // - Sell (action<0): receive cash minus cost
  cash += -action * currentPrice - frictionCost;

  // Inventory update
  inventory += action;

  recomputePnL();

  console.log(
    `TRADE action=${action}, price=${currentPrice.toFixed(2)}, depth=${depth.toFixed(2)}, ` +
    `res=${resilience.toFixed(2)}, friction=${frictionCost.toFixed(4)}`
  );
}

// Mark-to-market PnL: inventory * currentPrice + cash
function recomputePnL() {
  pnl = inventory * currentPrice + cash;
}
