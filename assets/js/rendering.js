// =====================================================
// RENDERING
// =====================================================
// All drawing and visualization functions

import { CONFIG } from './config.js';
import { drawTradeMarkers, drawDepthResilienceChart, drawThermometerBars } from './rendering-charts.js';

/**
 * Draw background grid
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} cellW - Cell width
 * @param {number} cellH - Cell height
 */
export function drawGrid(width, height, cellW, cellH) {
  stroke(240);
  strokeWeight(1);

  // Horizontal lines
  for (let r = 0; r <= CONFIG.gridRows; r++) {
    const y = r * cellH;
    line(0, y, width, y);
  }

  // Vertical lines
  for (let c = 0; c <= CONFIG.gridCols; c++) {
    const x = c * cellW;
    line(x, 0, x, height);
  }
}

/**
 * Draw control bar at bottom
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
export function drawControlBar(width, height) {
  noStroke();
  fill(245);
  rect(0, height - 80, width, 80);
}

/**
 * Draw all charts (price, trade markers, depth/resilience)
 * @param {object} gameState - Current game state
 * @param {object} scales - Display scales
 */
export function drawCharts(gameState, scales) {
  const left = 40;
  const right = 580;
  const priceTop = 20;
  const priceHeight = 250;
  const tradeMarkersHeight = 44;
  const depthResTop = priceTop + priceHeight + tradeMarkersHeight + 5;
  const depthResHeight = CONFIG.chartStyles.depthResHeight;

  drawPriceChart(left, right, priceTop, priceHeight, gameState, scales);
  drawTradeMarkers(left, right, priceTop + priceHeight + 5, gameState);
  drawDepthResilienceChart(left, right, depthResTop, depthResHeight, gameState, scales);
  drawThermometerBars(right + 30, priceTop, priceHeight + tradeMarkersHeight + 5 + depthResHeight, gameState, scales);
}

/**
 * Draw price chart with candlesticks
 */
function drawPriceChart(left, right, top, height, gameState, scales) {
  if (!gameState.assetPrice || gameState.assetPrice.length === 0) return;

  const nSteps = gameState.assetPrice.length - 1;
  if (nSteps <= 0) return;

  const endIndex = Math.min(gameState.currentTime, nSteps);
  const chartWidth = right - left;

  // Panel background
  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, chartWidth + 20, height + 10, 5);

  // Label
  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);
  text('Price', left - 5, top - 18);

  // Calculate candle dimensions
  const totalCandles = Math.ceil(nSteps / CONFIG.pointsPerCandle);
  const candleSpacing = 2;
  const candleWidth = Math.max(2, (chartWidth - (totalCandles - 1) * candleSpacing) / totalCandles);
  
  // Draw complete candles
  const numCandles = Math.floor(endIndex / CONFIG.pointsPerCandle);
  
  for (let i = 0; i < numCandles; i++) {
    drawCandle(i, left, candleWidth, candleSpacing, top, height, gameState, scales);
  }
  
  // Draw partial candle
  if (endIndex % CONFIG.pointsPerCandle !== 0 && numCandles * CONFIG.pointsPerCandle < endIndex) {
    drawPartialCandle(numCandles, endIndex, left, candleWidth, candleSpacing, top, height, gameState, scales);
  }
  
  // Draw liquidation boundary
  drawLiquidationBoundary(left, candleWidth, candleSpacing, top, height, gameState);
}

/**
 * Draw a single candlestick
 */
function drawCandle(index, left, candleWidth, candleSpacing, top, height, gameState, scales) {
  const startIdx = index * CONFIG.pointsPerCandle;
  const endIdx = Math.min(startIdx + CONFIG.pointsPerCandle, Math.min(gameState.currentTime, gameState.assetPrice.length - 1) + 1);
  
  // Get OHLC
  const open = gameState.assetPrice[startIdx];
  const close = gameState.assetPrice[endIdx - 1];
  
  let high = open;
  let low = open;
  for (let j = startIdx; j < endIdx; j++) {
    const price = gameState.assetPrice[j];
    high = Math.max(high, price);
    low = Math.min(low, price);
  }
  
  // Calculate positions
  const candleX = left + index * (candleWidth + candleSpacing);
  const openY = mapValueToY(open, scales.priceYMin, scales.priceYMax, top, height);
  const closeY = mapValueToY(close, scales.priceYMin, scales.priceYMax, top, height);
  const highY = mapValueToY(high, scales.priceYMin, scales.priceYMax, top, height);
  const lowY = mapValueToY(low, scales.priceYMin, scales.priceYMax, top, height);
  
  // Color
  const isGreen = close >= open;
  const candleColor = isGreen ? color(50, 200, 50) : color(200, 50, 50);
  
  // Draw wick
  stroke(100);
  strokeWeight(1);
  line(candleX + candleWidth / 2, highY, candleX + candleWidth / 2, lowY);
  
  // Draw body
  noStroke();
  fill(candleColor);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(2, Math.abs(closeY - openY));
  rect(candleX, bodyTop, candleWidth, bodyHeight);
}

/**
 * Draw partial (incomplete) candle
 */
function drawPartialCandle(numCandles, endIndex, left, candleWidth, candleSpacing, top, height, gameState, scales) {
  const startIdx = numCandles * CONFIG.pointsPerCandle;
  
  const open = gameState.assetPrice[startIdx];
  const close = gameState.assetPrice[endIndex];
  
  let high = open;
  let low = open;
  for (let j = startIdx; j <= endIndex; j++) {
    const price = gameState.assetPrice[j];
    high = Math.max(high, price);
    low = Math.min(low, price);
  }
  
  const candleX = left + numCandles * (candleWidth + candleSpacing);
  const openY = mapValueToY(open, scales.priceYMin, scales.priceYMax, top, height);
  const closeY = mapValueToY(close, scales.priceYMin, scales.priceYMax, top, height);
  const highY = mapValueToY(high, scales.priceYMin, scales.priceYMax, top, height);
  const lowY = mapValueToY(low, scales.priceYMin, scales.priceYMax, top, height);
  
  const isGreen = close >= open;
  const candleColor = isGreen ? color(50, 200, 50) : color(200, 50, 50);
  
  // Draw wick
  stroke(100);
  strokeWeight(1);
  line(candleX + candleWidth / 2, highY, candleX + candleWidth / 2, lowY);
  
  // Draw body
  noStroke();
  fill(candleColor);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(2, Math.abs(closeY - openY));
  rect(candleX, bodyTop, candleWidth, bodyHeight);
}

/**
 * Draw liquidation boundary line
 */
function drawLiquidationBoundary(left, candleWidth, candleSpacing, top, height, gameState) {
  const liquidationCandleIndex = Math.floor(gameState.liquidationStartTime / CONFIG.pointsPerCandle);
  const liquidationX = left + liquidationCandleIndex * (candleWidth + candleSpacing);
  
  stroke(255, 150, 0);
  strokeWeight(2);
  line(liquidationX, top, liquidationX, top + height);
  
  noStroke();
  fill(255, 150, 0);
  textAlign(LEFT, TOP);
  textSize(10);
  text('Liquidation →', liquidationX + 3, top + 5);
}

/**
 * Map value to Y coordinate (higher value = higher on screen)
 */
function mapValueToY(value, minVal, maxVal, top, height) {
  if (maxVal <= minVal) return top + height / 2;
  const ratio = (value - minVal) / (maxVal - minVal);
  const clamped = Math.min(1, Math.max(0, ratio));
  return top + (1 - clamped) * height;
}

// Export the helper for use in other drawing functions
export { mapValueToY };
