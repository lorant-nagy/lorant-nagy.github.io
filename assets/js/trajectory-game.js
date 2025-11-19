// --- Grid configuration ---
let gridRows = 50;
let gridCols = 80;
let cellW, cellH;

// --- Trading state ---
let currentPrice = 100;
let inventory = 0;
let cash = 0;
let pnl = 0;
let isRunning = false; // will control the price animation later

// --- UI elements inside canvas ---
let buttons = [];

function setup() {
  const canvas = createCanvas(800, 500);
  canvas.parent('game-container');

  cellW = width / gridCols;
  cellH = height / gridRows;

  initButtons();
}

function draw() {
  background(255);

  // 1) Draw grid in the background
  drawGrid();

  // 2) (Later) draw price trajectory here when isRunning === true

  // 3) Draw control bar, buttons, and HUD on top
  drawControlBar();
  drawButtons();
  drawHUD();
}

// --- Drawing helpers ---

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
  text(`Inventory: ${inventory}`, x, y);
  y += 15;
  text(`Cash: ${cash.toFixed(2)}`, x, y);
  y += 15;
  text(`PnL: ${pnl.toFixed(2)}`, x, y);
}

// --- Buttons & interactions ---

function initButtons() {
  const y = height - 60;
  const w = 100;
  const h = 40;

  buttons = [
    { label: 'START', x: 30,  y, w, h, action: onStart },
    { label: 'RESET', x: 150, y, w, h, action: onReset },
    { label: 'BUY',   x: 270, y, w, h, action: onBuy },
    { label: 'SELL',  x: 390, y, w, h, action: onSell },
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

// --- Button actions ---

function onStart() {
  isRunning = true;
  // Later: start or resume price path animation here
  console.log('START clicked, isRunning =', isRunning);
}

function onReset() {
  isRunning = false;
  inventory = 0;
  cash = 0;
  pnl = 0;
  currentPrice = 100;
  console.log('RESET clicked, game state reset');
}

function onBuy() {
  inventory += 1;
  cash -= currentPrice;
  recomputePnL();
  console.log('BUY clicked');
}

function onSell() {
  inventory -= 1;
  cash += currentPrice;
  recomputePnL();
  console.log('SELL clicked');
}

// Recompute PnL as mark-to-market: inventory * price + cash
function recomputePnL() {
  pnl = inventory * currentPrice + cash;
}
