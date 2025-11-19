function setup() {
  const canvas = createCanvas(800, 500);
  canvas.parent('game-container');
  textAlign(CENTER, CENTER);
}

function draw() {
  background(240);
  textSize(32);
  text('Trajectory Game – Hello p5.js', width / 2, height / 2);
}