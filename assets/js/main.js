// =====================================================
// MAIN
// =====================================================
// Main game orchestration - p5.js lifecycle and integration

import { CONFIG } from './config.js';
import * as DataLoader from './data-loader.js';
import * as GameState from './game-state.js';
import * as GameLogic from './game-logic.js';
import * as Rendering from './rendering.js';
import * as RenderingCharts from './rendering-charts.js';
import * as UI from './ui.js';

// =====================================================
// GLOBAL STATE
// =====================================================

let gameState;
let buttons;
let cellW, cellH;

// Display scales (will be auto-adjusted based on data)
let scales = { ...CONFIG.scales };

// =====================================================
// P5.JS LIFECYCLE
// =====================================================

window.setup = async function() {
  const canvas = createCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);
  canvas.parent('game-container');

  cellW = width / CONFIG.gridCols;
  cellH = height / CONFIG.gridRows;

  // Initialize game state
  gameState = GameState.createGameState();

  // Load CSV data
  console.log('Loading market primitives from CSV...');
  gameState.csvData = await DataLoader.loadCSVData(CONFIG.csvPath);
  
  if (!gameState.csvData) {
    alert('ERROR: Failed to load CSV data from ' + CONFIG.csvPath + '\n\nPlease check:\n1. The file path is correct\n2. The file exists\n3. The file format is valid');
    console.error('FATAL: Cannot load CSV data. Game cannot start.');
    noLoop();
    return;
  }
  
  // Initialize game with random trajectory
  await initializeGame();
  
  // Initialize UI
  buttons = UI.initButtons(CONFIG.canvasHeight);
};

window.draw = function() {
  background(255);

  // Advance time if running
  if (gameState.isRunning && frameCount % CONFIG.stepFrames === 0 && !gameState.isGameOver) {
    GameLogic.advanceTime(gameState);
  }

  // Draw everything
  Rendering.drawGrid(width, height, cellW, cellH);
  Rendering.drawCharts(gameState, scales);
  Rendering.drawControlBar(width, height);
  UI.drawButtons(buttons, gameState);
  
  if (gameState.isGameOver) {
    UI.drawGameOver(gameState);
  }
  
  if (gameState.isInLiquidationPhase && !gameState.isGameOver) {
    UI.drawLiquidationPhase(gameState);
  }
};

window.mousePressed = function() {
  // Check game over reset button first
  if (gameState.isGameOver) {
    if (UI.checkGameOverResetClick()) {
      handleReset();
      return;
    }
  }
  
  // Check regular buttons
  const clickedButton = UI.checkButtonClick(buttons, gameState);
  
  if (clickedButton === 'START') {
    handleStart();
  } else if (clickedButton === 'RESET') {
    handleReset();
  } else if (clickedButton === 'BUY') {
    GameLogic.executePlayerTrade(gameState, +1);
  } else if (clickedButton === 'SELL') {
    GameLogic.executePlayerTrade(gameState, -1);
  }
};

// =====================================================
// GAME INITIALIZATION
// =====================================================

async function initializeGame() {
  // Select random trajectory
  gameState.currentTrajectoryId = DataLoader.selectRandomTrajectory(gameState.csvData);
  console.log(`Selected trajectory: ${gameState.currentTrajectoryId}`);
  
  // Extract trajectory data
  const trajectoryData = DataLoader.extractTrajectory(gameState.csvData, gameState.currentTrajectoryId);
  
  if (!trajectoryData) {
    alert('ERROR: Failed to extract trajectory ' + gameState.currentTrajectoryId + ' from CSV data.\n\nThe CSV file may be corrupted.');
    console.error('FATAL: Cannot extract trajectory. Game cannot start.');
    noLoop();
    return;
  }
  
  // Load data into game state
  GameState.loadTrajectoryData(gameState, trajectoryData);
  
  // Truncate to terminal time
  GameState.truncateToTerminalTime(gameState);
  
  // Initialize liquidation parameters
  GameState.initializeLiquidation(gameState);
  
  // Auto-adjust scales
  autoAdjustScales();
  
  // Update initial state
  GameState.updateFromTime(gameState);
}

/**
 * Auto-adjust display scales based on data
 */
function autoAdjustScales() {
  // Depth and resilience scales
  const depthMin = Math.min(...gameState.depthSeries);
  const depthMax = Math.max(...gameState.depthSeries);
  const resMin = Math.min(...gameState.resilienceSeries);
  const resMax = Math.max(...gameState.resilienceSeries);
  
  const depthRange = depthMax - depthMin;
  const resRange = resMax - resMin;
  
  scales.depthMin = Math.max(0, depthMin - 0.1 * depthRange);
  scales.depthMax = depthMax + 0.1 * depthRange;
  scales.resMin = Math.max(0, resMin - 0.1 * resRange);
  scales.resMax = resMax + 0.1 * resRange;
  
  // Price chart Y-axis
  const priceRange = gameState.maxPrice - gameState.minPrice;
  scales.priceYMin = gameState.minPrice - 0.1 * priceRange;
  scales.priceYMax = gameState.maxPrice + 0.1 * priceRange;
  
  console.log(`✓ Auto-adjusted scales: depth [${scales.depthMin.toFixed(1)}, ${scales.depthMax.toFixed(1)}], resilience [${scales.resMin.toFixed(1)}, ${scales.resMax.toFixed(1)}]`);
}

// =====================================================
// BUTTON HANDLERS
// =====================================================

function handleStart() {
  if (gameState.currentTime >= gameState.terminalTime) {
    handleReset();
  } else {
    gameState.isRunning = true;
    console.log('START clicked, isRunning =', gameState.isRunning);
  }
}

async function handleReset() {
  gameState.isRunning = false;
  
  if (!gameState.csvData) {
    alert('ERROR: CSV data not loaded.\n\nPlease reload the page.');
    console.error('FATAL: CSV data not available on reset.');
    return;
  }
  
  // Reset state
  GameState.resetGameState(gameState);
  
  // Load new trajectory
  gameState.currentTrajectoryId = DataLoader.selectRandomTrajectory(gameState.csvData);
  console.log(`Reset: Selected new trajectory ${gameState.currentTrajectoryId}`);
  
  const trajectoryData = DataLoader.extractTrajectory(gameState.csvData, gameState.currentTrajectoryId);
  
  if (!trajectoryData) {
    alert('ERROR: Failed to extract new trajectory.\n\nPlease reload the page.');
    console.error('FATAL: Cannot extract trajectory on reset.');
    return;
  }
  
  // Load data
  GameState.loadTrajectoryData(gameState, trajectoryData);
  
  // Restore configured terminal time
  gameState.terminalTime = CONFIG.initialTerminalTime;
  GameState.truncateToTerminalTime(gameState);
  GameState.initializeLiquidation(gameState);
  
  // Auto-adjust scales
  autoAdjustScales();
  
  // Update state
  GameState.updateFromTime(gameState);
  
  console.log('RESET clicked, market & state reset');
}
