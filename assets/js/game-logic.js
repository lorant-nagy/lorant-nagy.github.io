// =====================================================
// GAME LOGIC
// =====================================================
// Game loop, trading execution, AI behavior, liquidation

import { CONFIG } from './config.js';
import * as Market from './market.js';
import { updateFromTime } from './game-state.js';

/**
 * Execute player trade
 */
export function executePlayerTrade(state, action) {
  if (state.isGameOver || !state.isRunning) {
    console.log('Cannot trade: game is not running or is over');
    return false;
  }
  
  const currentCandleIndex = Math.floor(state.currentTime / CONFIG.pointsPerCandle);
  
  // Check if already traded this candle
  const alreadyTraded = state.playerTrades.some(trade => trade.candleIndex === currentCandleIndex);
  if (alreadyTraded) {
    console.log(`Cannot trade: Already traded on candle ${currentCandleIndex}`);
    return false;
  }
  
  const depth = state.currentDepth;
  const resilience = state.currentResilience;
  const frictionCost = state.linearSpread.valueFor(action, depth, resilience);
  
  // Validate trade (RULE A: wealth must remain non-negative)
  if (!Market.validateTrade(state.cash, state.inventory, action, state.currentPrice, frictionCost)) {
    const currentWealth = Market.calculateWealth(state.cash, state.inventory, state.currentPrice);
    const { cashChange } = Market.executeTrade(action, state.currentPrice, frictionCost);
    const hypotheticalWealth = currentWealth + cashChange + action * state.currentPrice;
    console.log(
      `TRADE REJECTED: Would result in negative wealth. ` +
      `Current wealth=${currentWealth.toFixed(2)}, ` +
      `Hypothetical wealth=${hypotheticalWealth.toFixed(2)}`
    );
    return false;
  }
  
  // Execute trade
  const { cashChange } = Market.executeTrade(action, state.currentPrice, frictionCost);
  state.cash += cashChange;
  state.inventory += action;
  
  // Record trade
  state.playerTrades.push({candleIndex: currentCandleIndex, action: action});
  
  // Update PnL
  state.pnl = Market.calculateWealth(state.cash, state.inventory, state.currentPrice);
  
  // Check if broke
  if (state.pnl <= 0) {
    state.isRunning = false;
    state.isGameOver = true;
    state.gameOverReason = 'broke';
    console.log('Game Over: You are broke after this trade!');
  }
  
  console.log(
    `TRADE EXECUTED: action=${action}, candle=${currentCandleIndex}, t=${state.currentTime}, price=${state.currentPrice.toFixed(4)}, ` +
    `depth=${depth.toFixed(2)}, res=${resilience.toFixed(2)}, friction=${frictionCost.toFixed(4)}, ` +
    `cashChange=${cashChange.toFixed(4)}, wealth=${state.pnl.toFixed(2)}`
  );
  
  return true;
}

/**
 * Process AI trade (normal trading phase)
 */
export function processAITrade(state) {
  if (!CONFIG.aiAgent.enabled) return;
  
  const currentCandleIndex = Math.floor(state.currentTime / CONFIG.pointsPerCandle);
  
  // Check if already traded
  const alreadyTraded = state.aiTrades.some(trade => trade.candleIndex === currentCandleIndex);
  if (alreadyTraded) return;
  
  // Calculate AI action
  const priceDeviation = state.assetPrice[state.currentTime];
  const action = Market.calculateAIAction(
    priceDeviation,
    state.currentDepth,
    CONFIG.aiAgent.c0,
    CONFIG.aiAgent.depthExponent,
    CONFIG.aiAgent.actionThreshold
  );
  
  if (action !== 0) {
    executeAITradeAction(state, action, currentCandleIndex);
  }
}

/**
 * Execute AI trade action
 */
function executeAITradeAction(state, action, candleIndex) {
  const depth = state.currentDepth;
  const resilience = state.currentResilience;
  const frictionCost = state.aiLinearSpread.valueFor(action, depth, resilience);
  
  // Validate trade
  if (!Market.validateTrade(state.aiCash, state.aiInventory, action, state.currentPrice, frictionCost)) {
    return;
  }
  
  // Execute trade
  const { cashChange } = Market.executeTrade(action, state.currentPrice, frictionCost);
  state.aiCash += cashChange;
  state.aiInventory += action;
  state.aiPnl = Market.calculateWealth(state.aiCash, state.aiInventory, state.currentPrice);
  
  // Record trade
  state.aiTrades.push({candleIndex: candleIndex, action: action});
  
  console.log(`AI TRADE: action=${action}, candle=${candleIndex}, price=${state.currentPrice.toFixed(2)}, wealth=${state.aiPnl.toFixed(2)}`);
}

/**
 * Check and enter liquidation phase
 */
