// =====================================================
// TRADING GAME - SINGLE FILE IMPLEMENTATION
// =====================================================
// All modules combined into one file

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
  // Data source
  csvPath: 'assets/data/not_bad.csv?v=' + Date.now(),  // Cache-busting
  
  // Time & market
  initialTerminalTime: 50,
  pointsPerCandle: 10,
  zetaStepsPerMarketStep: 4,  // Zeta updates 4x more frequently than market primitives
  minZetaStepsBetweenTrades: 1,  // Can trade once per zeta step (high frequency)
  
  // Liquidation
  tradingHorizonFraction: 0.8,
  
  // Initial wealth
  commonCash: 100,
  initialInventory: 0,
  
  // Chart styling
  chartStyles: {
    depthColor: [80, 120, 200],
    resilienceColor: [200, 80, 120],
    zetaColor: [218, 165, 32],  // Mustard yellow
    fillAlpha: 80,
    lineWeight: 1.5,
    zetaLineWeight: 2.5,
    zetaAlpha: 150,
    depthResHeight: 60,
    zetaHeight: 60,
    legendDotSize: 6,
    priceYMin: 80,
    priceYMax: 120
  },
  
  // AI Agent
  aiAgent: {
    enabled: true,
    c0: 1.88,
    depthExponent: 1/3,
    actionThreshold: 0.5
  },
  
  // Display scales
  scales: {
    depthMin: 0,
    depthMax: 15,
    resMin: 0,
    resMax: 15,
    zetaMin: 0,
    zetaMax: 1,
    inventoryMin: -50,
    inventoryMax: 50,
    cashMin: 0,
    cashMax: 300
  },
  
  // Grid
  gridRows: 50,
  gridCols: 80,
  
  // Canvas
  canvasWidth: 900,
  canvasHeight: 580,  // Increased for zeta chart
  
  // Animation
  stepFrames: 15
};

CONFIG.scales.cashMax = CONFIG.commonCash * 3;

// =====================================================
// MARKET LOGIC
// =====================================================

class LinearSpread {
  constructor() {
    this.zetaHistory = [0.0];
  }

  reset() {
    this.zetaHistory = [0.0];
  }

  valueFor(action, depth, resilience) {
    const prevZeta = this.zetaHistory[this.zetaHistory.length - 1];
    const newZeta =
      Math.exp(-resilience) * prevZeta +
      (1.0 / Math.max(0.1, depth)) * Math.abs(action);

    this.zetaHistory.push(newZeta);
    return newZeta * Math.abs(action);
  }
}

function executeTrade(action, price, frictionCost) {
  const cashChange = -action * price - frictionCost;
  return { cashChange };
}

function calculateWealth(cash, inventory, price) {
  return cash + inventory * price;
}

function validateTrade(currentCash, currentInventory, action, price, frictionCost) {
  const { cashChange } = executeTrade(action, price, frictionCost);
  const newCash = currentCash + cashChange;
  const newInventory = currentInventory + action;
  const newWealth = calculateWealth(newCash, newInventory, price);
  
  return newWealth >= 0;
}

function calculateAIAction(priceDeviation, depth, c0, depthExponent, threshold) {
  const rawAction = -c0 * priceDeviation * Math.pow((1 - (1/depth)), depthExponent);
  
  if (Math.abs(rawAction) >= threshold) {
    return Math.sign(rawAction);
  }
  
  return 0;
}

function calculateLiquidationRate(inventory, liquidationPeriod) {
  if (liquidationPeriod <= 0) return 0;
  return -inventory / liquidationPeriod;
}

function calculateLiquidationAction(initialInventory, currentInventory, rate, stepsElapsed) {
  const targetInventory = initialInventory + (rate * stepsElapsed);
  const desiredAction = Math.round(targetInventory - currentInventory);
  
  if (desiredAction === 0) return 0;
  
  if (currentInventory !== 0 && Math.sign(currentInventory) !== Math.sign(currentInventory + desiredAction)) {
    return -currentInventory;
  }
  
  return desiredAction;
}

// =====================================================
// DATA LOADER
// =====================================================

async function loadCSVData(csvPath) {
  try {
    console.log(`Loading CSV from: ${csvPath}`);
    
    const response = await fetch(csvPath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => !line.startsWith('#') && line.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const row = {
        trajectory_id: parseInt(values[0]),
        time: parseInt(values[1]),
        asset_price: parseFloat(values[2]),
        depth: parseFloat(values[3]),
        resilience: parseFloat(values[4])
      };
      data.push(row);
    }
    
    console.log(`✓ Loaded ${data.length} data points`);
    
    const trajectories = {};
    data.forEach(row => {
      if (!trajectories[row.trajectory_id]) {
        trajectories[row.trajectory_id] = [];
      }
      trajectories[row.trajectory_id].push(row);
    });
    
    Object.keys(trajectories).forEach(id => {
      trajectories[id].sort((a, b) => a.time - b.time);
    });
    
    const numTrajectories = Object.keys(trajectories).length;
    console.log(`✓ Parsed ${numTrajectories} trajectories`);
    
    return trajectories;
    
  } catch (error) {
    console.error('Error loading CSV:', error);
    return null;
  }
}

function extractTrajectory(trajectories, trajectoryId) {
  const trajectory = trajectories[trajectoryId];
  
  if (!trajectory) {
    console.error(`Trajectory ${trajectoryId} not found!`);
    return null;
  }
  
  const assetPrice = [];
  const depth = [];
  const resilience = [];
  
  trajectory.forEach(row => {
    assetPrice.push(row.asset_price);
    depth.push(row.depth);
    resilience.push(row.resilience);
  });
  
  console.log(`✓ Extracted trajectory ${trajectoryId} with ${assetPrice.length} time steps`);
  
  return { assetPrice, depth, resilience };
}

