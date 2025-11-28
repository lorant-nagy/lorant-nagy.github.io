// =====================================================
// MARKET LOGIC
// =====================================================
// Core trading mechanics and market microstructure

/**
 * LinearSpread - Dynamic spread/friction calculator
 * Matches the Python implementation
 */
export class LinearSpread {
  constructor() {
    this.zetaHistory = [0.0];
  }

  reset() {
    this.zetaHistory = [0.0];
  }

  /**
   * Calculate friction cost for a trade
   * @param {number} action - Trade size (positive = buy, negative = sell)
   * @param {number} depth - Market depth
   * @param {number} resilience - Market resilience
   * @returns {number} Friction cost
   */
  valueFor(action, depth, resilience) {
    const prevZeta = this.zetaHistory[this.zetaHistory.length - 1];
    const newZeta =
      Math.exp(-resilience) * prevZeta +
      (1.0 / Math.max(0.1, depth)) * Math.abs(action);

    this.zetaHistory.push(newZeta);
    return newZeta * Math.abs(action);
  }
}

/**
 * Calculate trade execution
 * @param {number} action - Trade action (+1 buy, -1 sell)
 * @param {number} price - Current price
 * @param {number} frictionCost - Friction from spread calculator
 * @returns {object} {cashChange, newInventory}
 */
export function executeTrade(action, price, frictionCost) {
  const cashChange = -action * price - frictionCost;
  return { cashChange };
}

/**
 * Calculate wealth (mark-to-market)
 * @param {number} cash - Current cash
 * @param {number} inventory - Current inventory (shares)
 * @param {number} price - Current market price
 * @returns {number} Total wealth
 */
export function calculateWealth(cash, inventory, price) {
  return cash + inventory * price;
}

/**
 * Validate trade (RULE A: Wealth must remain non-negative)
 * @param {number} currentCash - Current cash
 * @param {number} currentInventory - Current inventory
 * @param {number} action - Proposed trade action
 * @param {number} price - Current price
 * @param {number} frictionCost - Friction cost
 * @returns {boolean} True if trade is valid
 */
export function validateTrade(currentCash, currentInventory, action, price, frictionCost) {
  const { cashChange } = executeTrade(action, price, frictionCost);
  const newCash = currentCash + cashChange;
  const newInventory = currentInventory + action;
  const newWealth = calculateWealth(newCash, newInventory, price);
  
  return newWealth >= 0;
}

/**
 * AI Contrarian Rule 5
 * Calculate AI action based on price deviation
 * @param {number} priceDeviation - Price deviation from equilibrium
 * @param {number} depth - Market depth
 * @param {number} c0 - Contrarian coefficient
 * @param {number} depthExponent - Depth exponent
 * @param {number} threshold - Minimum action threshold
 * @returns {number} Action (-1, 0, or +1)
 */
export function calculateAIAction(priceDeviation, depth, c0, depthExponent, threshold) {
  // Contrarian rule: action = -C0 * price * (1 - (1/depth))^(1/3)
  const rawAction = -c0 * priceDeviation * Math.pow((1 - (1/depth)), depthExponent);
  
  // Apply threshold
  if (Math.abs(rawAction) >= threshold) {
    return Math.sign(rawAction);  // Return ±1
  }
  
  return 0;  // No trade
}

/**
 * Calculate liquidation rate
 * @param {number} inventory - Current inventory at liquidation start
 * @param {number} liquidationPeriod - Number of steps to liquidate over
 * @returns {number} Liquidation rate (shares per step)
 */
export function calculateLiquidationRate(inventory, liquidationPeriod) {
  if (liquidationPeriod <= 0) return 0;
  return -inventory / liquidationPeriod;
}

/**
 * Calculate liquidation action for current step
 * @param {number} initialInventory - Inventory at liquidation start
 * @param {number} currentInventory - Current inventory
 * @param {number} rate - Liquidation rate
 * @param {number} stepsElapsed - Steps since liquidation started
 * @returns {number} Action to take this step
 */
export function calculateLiquidationAction(initialInventory, currentInventory, rate, stepsElapsed) {
  // Calculate target inventory at this point
  const targetInventory = initialInventory + (rate * stepsElapsed);
  
  // Calculate action to reach target
  const desiredAction = Math.round(targetInventory - currentInventory);
  
  if (desiredAction === 0) return 0;
  
  // Safety: don't overshoot zero
  if (currentInventory !== 0 && Math.sign(currentInventory) !== Math.sign(currentInventory + desiredAction)) {
    return -currentInventory;  // Go exactly to zero
  }
  
  return desiredAction;
}