export function checkLiquidationEntry(state) {
  if (state.currentTime >= state.liquidationStartTime && !state.isInLiquidationPhase) {
    state.isInLiquidationPhase = true;
    
    // Record initial inventories
    state.playerInventoryAtLiquidationStart = state.inventory;
    state.aiInventoryAtLiquidationStart = state.aiInventory;
    
    // Calculate liquidation period
    const liquidationPeriod = state.terminalTime - state.liquidationStartTime;
    
    // Calculate liquidation rates
    if (liquidationPeriod > 0) {
      state.playerLiquidationRate = Market.calculateLiquidationRate(state.playerInventoryAtLiquidationStart, liquidationPeriod);
      state.aiLiquidationRate = Market.calculateLiquidationRate(state.aiInventoryAtLiquidationStart, liquidationPeriod);
    }
    
    console.log('LIQUIDATION PHASE: Force liquidation started');
    console.log(`  Player: inventory=${state.playerInventoryAtLiquidationStart.toFixed(2)}, rate=${state.playerLiquidationRate.toFixed(4)} shares/step`);
    console.log(`  AI: inventory=${state.aiInventoryAtLiquidationStart.toFixed(2)}, rate=${state.aiLiquidationRate.toFixed(4)} shares/step`);
    console.log(`  Liquidation period: ${liquidationPeriod} steps`);
  }
}

/**
 * Process liquidation trades
 */
export function processLiquidation(state) {
  const currentCandleIndex = Math.floor(state.currentTime / CONFIG.pointsPerCandle);
  state.liquidationStepsElapsed++;
  
  // Player liquidation
  if (state.playerInventoryAtLiquidationStart !== 0 && state.inventory !== 0) {
    const action = Market.calculateLiquidationAction(
      state.playerInventoryAtLiquidationStart,
      state.inventory,
      state.playerLiquidationRate,
      state.liquidationStepsElapsed
    );
    
    if (action !== 0) {
      executeLiquidationTrade(state, action, currentCandleIndex, 'player');
    }
  }
  
  // AI liquidation
  if (CONFIG.aiAgent.enabled && state.aiInventoryAtLiquidationStart !== 0 && state.aiInventory !== 0) {
    const action = Market.calculateLiquidationAction(
      state.aiInventoryAtLiquidationStart,
      state.aiInventory,
      state.aiLiquidationRate,
      state.liquidationStepsElapsed
    );
    
    if (action !== 0) {
      executeLiquidationTrade(state, action, currentCandleIndex, 'ai');
    }
  }
}

/**
 * Execute a forced liquidation trade
 */
function executeLiquidationTrade(state, action, candleIndex, participant) {
  const depth = state.currentDepth;
  const resilience = state.currentResilience;
  
  if (participant === 'player') {
    const frictionCost = state.linearSpread.valueFor(action, depth, resilience);
    const { cashChange } = Market.executeTrade(action, state.currentPrice, frictionCost);
    
    state.cash += cashChange;
    state.inventory += action;
    state.playerTrades.push({candleIndex: candleIndex, action: action});
    state.pnl = Market.calculateWealth(state.cash, state.inventory, state.currentPrice);
    
    console.log(`PLAYER LIQUIDATION: action=${action}, t=${state.currentTime}, remaining=${state.inventory}`);
    
  } else if (participant === 'ai') {
    const frictionCost = state.aiLinearSpread.valueFor(action, depth, resilience);
    const { cashChange } = Market.executeTrade(action, state.currentPrice, frictionCost);
    
    state.aiCash += cashChange;
    state.aiInventory += action;
    state.aiTrades.push({candleIndex: candleIndex, action: action});
    state.aiPnl = Market.calculateWealth(state.aiCash, state.aiInventory, state.currentPrice);
    
    console.log(`AI LIQUIDATION: action=${action}, t=${state.currentTime}, remaining=${state.aiInventory}`);
  }
}

/**
 * Check for game over conditions
 */
export function checkGameOver(state) {
  const currentWealth = Market.calculateWealth(state.cash, state.inventory, state.currentPrice);
  
  if (currentWealth <= 0) {
    state.isRunning = false;
    state.isGameOver = true;
    state.gameOverReason = 'broke';
    console.log('Game Over: Your wealth reached zero!');
    return true;
  }
  
  if (state.currentTime >= state.terminalTime) {
    state.isRunning = false;
    state.isGameOver = true;
    state.gameOverReason = 'time_up';
    console.log('Game Over: Time is up!');
    return true;
  }
  
  return false;
}

/**
 * Advance game by one time step
 */
export function advanceTime(state) {
  if (state.currentTime >= state.terminalTime || state.isGameOver) {
    return;
  }
  
  state.currentTime++;
  updateFromTime(state);
  
  // Check liquidation entry
  checkLiquidationEntry(state);
  
  // Process trades
  if (state.isInLiquidationPhase) {
    processLiquidation(state);
  } else {
    processAITrade(state);
  }
  
  // Check game over
  checkGameOver(state);
}
