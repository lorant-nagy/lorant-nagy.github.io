// =====================================================
// UI
// =====================================================
// Buttons, game over screen, liquidation overlay

import { CONFIG } from './config.js';

/**
 * Draw control buttons
 */
export function drawButtons(buttons, gameState) {
  textAlign(CENTER, CENTER);
  textSize(14);

  const currentCandleIndex = Math.floor(gameState.currentTime / CONFIG.pointsPerCandle);
  const alreadyTradedThisCandle = gameState.playerTrades.some(trade => trade.candleIndex === currentCandleIndex);

  buttons.forEach(btn => {
    let isClickable = true;
    let fillColor = 235;
    let textColor = 0;
    
    if (gameState.isGameOver) {
      isClickable = (btn.label === 'RESET');
      if (!isClickable) {
        fillColor = 200;
        textColor = 150;
      }
    } else if (btn.label === 'START') {
      isClickable = !gameState.isRunning;
      if (!isClickable) {
        fillColor = 200;
        textColor = 150;
      }
    } else if (btn.label === 'BUY' || btn.label === 'SELL') {
      isClickable = gameState.isRunning && !alreadyTradedThisCandle && !gameState.isInLiquidationPhase;
      if (!isClickable) {
        fillColor = 200;
        textColor = 150;
      }
    }
    
    const isHovered = isClickable && 
                      mouseX >= btn.x && mouseX <= btn.x + btn.w &&
                      mouseY >= btn.y && mouseY <= btn.y + btn.h;
    
    if (isHovered) {
      fillColor = 220;
    }
    
    stroke(0);
    strokeWeight(isClickable ? 1 : 0.5);
    fill(fillColor);
    rect(btn.x, btn.y, btn.w, btn.h, 5);

    noStroke();
    fill(textColor);
    text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  });
}

/**
 * Draw game over overlay
 */
export function drawGameOver(gameState) {
  // Semi-transparent overlay
  noStroke();
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  // Game over box
  const boxW = 500;
  const boxH = 280;
  const boxX = (width - boxW) / 2;
  const boxY = (height - boxH) / 2;
  
  stroke(0);
  strokeWeight(3);
  fill(255);
  rect(boxX, boxY, boxW, boxH, 10);
  
  // Game over text
  noStroke();
  fill(200, 50, 50);
  textAlign(CENTER, CENTER);
  textSize(36);
  text('GAME OVER', width / 2, boxY + 40);
  
  // Calculate final wealth
  const playerWealth = gameState.cash + gameState.inventory * gameState.currentPrice;
  const aiWealth = gameState.aiCash + gameState.aiInventory * gameState.currentPrice;
  
  // Determine winner
  let winner = '';
  if (playerWealth > aiWealth) {
    winner = 'PLAYER WINS!';
  } else if (aiWealth > playerWealth) {
    winner = 'AI WINS!';
  } else {
    winner = 'TIE!';
  }
  
  // Winner announcement
  fill(50, 150, 50);
  textSize(24);
  text(winner, width / 2, boxY + 85);
  
  // Side-by-side layout
  const leftX = boxX + boxW / 4;
  const rightX = boxX + 3 * boxW / 4;
  const cashY = boxY + 140;
  
  // Player side
  fill(0);
  textSize(18);
  text('PLAYER', leftX, boxY + 115);
  
  textSize(24);
  fill(playerWealth > aiWealth ? color(50, 150, 50) : color(0));
  text(`$${playerWealth.toFixed(2)}`, leftX, cashY);
  
  // AI side
  fill(0);
  textSize(18);
  text('AI AGENT', rightX, boxY + 115);
  
  textSize(24);
  fill(aiWealth > playerWealth ? color(50, 150, 50) : color(0));
  text(`$${aiWealth.toFixed(2)}`, rightX, cashY);
  
  // Divider line
  stroke(200);
  strokeWeight(2);
  line(width / 2, boxY + 105, width / 2, boxY + 165);
  
  // RESET button
  const btnW = 140;
  const btnH = 50;
  const btnX = (width - btnW) / 2;
  const btnY = boxY + boxH - 80;
  
  const isHovered = mouseX >= btnX && mouseX <= btnX + btnW &&
                    mouseY >= btnY && mouseY <= btnY + btnH;
  
  stroke(0);
  strokeWeight(2);
  fill(isHovered ? color(70, 180, 70) : color(50, 150, 50));
  rect(btnX, btnY, btnW, btnH, 8);
  
  noStroke();
  fill(255);
  textSize(20);
  textAlign(CENTER, CENTER);
  text('RESET', btnX + btnW / 2, btnY + btnH / 2);
  
  return { btnX, btnY, btnW, btnH };  // Return button bounds for click detection
}

/**
 * Draw liquidation phase overlay
 */
export function drawLiquidationPhase(gameState) {
  noStroke();
  fill(255, 200, 0, 200);
  const bannerHeight = 50;
  rect(0, 0, width, bannerHeight);
  
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(24);
  textStyle(BOLD);
  text('FORCED LIQUIDATION PHASE', width / 2, bannerHeight / 2);
  textStyle(NORMAL);
  
  textSize(14);
  const stepsRemaining = gameState.terminalTime - gameState.currentTime;
  text(`Auto-liquidating to zero position (${stepsRemaining} steps remaining)`, width / 2, bannerHeight / 2 + 20);
}

/**
 * Initialize button objects
 */
export function initButtons(canvasHeight) {
  const y = canvasHeight - 60;
  const w = 100;
  const h = 40;

  return [
    { label: 'START', x: 30,  y, w, h },
    { label: 'RESET', x: 150, y, w, h },
    { label: 'BUY',   x: 270, y, w, h },
    { label: 'SELL',  x: 390, y, w, h },
  ];
}

/**
 * Check if a button was clicked
 */
export function checkButtonClick(buttons, gameState) {
  const currentCandleIndex = Math.floor(gameState.currentTime / CONFIG.pointsPerCandle);
  const alreadyTradedThisCandle = gameState.playerTrades.some(trade => trade.candleIndex === currentCandleIndex);
  
  for (const btn of buttons) {
    if (mouseX >= btn.x && mouseX <= btn.x + btn.w &&
        mouseY >= btn.y && mouseY <= btn.y + btn.h) {
      
      let isClickable = true;
      
      if (gameState.isGameOver) {
        isClickable = (btn.label === 'RESET');
      } else if (btn.label === 'START') {
        isClickable = !gameState.isRunning;
      } else if (btn.label === 'BUY' || btn.label === 'SELL') {
        isClickable = gameState.isRunning && !alreadyTradedThisCandle && !gameState.isInLiquidationPhase;
      }
      
      if (isClickable) {
        return btn.label;
      }
    }
  }
  
  return null;
}

/**
 * Check if game over RESET button was clicked
 */
export function checkGameOverResetClick() {
  const boxW = 500;
  const boxH = 280;
  const boxX = (width - boxW) / 2;
  const boxY = (height - boxH) / 2;
  const btnW = 140;
  const btnH = 50;
  const btnX = (width - btnW) / 2;
  const btnY = boxY + boxH - 80;
  
  return mouseX >= btnX && mouseX <= btnX + btnW &&
         mouseY >= btnY && mouseY <= btnY + btnH;
}
