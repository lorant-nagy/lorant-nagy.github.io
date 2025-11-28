// =====================================================
// CONFIGURATION
// =====================================================
// All configurable parameters for the trading game

export const CONFIG = {
  // Data source
  csvPath: 'assets/data/not_bad.csv',  // Relative to the HTML file (dev.html at root)
  
  // Time & market
  initialTerminalTime: 50,
  pointsPerCandle: 10,
  
  // Liquidation
  tradingHorizonFraction: 0.8,  // 80% trading, 20% liquidation
  
  // Initial wealth
  commonCash: 100,
  initialInventory: 0,
  
  // Chart styling
  chartStyles: {
    depthColor: [80, 120, 200],
    resilienceColor: [200, 80, 120],
    fillAlpha: 80,
    lineWeight: 1.5,
    depthResHeight: 60,
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
    inventoryMin: -50,
    inventoryMax: 50,
    cashMin: 0,
    cashMax: 100 * 3  // Will be updated based on commonCash
  },
  
  // Grid
  gridRows: 50,
  gridCols: 80,
  
  // Canvas
  canvasWidth: 900,
  canvasHeight: 500,
  
  // Animation
  stepFrames: 15  // frames between time steps
};

// Update cashMax based on commonCash
CONFIG.scales.cashMax = CONFIG.commonCash * 3;
