// =====================================================
// GAME STATE
// =====================================================
// Centralized game state management

import { CONFIG } from './config.js';
import { LinearSpread } from './market.js';

/**
 * Initialize game state
 */
export function createGameState() {
  return {
    // Time
    currentTime: 0,
    terminalTime: CONFIG.initialTerminalTime,
    
    // Market data
    assetPrice: [],
    depthSeries: [],
    resilienceSeries: [],
    currentPrice: 0.0,
    currentDepth: 0.0,
    currentResilience: 0.0,
    minPrice: 0,
    maxPrice: 0,
    
    // CSV data
    csvData: null,
    currentTrajectoryId: null,
    
    // Player state
    cash: CONFIG.commonCash,
    inventory: CONFIG.initialInventory,
    pnl: 0,
    playerTrades: [],
    linearSpread: new LinearSpread(),
    
    // AI state
    aiCash: CONFIG.commonCash,
    aiInventory: CONFIG.initialInventory,
    aiPnl: 0,
    aiTrades: [],
    aiLinearSpread: new LinearSpread(),
    
    // Liquidation state
    liquidationStartTime: 0,
    isInLiquidationPhase: false,
    playerInventoryAtLiquidationStart: 0,
    aiInventoryAtLiquidationStart: 0,
    playerLiquidationRate: 0,
    aiLiquidationRate: 0,
    liquidationStepsElapsed: 0,
    
    // Game state
    isRunning: false,
    isGameOver: false,
    gameOverReason: ''
  };
}

/**
 * Reset game state for new game
 */
export function resetGameState(state) {
  state.currentTime = 0;
  state.terminalTime = CONFIG.initialTerminalTime;
  
  state.cash = CONFIG.commonCash;
  state.inventory = CONFIG.initialInventory;
  state.pnl = 0;
  state.playerTrades = [];
  state.linearSpread.reset();
  
  state.aiCash = CONFIG.commonCash;
  state.aiInventory = CONFIG.initialInventory;
  state.aiPnl = 0;
  state.aiTrades = [];
  state.aiLinearSpread.reset();
  
  state.liquidationStartTime = 0;
  state.isInLiquidationPhase = false;
  state.playerInventoryAtLiquidationStart = 0;
  state.aiInventoryAtLiquidationStart = 0;
  state.playerLiquidationRate = 0;
  state.aiLiquidationRate = 0;
  state.liquidationStepsElapsed = 0;
  
  state.isRunning = false;
  state.isGameOver = false;
  state.gameOverReason = '';
}

/**
 * Update current market state from time
 */
export function updateFromTime(state) {
  const idx = Math.min(state.currentTime, state.terminalTime);
  state.currentPrice = state.assetPrice[idx];
  state.currentDepth = state.depthSeries[idx];
  state.currentResilience = state.resilienceSeries[idx];
  recomputePnL(state);
}

/**
 * Recompute PnL (mark-to-market)
 */
function recomputePnL(state) {
  state.pnl = state.inventory * state.currentPrice + state.cash;
}

/**
 * Load trajectory data into game state
 */
export function loadTrajectoryData(state, trajectoryData) {
  state.assetPrice = trajectoryData.assetPrice;
  state.depthSeries = trajectoryData.depth;
  state.resilienceSeries = trajectoryData.resilience;
  
  // Compute min/max for price chart
  state.minPrice = Math.min(...state.assetPrice);
  state.maxPrice = Math.max(...state.assetPrice);
}

/**
 * Truncate data to terminal time
 */
export function truncateToTerminalTime(state) {
  const csvLength = state.assetPrice.length - 1;
  
  if (state.terminalTime > csvLength) {
    console.warn(`Warning: Requested terminalTime (${state.terminalTime}) exceeds CSV data length (${csvLength}). Using CSV length.`);
    state.terminalTime = csvLength;
  } else if (state.terminalTime < csvLength) {
    state.assetPrice = state.assetPrice.slice(0, state.terminalTime + 1);
    state.depthSeries = state.depthSeries.slice(0, state.terminalTime + 1);
    state.resilienceSeries = state.resilienceSeries.slice(0, state.terminalTime + 1);
    console.log(`✓ Using first ${state.terminalTime + 1} time steps from CSV (truncated from ${csvLength + 1})`);
  } else {
    console.log(`✓ Using all ${state.terminalTime + 1} time steps from CSV`);
  }
  
  // Recalculate min/max after truncation
  state.minPrice = Math.min(...state.assetPrice);
  state.maxPrice = Math.max(...state.assetPrice);
}

/**
 * Calculate and set liquidation parameters
 */
export function initializeLiquidation(state) {
  state.liquidationStartTime = Math.floor(state.terminalTime * CONFIG.tradingHorizonFraction);
  console.log(`✓ Liquidation starts at t=${state.liquidationStartTime} (${(CONFIG.tradingHorizonFraction * 100).toFixed(0)}% of horizon)`);
}
