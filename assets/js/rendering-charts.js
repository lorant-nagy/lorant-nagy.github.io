// =====================================================
// RENDERING - CHARTS (continued)
// =====================================================

import { CONFIG } from './config.js';
import { mapValueToY } from './rendering.js';

/**
 * Draw trade marker stripes (player and AI trades)
 */
export function drawTradeMarkers(left, right, yPosition, gameState) {
  const nSteps = gameState.assetPrice.length - 1;
  if (nSteps <= 0) return;

  const chartWidth = right - left;
  const totalCandles = Math.ceil(nSteps / CONFIG.pointsPerCandle);
  const candleSpacing = 2;
  const candleWidth = Math.max(2, (chartWidth - (totalCandles - 1) * candleSpacing) / totalCandles);
  
  const stripeHeight = 20;
  const stripeSpacing = 2;
  
  // AI stripe (top)
  const aiStripeY = yPosition;
  const aiMarkerY = aiStripeY + stripeHeight / 2;
  
  // Player stripe (bottom)
  const playerStripeY = aiStripeY + stripeHeight + stripeSpacing;
  const playerMarkerY = playerStripeY + stripeHeight / 2;
  
  const markerSize = 8;
  
  // Draw backgrounds
  noStroke();
  fill(240, 240, 245);
  rect(left, aiStripeY, chartWidth, stripeHeight, 3);
  fill(245, 240, 240);
  rect(left, playerStripeY, chartWidth, stripeHeight, 3);
  
  // Labels
  fill(0);
  textAlign(LEFT, CENTER);
  textSize(10);
  text('AI Agent', left + 5, aiMarkerY);
  text('Player', left + 5, playerMarkerY);
  
  // Draw AI trades
  gameState.aiTrades.forEach(trade => {
    const candleX = left + trade.candleIndex * (candleWidth + candleSpacing) + candleWidth / 2;
    drawTradeTriangle(candleX, aiMarkerY, markerSize, trade.action);
  });
  
  // Draw player trades
  gameState.playerTrades.forEach(trade => {
    const candleX = left + trade.candleIndex * (candleWidth + candleSpacing) + candleWidth / 2;
    drawTradeTriangle(candleX, playerMarkerY, markerSize, trade.action);
  });
}

/**
 * Draw trade triangle marker
 */
function drawTradeTriangle(x, y, size, action) {
  noStroke();
  if (action > 0) {
    // Buy - green upward triangle
    fill(50, 200, 50);
    triangle(x, y - size/2, x - size/2, y + size/2, x + size/2, y + size/2);
  } else {
    // Sell - red downward triangle
    fill(200, 50, 50);
    triangle(x, y + size/2, x - size/2, y - size/2, x + size/2, y - size/2);
  }
}

/**
 * Draw depth and resilience chart
 */