function selectRandomTrajectory(trajectories) {
  const trajectoryIds = Object.keys(trajectories).map(id => parseInt(id));
  const randomIndex = Math.floor(Math.random() * trajectoryIds.length);
  return trajectoryIds[randomIndex];
}

// =====================================================
// GAME STATE
// =====================================================

function createGameState() {
  return {
    currentTime: 0,
    currentZetaTime: 0,  // High-frequency time for zeta process
    lastTradeZetaTime: -999,  // Last zeta time when trade occurred
    terminalTime: CONFIG.initialTerminalTime,
    
    assetPrice: [],
    depthSeries: [],
    resilienceSeries: [],
    zetaSeries: [0.0],  // Track zeta (spread) over time
    currentPrice: 0.0,
    currentDepth: 0.0,
    currentResilience: 0.0,
    minPrice: 0,
    maxPrice: 0,
    
    csvData: null,
    currentTrajectoryId: null,
    
    cash: CONFIG.commonCash,
    inventory: CONFIG.initialInventory,
    pnl: 0,
    playerTrades: [],
    linearSpread: new LinearSpread(),
    
    aiCash: CONFIG.commonCash,
    aiInventory: CONFIG.initialInventory,
    aiPnl: 0,
    aiTrades: [],
    aiLinearSpread: new LinearSpread(),
    
    liquidationStartTime: 0,
    isInLiquidationPhase: false,
    playerInventoryAtLiquidationStart: 0,
    aiInventoryAtLiquidationStart: 0,
    playerLiquidationRate: 0,
    aiLiquidationRate: 0,
    liquidationStepsElapsed: 0,
    
    isRunning: false,
    isGameOver: false,
    gameOverReason: ''
  };
}

