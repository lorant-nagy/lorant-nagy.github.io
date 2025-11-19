let gridRows = 50;
let gridCols = 80;
let cellW, cellH;

function setup() {
  const canvas = createCanvas(800, 500);
  canvas.parent('game-container');

  // size of each cell in pixels
  cellW = width / gridCols;
  cellH = height / gridRows;
}

function draw() {
  background(255); // white background

  stroke(220);     // light grey lines
  strokeWeight(1);

  // horizontal grid lines
  for (let r = 0; r <= gridRows; r++) {
    const y = r * cellH;
    line(0, y, width, y);
  }

  // vertical grid lines
  for (let c = 0; c <= gridCols; c++) {
    const x = c * cellW;
    line(x, 0, x, height);
  }
}