export function drawDepthResilienceChart(left, right, top, height, gameState, scales) {
  if (!gameState.depthSeries || gameState.depthSeries.length === 0) return;
  if (!gameState.resilienceSeries || gameState.resilienceSeries.length === 0) return;

  const nSteps = gameState.depthSeries.length - 1;
  if (nSteps <= 0) return;

  const xSpan = right - left;
  const endIndex = Math.min(gameState.currentTime, nSteps);
  const chartWidth = right - left;

  // Panel background
  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, chartWidth + 20, height + 10, 5);

  // Legend
  const legendX = right - 80;
  const legendY = top + 8;
  
  noStroke();
  fill(...CONFIG.chartStyles.depthColor);
  circle(legendX, legendY, CONFIG.chartStyles.legendDotSize);
  fill(0);
  textAlign(LEFT, CENTER);
  textSize(10);
  text('Depth', legendX + 8, legendY);
  
  fill(...CONFIG.chartStyles.resilienceColor);
  circle(legendX, legendY + 12, CONFIG.chartStyles.legendDotSize);
  fill(0);
  text('Resilience', legendX + 8, legendY + 12);

  // Scale lines
  stroke(230);
  strokeWeight(0.5);
  const numScaleLines = 5;
  for (let i = 0; i <= numScaleLines; i++) {
    const y = top + (i / numScaleLines) * height;
    line(left, y, right, y);
  }
  
  // Scale values
  noStroke();
  fill(150);
  textAlign(RIGHT, CENTER);
  textSize(9);
  for (let i = 0; i <= numScaleLines; i++) {
    const value = scales.depthMax - (i / numScaleLines) * (scales.depthMax - scales.depthMin);
    const y = top + (i / numScaleLines) * height;
    text(value.toFixed(0), left - 5, y);
  }

  // Draw depth area and line
  drawSeriesArea(left, top, height, xSpan, nSteps, endIndex, gameState.depthSeries, scales.depthMin, scales.depthMax, CONFIG.chartStyles.depthColor, CONFIG.chartStyles.fillAlpha);
  drawSeriesLine(left, top, height, xSpan, nSteps, endIndex, gameState.depthSeries, scales.depthMin, scales.depthMax, CONFIG.chartStyles.depthColor, CONFIG.chartStyles.lineWeight);

  // Draw resilience area and line
  drawSeriesArea(left, top, height, xSpan, nSteps, endIndex, gameState.resilienceSeries, scales.resMin, scales.resMax, CONFIG.chartStyles.resilienceColor, CONFIG.chartStyles.fillAlpha);
  drawSeriesLine(left, top, height, xSpan, nSteps, endIndex, gameState.resilienceSeries, scales.resMin, scales.resMax, CONFIG.chartStyles.resilienceColor, CONFIG.chartStyles.lineWeight);
}

/**
 * Draw filled area under series
 */
function drawSeriesArea(left, top, height, xSpan, nSteps, endIndex, series, minVal, maxVal, colorRGB, alpha) {
  noStroke();
  fill(...colorRGB, alpha);
  beginShape();
  vertex(left, top + height);
  for (let t = 0; t <= endIndex; t++) {
    const val = series[t];
    const x = left + (t / nSteps) * xSpan;
    const y = mapValueToY(val, minVal, maxVal, top, height);
    vertex(x, y);
  }
  vertex(left + (endIndex / nSteps) * xSpan, top + height);
  endShape(CLOSE);
}

/**
 * Draw line for series
 */
function drawSeriesLine(left, top, height, xSpan, nSteps, endIndex, series, minVal, maxVal, colorRGB, lineWeight) {
  stroke(...colorRGB);
  strokeWeight(lineWeight);
  noFill();
  beginShape();
  for (let t = 0; t <= endIndex; t++) {
    const val = series[t];
    const x = left + (t / nSteps) * xSpan;
    const y = mapValueToY(val, minVal, maxVal, top, height);
    vertex(x, y);
  }
  endShape();
}

/**
 * Draw all thermometer bars (cash and inventory for player and AI)
 */
export function drawThermometerBars(startX, top, height, gameState, scales) {
  const barWidth = 40;
  const barSpacing = 50;
  const barHeight = height - 20;
  const barTop = top + 10;
  
  // Player thermometers
  const playerCashX = startX;
  const playerInvX = startX + barSpacing;
  
  drawThermometer(playerCashX, barTop, barWidth, barHeight, gameState.cash, scales.cashMin, scales.cashMax, 'P:Cash');
  drawThermometer(playerInvX, barTop, barWidth, barHeight, gameState.inventory, scales.inventoryMin, scales.inventoryMax, 'P:Inv');
  
  // AI thermometers
  if (CONFIG.aiAgent.enabled) {
    const aiCashX = startX + barSpacing * 2 + 15;
    const aiInvX = startX + barSpacing * 3 + 15;
    
    drawThermometer(aiCashX, barTop, barWidth, barHeight, gameState.aiCash, scales.cashMin, scales.cashMax, 'AI:Cash');
    drawThermometer(aiInvX, barTop, barWidth, barHeight, gameState.aiInventory, scales.inventoryMin, scales.inventoryMax, 'AI:Inv');
  }
}

/**
 * Draw a single thermometer
 */