function resetGameState(state) {
  state.currentTime = 0;
  state.currentZetaTime = 0;
  state.lastTradeZetaTime = -999;
  state.terminalTime = CONFIG.initialTerminalTime;
  
  state.cash = CONFIG.commonCash;
  state.inventory = CONFIG.initialInventory;
  state.pnl = 0;
  state.playerTrades = [];
  state.linearSpread.reset();
  state.zetaSeries = [0.0];  // Reset zeta
  
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

function updateFromTime(state) {
  const idx = Math.min(state.currentTime, state.terminalTime);
  state.currentPrice = state.assetPrice[idx];
  state.currentDepth = state.depthSeries[idx];
  state.currentResilience = state.resilienceSeries[idx];
  recomputePnL(state);
}

function recomputePnL(state) {
  state.pnl = state.inventory * state.currentPrice + state.cash;
}

function loadTrajectoryData(state, trajectoryData) {
  state.assetPrice = trajectoryData.assetPrice;
  state.depthSeries = trajectoryData.depth;
  state.resilienceSeries = trajectoryData.resilience;
  
  state.minPrice = Math.min(...state.assetPrice);
  state.maxPrice = Math.max(...state.assetPrice);
  
  // DIAGNOSTIC: Log first few values to verify data
  console.log('=== DIAGNOSTIC: First 5 data points ===');
  for (let i = 0; i < Math.min(5, state.depthSeries.length); i++) {
    console.log(`t=${i}: price=${state.assetPrice[i].toFixed(4)}, depth=${state.depthSeries[i].toFixed(4)}, resilience=${state.resilienceSeries[i].toFixed(4)}`);
  }
  console.log(`Depth range: [${Math.min(...state.depthSeries).toFixed(2)}, ${Math.max(...state.depthSeries).toFixed(2)}]`);
  console.log(`Resilience range: [${Math.min(...state.resilienceSeries).toFixed(2)}, ${Math.max(...state.resilienceSeries).toFixed(2)}]`);
}

function truncateToTerminalTime(state) {
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
  
  state.minPrice = Math.min(...state.assetPrice);
  state.maxPrice = Math.max(...state.assetPrice);
}

function initializeLiquidation(state) {
  state.liquidationStartTime = Math.floor(state.terminalTime * CONFIG.tradingHorizonFraction);
  console.log(`✓ Liquidation starts at t=${state.liquidationStartTime} (${(CONFIG.tradingHorizonFraction * 100).toFixed(0)}% of horizon)`);
}

// =====================================================
// GAME LOGIC
// =====================================================

function executePlayerTrade(state, action) {
  if (state.isGameOver || !state.isRunning) {
    console.log('Cannot trade: game is not running or is over');
    return false;
  }
  
  // High-frequency rate limiting based on zeta time
  const zetaStepsSinceLastTrade = state.currentZetaTime - state.lastTradeZetaTime;
  if (zetaStepsSinceLastTrade < CONFIG.minZetaStepsBetweenTrades) {
    console.log(`Cannot trade: Rate limit (need ${CONFIG.minZetaStepsBetweenTrades} zeta steps, only ${zetaStepsSinceLastTrade} elapsed)`);
    return false;
  }
  
  const currentCandleIndex = Math.floor(state.currentTime / CONFIG.pointsPerCandle);
  
  const depth = state.currentDepth;
  const resilience = state.currentResilience;
  const frictionCost = state.linearSpread.valueFor(action, depth, resilience);
  
  if (!validateTrade(state.cash, state.inventory, action, state.currentPrice, frictionCost)) {
    const currentWealth = calculateWealth(state.cash, state.inventory, state.currentPrice);
    const { cashChange } = executeTrade(action, state.currentPrice, frictionCost);
    const hypotheticalWealth = currentWealth + cashChange + action * state.currentPrice;
    console.log(
      `TRADE REJECTED: Would result in negative wealth. ` +
      `Current wealth=${currentWealth.toFixed(2)}, ` +
      `Hypothetical wealth=${hypotheticalWealth.toFixed(2)}`
    );
    return false;
  }
  
  const { cashChange } = executeTrade(action, state.currentPrice, frictionCost);
  state.cash += cashChange;
  state.inventory += action;
  
  // Increment zeta time immediately on trade
  state.currentZetaTime++;
  
  state.playerTrades.push({
    candleIndex: currentCandleIndex, 
    action: action,
    time: state.currentTime,
    zetaTime: state.currentZetaTime
  });
  
  // Update last trade time
  state.lastTradeZetaTime = state.currentZetaTime;
  
  // Update zeta immediately - it jumps up when trade occurs
  const prevZeta = state.zetaSeries[state.zetaSeries.length - 1];
  const newZeta = Math.exp(-resilience / CONFIG.zetaStepsPerMarketStep) * prevZeta + (1.0 / Math.max(0.1, depth)) * Math.abs(action);
  state.zetaSeries.push(newZeta);
  
  state.pnl = calculateWealth(state.cash, state.inventory, state.currentPrice);
  
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

function processAITrade(state) {
  if (!CONFIG.aiAgent.enabled) return;
  
  const currentCandleIndex = Math.floor(state.currentTime / CONFIG.pointsPerCandle);
  
  const alreadyTraded = state.aiTrades.some(trade => trade.candleIndex === currentCandleIndex);
  if (alreadyTraded) return;
  
  const priceDeviation = state.assetPrice[state.currentTime];
  const action = calculateAIAction(
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

function executeAITradeAction(state, action, candleIndex) {
  const depth = state.currentDepth;
  const resilience = state.currentResilience;
  const frictionCost = state.aiLinearSpread.valueFor(action, depth, resilience);
  
  if (!validateTrade(state.aiCash, state.aiInventory, action, state.currentPrice, frictionCost)) {
    return;
  }
  
  const { cashChange } = executeTrade(action, state.currentPrice, frictionCost);
  state.aiCash += cashChange;
  state.aiInventory += action;
  state.aiPnl = calculateWealth(state.aiCash, state.aiInventory, state.currentPrice);
  
  state.aiTrades.push({
    candleIndex: candleIndex, 
    action: action,
    time: state.currentTime,
    zetaTime: state.currentZetaTime
  });
  
  console.log(`AI TRADE: action=${action}, candle=${candleIndex}, price=${state.currentPrice.toFixed(2)}, wealth=${state.aiPnl.toFixed(2)}`);
}

function checkLiquidationEntry(state) {
  if (state.currentTime >= state.liquidationStartTime && !state.isInLiquidationPhase) {
    state.isInLiquidationPhase = true;
    
    state.playerInventoryAtLiquidationStart = state.inventory;
    state.aiInventoryAtLiquidationStart = state.aiInventory;
    
    const liquidationPeriod = state.terminalTime - state.liquidationStartTime;
    
    if (liquidationPeriod > 0) {
      state.playerLiquidationRate = calculateLiquidationRate(state.playerInventoryAtLiquidationStart, liquidationPeriod);
      state.aiLiquidationRate = calculateLiquidationRate(state.aiInventoryAtLiquidationStart, liquidationPeriod);
    }
    
    console.log('LIQUIDATION PHASE: Force liquidation started');
    console.log(`  Player: inventory=${state.playerInventoryAtLiquidationStart.toFixed(2)}, rate=${state.playerLiquidationRate.toFixed(4)} shares/step`);
    console.log(`  AI: inventory=${state.aiInventoryAtLiquidationStart.toFixed(2)}, rate=${state.aiLiquidationRate.toFixed(4)} shares/step`);
    console.log(`  Liquidation period: ${liquidationPeriod} steps`);
  }
}

function processLiquidation(state) {
  const currentCandleIndex = Math.floor(state.currentTime / CONFIG.pointsPerCandle);
  state.liquidationStepsElapsed++;
  
  if (state.playerInventoryAtLiquidationStart !== 0 && state.inventory !== 0) {
    const action = calculateLiquidationAction(
      state.playerInventoryAtLiquidationStart,
      state.inventory,
      state.playerLiquidationRate,
      state.liquidationStepsElapsed
    );
    
    if (action !== 0) {
      executeLiquidationTrade(state, action, currentCandleIndex, 'player');
    }
  }
  
  if (CONFIG.aiAgent.enabled && state.aiInventoryAtLiquidationStart !== 0 && state.aiInventory !== 0) {
    const action = calculateLiquidationAction(
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

function executeLiquidationTrade(state, action, candleIndex, participant) {
  const depth = state.currentDepth;
  const resilience = state.currentResilience;
  
  if (participant === 'player') {
    const frictionCost = state.linearSpread.valueFor(action, depth, resilience);
    const { cashChange } = executeTrade(action, state.currentPrice, frictionCost);
    
    state.cash += cashChange;
    state.inventory += action;
    state.playerTrades.push({
      candleIndex: candleIndex, 
      action: action,
      time: state.currentTime,
      zetaTime: state.currentZetaTime
    });
    state.pnl = calculateWealth(state.cash, state.inventory, state.currentPrice);
    
    // Update zeta for liquidation trade
    const prevZeta = state.zetaSeries[state.zetaSeries.length - 1];
    const newZeta = Math.exp(-resilience) * prevZeta + (1.0 / Math.max(0.1, depth)) * Math.abs(action);
    state.zetaSeries.push(newZeta);
    
    console.log(`PLAYER LIQUIDATION: action=${action}, t=${state.currentTime}, remaining=${state.inventory}`);
    
  } else if (participant === 'ai') {
    const frictionCost = state.aiLinearSpread.valueFor(action, depth, resilience);
    const { cashChange } = executeTrade(action, state.currentPrice, frictionCost);
    
    state.aiCash += cashChange;
    state.aiInventory += action;
    state.aiTrades.push({
      candleIndex: candleIndex, 
      action: action,
      time: state.currentTime,
      zetaTime: state.currentZetaTime
    });
    state.aiPnl = calculateWealth(state.aiCash, state.aiInventory, state.currentPrice);
    
    console.log(`AI LIQUIDATION: action=${action}, t=${state.currentTime}, remaining=${state.aiInventory}`);
  }
}

function checkGameOver(state) {
  const currentWealth = calculateWealth(state.cash, state.inventory, state.currentPrice);
  
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

function advanceTime(state) {
  if (state.currentTime >= state.terminalTime || state.isGameOver) {
    return;
  }
  
  // Advance market time (slow clock)
  state.currentTime++;
  updateFromTime(state);
  
  // Process zeta decay steps between the last zeta time and where we should be now
  const targetZetaTime = state.currentTime * CONFIG.zetaStepsPerMarketStep;
  
  while (state.currentZetaTime < targetZetaTime) {
    state.currentZetaTime++;
    
    // Zeta decays exponentially at each zeta step (only if no trade just happened)
    const prevZeta = state.zetaSeries[state.zetaSeries.length - 1];
    const decayedZeta = prevZeta * Math.exp(-state.currentResilience / CONFIG.zetaStepsPerMarketStep);
    state.zetaSeries.push(decayedZeta);
  }
  
  checkLiquidationEntry(state);
  
  if (state.isInLiquidationPhase) {
    processLiquidation(state);
  } else {
    processAITrade(state);
  }
  
  checkGameOver(state);
}

// =====================================================
// RENDERING
// =====================================================

function mapValueToY(value, minVal, maxVal, top, height) {
  if (maxVal <= minVal) return top + height / 2;
  const ratio = (value - minVal) / (maxVal - minVal);
  const clamped = Math.min(1, Math.max(0, ratio));
  return top + (1 - clamped) * height;
}

function drawGrid(width, height, cellW, cellH) {
  stroke(240);
  strokeWeight(1);

  for (let r = 0; r <= CONFIG.gridRows; r++) {
    const y = r * cellH;
    line(0, y, width, y);
  }

  for (let c = 0; c <= CONFIG.gridCols; c++) {
    const x = c * cellW;
    line(x, 0, x, height);
  }
}

function drawControlBar(width, height) {
  noStroke();
  fill(245);
  rect(0, height - 80, width, 80);
}

function drawPriceChart(left, right, top, height, gameState, scales) {
  if (!gameState.assetPrice || gameState.assetPrice.length === 0) return;

  const nSteps = gameState.assetPrice.length - 1;
  if (nSteps <= 0) return;

  const endIndex = Math.min(gameState.currentTime, nSteps);
  const chartWidth = right - left;

  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, chartWidth + 20, height + 10, 5);

  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);
  text('Price', left - 5, top - 18);

  const totalCandles = Math.ceil(nSteps / CONFIG.pointsPerCandle);
  const candleSpacing = 2;
  const candleWidth = Math.max(2, (chartWidth - (totalCandles - 1) * candleSpacing) / totalCandles);
  
  const numCandles = Math.floor(endIndex / CONFIG.pointsPerCandle);
  
  for (let i = 0; i < numCandles; i++) {
    drawCandle(i, left, candleWidth, candleSpacing, top, height, gameState, scales);
  }
  
  if (endIndex % CONFIG.pointsPerCandle !== 0 && numCandles * CONFIG.pointsPerCandle < endIndex) {
    drawPartialCandle(numCandles, endIndex, left, candleWidth, candleSpacing, top, height, gameState, scales);
  }
  
  drawLiquidationBoundary(left, candleWidth, candleSpacing, top, height, gameState);
}

function drawCandle(index, left, candleWidth, candleSpacing, top, height, gameState, scales) {
  const startIdx = index * CONFIG.pointsPerCandle;
  const endIdx = Math.min(startIdx + CONFIG.pointsPerCandle, Math.min(gameState.currentTime, gameState.assetPrice.length - 1) + 1);
  
  const open = gameState.assetPrice[startIdx];
  const close = gameState.assetPrice[endIdx - 1];
  
  let high = open;
  let low = open;
  for (let j = startIdx; j < endIdx; j++) {
    const price = gameState.assetPrice[j];
    high = Math.max(high, price);
    low = Math.min(low, price);
  }
  
  const candleX = left + index * (candleWidth + candleSpacing);
  const openY = mapValueToY(open, scales.priceYMin, scales.priceYMax, top, height);
  const closeY = mapValueToY(close, scales.priceYMin, scales.priceYMax, top, height);
  const highY = mapValueToY(high, scales.priceYMin, scales.priceYMax, top, height);
  const lowY = mapValueToY(low, scales.priceYMin, scales.priceYMax, top, height);
  
  const isGreen = close >= open;
  const candleColor = isGreen ? color(50, 200, 50) : color(200, 50, 50);
  
  stroke(100);
  strokeWeight(1);
  line(candleX + candleWidth / 2, highY, candleX + candleWidth / 2, lowY);
  
  noStroke();
  fill(candleColor);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(2, Math.abs(closeY - openY));
  rect(candleX, bodyTop, candleWidth, bodyHeight);
}

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
  
  stroke(100);
  strokeWeight(1);
  line(candleX + candleWidth / 2, highY, candleX + candleWidth / 2, lowY);
  
  noStroke();
  fill(candleColor);
  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(2, Math.abs(closeY - openY));
  rect(candleX, bodyTop, candleWidth, bodyHeight);
}

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

function drawTradeMarkers(left, right, yPosition, gameState) {
  const nSteps = gameState.assetPrice.length - 1;
  if (nSteps <= 0) return;

  const chartWidth = right - left;
  const totalCandles = Math.ceil(nSteps / CONFIG.pointsPerCandle);
  const candleSpacing = 2;
  const candleWidth = Math.max(2, (chartWidth - (totalCandles - 1) * candleSpacing) / totalCandles);
  
  const stripeHeight = 28;  // Increased for text
  const stripeSpacing = 2;
  
  const aiStripeY = yPosition;
  const aiMarkerY = aiStripeY + stripeHeight / 2;
  
  const playerStripeY = aiStripeY + stripeHeight + stripeSpacing;
  const playerMarkerY = playerStripeY + stripeHeight / 2;
  
  // Background stripes
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
  
  // Count AI trades per candle
  const aiTradesPerCandle = {};
  gameState.aiTrades.forEach(trade => {
    if (!aiTradesPerCandle[trade.candleIndex]) {
      aiTradesPerCandle[trade.candleIndex] = { buys: 0, sells: 0 };
    }
    if (trade.action > 0) {
      aiTradesPerCandle[trade.candleIndex].buys++;
    } else {
      aiTradesPerCandle[trade.candleIndex].sells++;
    }
  });
  
  // Count player trades per candle
  const playerTradesPerCandle = {};
  gameState.playerTrades.forEach(trade => {
    if (!playerTradesPerCandle[trade.candleIndex]) {
      playerTradesPerCandle[trade.candleIndex] = { buys: 0, sells: 0 };
    }
    if (trade.action > 0) {
      playerTradesPerCandle[trade.candleIndex].buys++;
    } else {
      playerTradesPerCandle[trade.candleIndex].sells++;
    }
  });
  
  // Draw AI trade counts
  textSize(9);
  textAlign(CENTER, CENTER);
  Object.keys(aiTradesPerCandle).forEach(candleIndex => {
    const idx = parseInt(candleIndex);
    const candleX = left + idx * (candleWidth + candleSpacing) + candleWidth / 2;
    const counts = aiTradesPerCandle[candleIndex];
    
    // Green for buys (left side)
    if (counts.buys > 0) {
      fill(50, 200, 50);
      text(counts.buys, candleX - 5, aiMarkerY);
    }
    
    // Red for sells (right side)
    if (counts.sells > 0) {
      fill(200, 50, 50);
      text(counts.sells, candleX + 5, aiMarkerY);
    }
  });
  
  // Draw player trade counts
  Object.keys(playerTradesPerCandle).forEach(candleIndex => {
    const idx = parseInt(candleIndex);
    const candleX = left + idx * (candleWidth + candleSpacing) + candleWidth / 2;
    const counts = playerTradesPerCandle[candleIndex];
    
    // Green for buys (left side)
    if (counts.buys > 0) {
      fill(50, 200, 50);
      text(counts.buys, candleX - 5, playerMarkerY);
    }
    
    // Red for sells (right side)
    if (counts.sells > 0) {
      fill(200, 50, 50);
      text(counts.sells, candleX + 5, playerMarkerY);
    }
  });
}

function drawTradeTriangle(x, y, size, action) {
  noStroke();
  if (action > 0) {
    fill(50, 200, 50);
    triangle(x, y - size/2, x - size/2, y + size/2, x + size/2, y + size/2);
  } else {
    fill(200, 50, 50);
    triangle(x, y + size/2, x - size/2, y - size/2, x + size/2, y - size/2);
  }
}

function drawDepthResilienceChart(left, right, top, height, gameState, scales) {
  if (!gameState.depthSeries || gameState.depthSeries.length === 0) return;
  if (!gameState.resilienceSeries || gameState.resilienceSeries.length === 0) return;

  const nSteps = gameState.depthSeries.length - 1;
  if (nSteps <= 0) return;

  const xSpan = right - left;
  const endIndex = Math.min(gameState.currentTime, nSteps);
  const chartWidth = right - left;

  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, chartWidth + 20, height + 10, 5);

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

  stroke(230);
  strokeWeight(0.5);
  const numScaleLines = 5;
  for (let i = 0; i <= numScaleLines; i++) {
    const y = top + (i / numScaleLines) * height;
    line(left, y, right, y);
  }
  
  // Depth scale labels (left side)
  noStroke();
  fill(150);
  textAlign(RIGHT, CENTER);
  textSize(9);
  for (let i = 0; i <= numScaleLines; i++) {
    const value = scales.depthMax - (i / numScaleLines) * (scales.depthMax - scales.depthMin);
    const y = top + (i / numScaleLines) * height;
    text(value.toFixed(2), left - 5, y);
  }
  
  // Resilience scale labels (right side)
  textAlign(LEFT, CENTER);
  for (let i = 0; i <= numScaleLines; i++) {
    const value = scales.resMax - (i / numScaleLines) * (scales.resMax - scales.resMin);
    const y = top + (i / numScaleLines) * height;
    text(value.toFixed(2), right + 5, y);
  }

  drawSeriesArea(left, top, height, xSpan, nSteps, endIndex, gameState.depthSeries, scales.depthMin, scales.depthMax, CONFIG.chartStyles.depthColor, CONFIG.chartStyles.fillAlpha);
  drawSeriesLine(left, top, height, xSpan, nSteps, endIndex, gameState.depthSeries, scales.depthMin, scales.depthMax, CONFIG.chartStyles.depthColor, CONFIG.chartStyles.lineWeight);

  drawSeriesArea(left, top, height, xSpan, nSteps, endIndex, gameState.resilienceSeries, scales.resMin, scales.resMax, CONFIG.chartStyles.resilienceColor, CONFIG.chartStyles.fillAlpha);
  drawSeriesLine(left, top, height, xSpan, nSteps, endIndex, gameState.resilienceSeries, scales.resMin, scales.resMax, CONFIG.chartStyles.resilienceColor, CONFIG.chartStyles.lineWeight);
}

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

function drawZetaChart(left, right, top, height, gameState, scales) {
  if (!gameState.zetaSeries || gameState.zetaSeries.length === 0) return;
  if (!gameState.assetPrice || gameState.assetPrice.length === 0) return;

  const nSteps = gameState.assetPrice.length - 1;
  if (nSteps <= 0) return;

  const xSpan = right - left;
  const totalZetaSteps = nSteps * CONFIG.zetaStepsPerMarketStep;
  const currentZetaIndex = Math.min(gameState.currentZetaTime, gameState.zetaSeries.length - 1);
  const chartWidth = right - left;

  // Panel background
  stroke(200);
  fill(255, 255, 255, 220);
  rect(left - 10, top - 5, chartWidth + 20, height + 10, 5);

  // Legend
  const legendX = right - 50;
  const legendY = top + 8;
  
  noStroke();
  fill(...CONFIG.chartStyles.zetaColor);
  circle(legendX, legendY, CONFIG.chartStyles.legendDotSize);
  fill(0);
  textAlign(LEFT, CENTER);
  textSize(10);
  text('Zeta', legendX + 8, legendY);

  // Scale lines
  stroke(230);
  strokeWeight(0.5);
  const numScaleLines = 5;
  for (let i = 0; i <= numScaleLines; i++) {
    const y = top + (i / numScaleLines) * height;
    line(left, y, right, y);
  }
  
  // Scale labels
  noStroke();
  fill(150);
  textAlign(RIGHT, CENTER);
  textSize(9);
  for (let i = 0; i <= numScaleLines; i++) {
    const value = scales.zetaMax - (i / numScaleLines) * (scales.zetaMax - scales.zetaMin);
    const y = top + (i / numScaleLines) * height;
    text(value.toFixed(2), left - 5, y);
  }

  // Draw zeta series up to current zeta time
  const zetaToDisplay = gameState.zetaSeries.slice(0, currentZetaIndex + 1);
  
  if (zetaToDisplay.length === 0) return;
  
  // Area
  noStroke();
  fill(...CONFIG.chartStyles.zetaColor, CONFIG.chartStyles.zetaAlpha);
  beginShape();
  vertex(left, top + height);
  for (let t = 0; t < zetaToDisplay.length; t++) {
    const val = zetaToDisplay[t];
    const x = left + (t / totalZetaSteps) * xSpan;
    const y = mapValueToY(val, scales.zetaMin, scales.zetaMax, top, height);
    vertex(x, y);
  }
  vertex(left + ((zetaToDisplay.length - 1) / totalZetaSteps) * xSpan, top + height);
  endShape(CLOSE);
  
  // Line
  stroke(...CONFIG.chartStyles.zetaColor);
  strokeWeight(CONFIG.chartStyles.zetaLineWeight);
  noFill();
  beginShape();
  for (let t = 0; t < zetaToDisplay.length; t++) {
    const val = zetaToDisplay[t];
    const x = left + (t / totalZetaSteps) * xSpan;
    const y = mapValueToY(val, scales.zetaMin, scales.zetaMax, top, height);
    vertex(x, y);
  }
  endShape();
}


function drawThermometerBars(startX, top, height, gameState, scales) {
  const barWidth = 40;
  const barSpacing = 50;
  const barHeight = height - 20;
  const barTop = top + 10;
  
  const playerCashX = startX;
  const playerInvX = startX + barSpacing;
  
  drawThermometer(playerCashX, barTop, barWidth, barHeight, gameState.cash, scales.cashMin, scales.cashMax, 'P:Cash');
  drawThermometer(playerInvX, barTop, barWidth, barHeight, gameState.inventory, scales.inventoryMin, scales.inventoryMax, 'P:Inv');
  
  if (CONFIG.aiAgent.enabled) {
    const aiCashX = startX + barSpacing * 2 + 15;
    const aiInvX = startX + barSpacing * 3 + 15;
    
    drawThermometer(aiCashX, barTop, barWidth, barHeight, gameState.aiCash, scales.cashMin, scales.cashMax, 'AI:Cash');
    drawThermometer(aiInvX, barTop, barWidth, barHeight, gameState.aiInventory, scales.inventoryMin, scales.inventoryMax, 'AI:Inv');
  }
}

function drawThermometer(x, top, width, height, currentValue, minValue, maxValue, label) {
  const range = maxValue - minValue;
  const isCashThermometer = label.includes('Cash');
  
  stroke(200);
  strokeWeight(1);
  fill(245);
  rect(x, top, width, height, 5);
  
  if (isCashThermometer) {
    drawCashGridLines(x, top, width, height, minValue, maxValue, range);
  } else {
    drawInventoryGridLines(x, top, width, height, minValue, maxValue, range);
  }
  
  drawThermometerFill(x, top, width, height, currentValue, minValue, maxValue, range, isCashThermometer);
  
  fill(0);
  textAlign(CENTER, TOP);
  textSize(9);
  text(label, x + width / 2, top - 15);
  
  textSize(8);
  function formatValue(value) {
    if (Math.abs(value) < 1) {
      return value.toFixed(4);
    } else if (Math.abs(value) < 100) {
      return value.toFixed(2);
    } else {
      return value.toFixed(1);
    }
  }

  text(formatValue(currentValue), x + width / 2, top + height + 3);
}

function drawCashGridLines(x, top, width, height, minValue, maxValue, range) {
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

function drawInventoryGridLines(x, top, width, height, minValue, maxValue, range) {
  stroke(220);
  strokeWeight(0.5);
  const numLines = 10;
  for (let i = 0; i <= numLines; i++) {
    const y = top + (i / numLines) * height;
    line(x, y, x + width, y);
  }
  
  const zeroNormalized = (0 - minValue) / range;
  if (zeroNormalized >= 0 && zeroNormalized <= 1) {
    const zeroY = top + (1 - zeroNormalized) * height;
    stroke(100);
    strokeWeight(1.5);
    line(x, zeroY, x + width, zeroY);
  }
}

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

function drawCharts(gameState, scales) {
  const left = 40;
  const right = 580;
  const priceTop = 20;
  const priceHeight = 250;
  const tradeMarkersHeight = 58;  // Increased from 44 to 58 for numeric display
  const depthResTop = priceTop + priceHeight + tradeMarkersHeight + 5;
  const depthResHeight = CONFIG.chartStyles.depthResHeight;
  const zetaTop = depthResTop + depthResHeight + 10;
  const zetaHeight = CONFIG.chartStyles.zetaHeight;

  drawPriceChart(left, right, priceTop, priceHeight, gameState, scales);
  drawTradeMarkers(left, right, priceTop + priceHeight + 5, gameState);
  drawDepthResilienceChart(left, right, depthResTop, depthResHeight, gameState, scales);
  drawZetaChart(left, right, zetaTop, zetaHeight, gameState, scales);
  drawThermometerBars(right + 30, priceTop, priceHeight + tradeMarkersHeight + 5 + depthResHeight + 10 + zetaHeight, gameState, scales);
}

// =====================================================
// UI
// =====================================================

function drawButtons(buttons, gameState) {
  textAlign(CENTER, CENTER);
  textSize(14);

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
      // High-frequency trading enabled - only check if running and not in liquidation
      isClickable = gameState.isRunning && !gameState.isInLiquidationPhase;
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

function drawGameOver(gameState) {
  noStroke();
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  const boxW = 500;
  const boxH = 280;
  const boxX = (width - boxW) / 2;
  const boxY = (height - boxH) / 2;
  
  stroke(0);
  strokeWeight(3);
  fill(255);
  rect(boxX, boxY, boxW, boxH, 10);
  
  noStroke();
  fill(200, 50, 50);
  textAlign(CENTER, CENTER);
  textSize(36);
  text('GAME OVER', width / 2, boxY + 40);
  
  const playerWealth = gameState.cash + gameState.inventory * gameState.currentPrice;
  const aiWealth = gameState.aiCash + gameState.aiInventory * gameState.currentPrice;
  
  let winner = '';
  if (playerWealth > aiWealth) {
    winner = 'PLAYER WINS!';
  } else if (aiWealth > playerWealth) {
    winner = 'AI WINS!';
  } else {
    winner = 'TIE!';
  }
  
  fill(50, 150, 50);
  textSize(24);
  text(winner, width / 2, boxY + 85);
  
  const leftX = boxX + boxW / 4;
  const rightX = boxX + 3 * boxW / 4;
  const cashY = boxY + 140;
  
  fill(0);
  textSize(18);
  text('PLAYER', leftX, boxY + 115);
  
  textSize(24);
  fill(playerWealth > aiWealth ? color(50, 150, 50) : color(0));
  text(`$${playerWealth.toFixed(2)}`, leftX, cashY);
  
  fill(0);
  textSize(18);
  text('AI AGENT', rightX, boxY + 115);
  
  textSize(24);
  fill(aiWealth > playerWealth ? color(50, 150, 50) : color(0));
  text(`$${aiWealth.toFixed(2)}`, rightX, cashY);
  
  stroke(200);
  strokeWeight(2);
  line(width / 2, boxY + 105, width / 2, boxY + 165);
  
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
  
  return { btnX, btnY, btnW, btnH };
}

function drawLiquidationPhase(gameState) {
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

function initButtons(canvasHeight) {
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

function checkButtonClick(buttons, gameState) {
  for (const btn of buttons) {
    if (mouseX >= btn.x && mouseX <= btn.x + btn.w &&
        mouseY >= btn.y && mouseY <= btn.y + btn.h) {
      
      let isClickable = true;
      
      if (gameState.isGameOver) {
        isClickable = (btn.label === 'RESET');
      } else if (btn.label === 'START') {
        isClickable = !gameState.isRunning;
      } else if (btn.label === 'BUY' || btn.label === 'SELL') {
        // High-frequency trading enabled
        isClickable = gameState.isRunning && !gameState.isInLiquidationPhase;
      }
      
      if (isClickable) {
        return btn.label;
      }
    }
  }
  
  return null;
}

function checkGameOverResetClick() {
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

// =====================================================
// MAIN GAME ORCHESTRATION
// =====================================================

let gameState;
let buttons;
let cellW, cellH;
let scales = { ...CONFIG.scales };

window.setup = async function() {
  console.log('=== SETUP FUNCTION CALLED ===');
  console.log('p5.js loaded:', typeof createCanvas !== 'undefined');
  console.log('Creating canvas...');
  
  const canvas = createCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);
  canvas.parent('game-container');
  
  console.log('Canvas created successfully');
  console.log('Canvas size:', width, 'x', height);

  cellW = width / CONFIG.gridCols;
  cellH = height / CONFIG.gridRows;

  gameState = createGameState();

  console.log('Loading market primitives from CSV...');
  console.log('CSV path:', CONFIG.csvPath);
  gameState.csvData = await loadCSVData(CONFIG.csvPath);
  
  if (!gameState.csvData) {
    alert('ERROR: Failed to load CSV data from ' + CONFIG.csvPath + '\n\nPlease check:\n1. The file path is correct\n2. The file exists\n3. The file format is valid');
    console.error('FATAL: Cannot load CSV data. Game cannot start.');
    noLoop();
    return;
  }
  
  await initializeGame();
  
  buttons = initButtons(CONFIG.canvasHeight);
};

window.draw = function() {
  background(255);

  // Don't draw anything until setup is complete
  if (!gameState || !buttons) {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(16);
    text('Loading...', width / 2, height / 2);
    return;
  }

  if (gameState.isRunning && frameCount % CONFIG.stepFrames === 0 && !gameState.isGameOver) {
    advanceTime(gameState);
    
    // Dynamically adjust zeta scale as data evolves
    if (gameState.zetaSeries && gameState.zetaSeries.length > 1) {
      const zetaMax = Math.max(...gameState.zetaSeries);
      if (zetaMax > scales.zetaMax) {
        scales.zetaMax = zetaMax * 1.1;  // Add 10% padding
      }
    }
  }

  drawGrid(width, height, cellW, cellH);
  drawCharts(gameState, scales);
  drawControlBar(width, height);
  drawButtons(buttons, gameState);
  
  if (gameState.isGameOver) {
    drawGameOver(gameState);
  }
  
  if (gameState.isInLiquidationPhase && !gameState.isGameOver) {
    drawLiquidationPhase(gameState);
  }
};

window.mousePressed = function() {
  if (gameState.isGameOver) {
    if (checkGameOverResetClick()) {
      handleReset();
      return;
    }
  }
  
  const clickedButton = checkButtonClick(buttons, gameState);
  
  if (clickedButton === 'START') {
    handleStart();
  } else if (clickedButton === 'RESET') {
    handleReset();
  } else if (clickedButton === 'BUY') {
    executePlayerTrade(gameState, +1);
  } else if (clickedButton === 'SELL') {
    executePlayerTrade(gameState, -1);
  }
};

async function initializeGame() {
  gameState.currentTrajectoryId = selectRandomTrajectory(gameState.csvData);
  console.log(`Selected trajectory: ${gameState.currentTrajectoryId}`);
  
  const trajectoryData = extractTrajectory(gameState.csvData, gameState.currentTrajectoryId);
  
  if (!trajectoryData) {
    alert('ERROR: Failed to extract trajectory ' + gameState.currentTrajectoryId + ' from CSV data.\n\nThe CSV file may be corrupted.');
    console.error('FATAL: Cannot extract trajectory. Game cannot start.');
    noLoop();
    return;
  }
  
  loadTrajectoryData(gameState, trajectoryData);
  truncateToTerminalTime(gameState);
  initializeLiquidation(gameState);
  autoAdjustScales();
  updateFromTime(gameState);
}

function autoAdjustScales() {
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
  
  // Initialize zeta scale (will be dynamically adjusted as game runs)
  scales.zetaMin = 0;
  scales.zetaMax = 1.0;  // Start with reasonable default
  
  const priceRange = gameState.maxPrice - gameState.minPrice;
  scales.priceYMin = gameState.minPrice - 0.1 * priceRange;
  scales.priceYMax = gameState.maxPrice + 0.1 * priceRange;
  
  console.log(`✓ Auto-adjusted scales: depth [${scales.depthMin.toFixed(1)}, ${scales.depthMax.toFixed(1)}], resilience [${scales.resMin.toFixed(1)}, ${scales.resMax.toFixed(1)}]`);
}

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
  
  resetGameState(gameState);
  
  gameState.currentTrajectoryId = selectRandomTrajectory(gameState.csvData);
  console.log(`Reset: Selected new trajectory ${gameState.currentTrajectoryId}`);
  
  const trajectoryData = extractTrajectory(gameState.csvData, gameState.currentTrajectoryId);
  
  if (!trajectoryData) {
    alert('ERROR: Failed to extract new trajectory.\n\nPlease reload the page.');
    console.error('FATAL: Cannot extract trajectory on reset.');
    return;
  }
  
  loadTrajectoryData(gameState, trajectoryData);
  
  gameState.terminalTime = CONFIG.initialTerminalTime;
  truncateToTerminalTime(gameState);
  initializeLiquidation(gameState);
  
  autoAdjustScales();
  updateFromTime(gameState);
  
  console.log('RESET clicked, market & state reset');
}