function drawThermometer(x, top, width, height, currentValue, minValue, maxValue, label) {
  const range = maxValue - minValue;
  const isCashThermometer = label.includes('Cash');
  
  // Background
  stroke(200);
  strokeWeight(1);
  fill(245);
  rect(x, top, width, height, 5);
  
  // Grid lines
  if (isCashThermometer) {
    drawCashGridLines(x, top, width, height, minValue, maxValue, range);
  } else {
    drawInventoryGridLines(x, top, width, height, minValue, maxValue, range);
  }
  
  // Fill
  drawThermometerFill(x, top, width, height, currentValue, minValue, maxValue, range, isCashThermometer);
  
  // Labels
  fill(0);
  textAlign(CENTER, TOP);
  textSize(9);
  text(label, x + width / 2, top - 15);
  
  textSize(8);
  text(currentValue.toFixed(0), x + width / 2, top + height + 3);
}

/**
 * Draw grid lines for cash thermometer
 */
function drawCashGridLines(x, top, width, height, minValue, maxValue, range) {
  // Main lines at 100% intervals
  stroke(220);
  strokeWeight(0.5);
  
  for (let pct = 0; pct <= 3; pct++) {
    const cashValue = CONFIG.commonCash * pct;
    if (cashValue >= minValue && cashValue <= maxValue) {
      const normalized = (cashValue - minValue) / range;
      const y = top + (1 - normalized) * height;
      
      if (pct === 1) {
        stroke(150);
        strokeWeight(1.5);
      } else {
        stroke(220);
        strokeWeight(0.5);
      }
      line(x, y, x + width, y);
      
      noStroke();
      fill(pct === 1 ? 50 : 120);
      textAlign(LEFT, CENTER);
      textSize(8);
      text(`${pct}x`, x + width + 2, y);
    }
  }
  
  // Intermediate lines
  stroke(230);
  strokeWeight(0.3);
  for (let pct = 0.5; pct <= 2.5; pct += 1.0) {
    const cashValue = CONFIG.commonCash * pct;
    if (cashValue >= minValue && cashValue <= maxValue) {
      const normalized = (cashValue - minValue) / range;
      const y = top + (1 - normalized) * height;
      line(x, y, x + width, y);
    }
  }
}

/**
 * Draw grid lines for inventory thermometer
 */
function drawInventoryGridLines(x, top, width, height, minValue, maxValue, range) {
  stroke(220);
  strokeWeight(0.5);
  const numLines = 10;
  for (let i = 0; i <= numLines; i++) {
    const y = top + (i / numLines) * height;
    line(x, y, x + width, y);
  }
  
  // Zero line
  const zeroNormalized = (0 - minValue) / range;
  if (zeroNormalized >= 0 && zeroNormalized <= 1) {
    const zeroY = top + (1 - zeroNormalized) * height;
    stroke(100);
    strokeWeight(1.5);
    line(x, zeroY, x + width, zeroY);
  }
}

/**
 * Draw thermometer fill
 */
function drawThermometerFill(x, top, width, height, currentValue, minValue, maxValue, range, isCashThermometer) {
  const normalizedValue = (currentValue - minValue) / range;
  const clampedValue = Math.max(0, Math.min(1, normalizedValue));
  const valueY = top + (1 - clampedValue) * height;
  
  noStroke();
  
  if (isCashThermometer) {
    const fillHeight = clampedValue * height;
    fill(50, 200, 50, 180);
    rect(x, top + height - fillHeight, width, fillHeight, 5);
  } else {
    const zeroNormalized = (0 - minValue) / range;
    const zeroY = top + (1 - zeroNormalized) * height;
    
    if (currentValue >= 0) {
      const fillTop = Math.min(valueY, zeroY);
      const fillHeight = Math.abs(zeroY - valueY);
      fill(50, 200, 50, 180);
      rect(x, fillTop, width, fillHeight, 5);
    } else {
      const fillHeight = Math.abs(zeroY - valueY);
      fill(200, 50, 50, 180);
      rect(x, zeroY, width, fillHeight, 5);
    }
  }
}
