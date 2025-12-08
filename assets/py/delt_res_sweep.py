#!/usr/bin/env python3
"""
Friction Threshold Analysis - Nagy & Rásonyi (2025) Paper Implementation

Exact implementation of the discrete-time model from:
"On the utility problem in a market where price impact is transient"
arXiv:2511.12093v1

Key equations:
- Spread dynamics (Eq. 1): ζ_{t+1} = e^{-r_t} × ζ_t + (1/δ_{t+1}) × |X_{t+1} - X_t|
- Cash dynamics (Eq. 2): ξ_{t+1} - ξ_t = -P_{t+1}(X_{t+1} - X_t) - ζ_{t+1}|X_{t+1} - X_t|
"""

import numpy as np
from typing import Dict

# ============================================================================
# CONFIGURATION
# ============================================================================

# Price process (AR(1) centered at zero)
PRICE_ALPHA = 0.96
PRICE_NOISE_STD = 1.0
PRICE_CENTER = 0.0

# Trading setup
INITIAL_CASH = 0.0
INITIAL_INVENTORY = 0.0
INITIAL_ZETA = 0.0
TRADE_SIZE = 1.0
CONTRARIAN_THRESHOLD = 2.57

# Simulation
N_TRAJECTORIES = 100
TERMINAL_TIME = 200
TRADING_HORIZON_FRACTION = 0.8

# Sweep ranges
DEPTH_VALUES = [0.2, 0.5, 1.0, 2.0, 4.0]
RESILIENCE_VALUES = [0.01, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.75, 1.0, 1.5, 2.0]

RANDOM_SEED = 42

# ============================================================================
# DATA GENERATION
# ============================================================================

def generate_ar1_prices(n_trajectories: int, terminal_time: int) -> np.ndarray:
    """Generate AR(1) price process."""
    prices = np.zeros((n_trajectories, terminal_time + 1))
    
    for t in range(terminal_time):
        noise = PRICE_NOISE_STD * np.random.randn(n_trajectories)
        prices[:, t + 1] = PRICE_ALPHA * prices[:, t] + noise
    
    prices += PRICE_CENTER
    return prices


# ============================================================================
# TRADING SIMULATION - EXACT PAPER IMPLEMENTATION
# ============================================================================

def contrarian_decision(price: float) -> float:
    """Simple contrarian: buy when price low, sell when price high."""
    deviation = price - PRICE_CENTER
    
    if deviation > CONTRARIAN_THRESHOLD:
        return -TRADE_SIZE  # Sell
    elif deviation < -CONTRARIAN_THRESHOLD:
        return TRADE_SIZE   # Buy
    else:
        return 0.0


def run_trajectory_paper_model(prices: np.ndarray, depth: float, resilience: float) -> Dict:
    """
    Run trajectory using EXACT Nagy & Rásonyi (2025) model.
    
    Spread dynamics (Equation 1 from paper):
        ζ_{t+1} = e^{-r_t} × ζ_t + (1/δ_{t+1}) × |X_{t+1} - X_t|
    
    Cash dynamics (Equation 2 from paper):
        ξ_{t+1} - ξ_t = -P_{t+1}(X_{t+1} - X_t) - ζ_{t+1}|X_{t+1} - X_t|
    """
    T = len(prices) - 1
    liquidation_start = int(T * TRADING_HORIZON_FRACTION)
    
    # State variables
    cash = INITIAL_CASH
    inventory = INITIAL_INVENTORY
    zeta = INITIAL_ZETA
    
    num_trades = 0
    
    # Time loop (t = 0, 1, ..., T-1)
    for t in range(T):
        # Previous state
        X_t = inventory
        zeta_t = zeta
        
        # Decide action BEFORE seeing P_{t+1}
        if t < liquidation_start:
            # Discretionary trading
            action = contrarian_decision(prices[t])
        else:
            # Liquidation phase
            if t == liquidation_start:
                liquidation_periods = T - liquidation_start
                liquidation_rate = -inventory / liquidation_periods if liquidation_periods > 0 else 0
            
            action = round(liquidation_rate) if inventory != 0 else 0.0
            
            # Don't overshoot zero
            if inventory != 0 and np.sign(inventory) != np.sign(inventory + action):
                action = -inventory
        
        # Update inventory
        X_t_plus_1 = X_t + action
        
        # Update spread (Equation 1) - PAPER VERSION
        # First decay, then jump
        decayed_zeta = np.exp(-resilience) * zeta_t
        zeta_t_plus_1 = decayed_zeta + (1.0 / depth) * abs(action)
        
        # Update cash (Equation 2)
        # Pay spread on the trade
        cash_change = -prices[t + 1] * action - zeta_t_plus_1 * abs(action)
        cash += cash_change
        
        # Update state
        inventory = X_t_plus_1
        zeta = zeta_t_plus_1
        
        if action != 0:
            num_trades += 1
    
    # Final wealth
    final_wealth = cash + inventory * prices[T]
    
    return {
        "final_wealth": final_wealth,
        "num_trades": num_trades,
        "broke": False
    }


# ============================================================================
# EVALUATION
# ============================================================================

def evaluate_depth_resilience(depth: float, resilience: float) -> Dict:
    """Evaluate contrarian strategy for given (depth, resilience)."""
    prices = generate_ar1_prices(N_TRAJECTORIES, TERMINAL_TIME)
    
    results = []
    for i in range(N_TRAJECTORIES):
        res = run_trajectory_paper_model(prices[i], depth, resilience)
        results.append(res)
    
    # Statistics
    wealths = np.array([r["final_wealth"] for r in results])
    wealths_finite = wealths[np.isfinite(wealths)]
    
    if wealths_finite.size == 0:
        return {
            "depth": depth,
            "resilience": resilience,
            "expected_wealth": np.nan,
            "std_wealth": np.nan,
            "sharpe_ratio": np.nan,
            "min_wealth": np.nan,
            "median_wealth": np.nan,
            "max_wealth": np.nan,
            "broke_pct": 100.0,
            "avg_trades": 0.0,
            "min_trades": 0,
            "max_trades": 0,
            "num_trajectories": 0
        }
    
    expected_wealth = float(np.mean(wealths_finite))
    std_wealth = float(np.std(wealths_finite, ddof=1)) if wealths_finite.size > 1 else 0.0
    expected_return = expected_wealth - INITIAL_CASH
    
    sharpe_ratio = expected_return / std_wealth if std_wealth > 0 else np.nan
    
    min_wealth = float(np.min(wealths_finite))
    median_wealth = float(np.median(wealths_finite))
    max_wealth = float(np.max(wealths_finite))
    
    trades_list = [r["num_trades"] for r in results]
    avg_trades = np.mean(trades_list)
    min_trades = int(np.min(trades_list))
    max_trades = int(np.max(trades_list))
    
    broke_count = sum(1 for r in results if r["broke"])
    broke_pct = 100.0 * broke_count / len(results)
    
    return {
        "depth": depth,
        "resilience": resilience,
        "expected_wealth": expected_wealth,
        "std_wealth": std_wealth,
        "sharpe_ratio": sharpe_ratio,
        "min_wealth": min_wealth,
        "median_wealth": median_wealth,
        "max_wealth": max_wealth,
        "broke_pct": broke_pct,
        "avg_trades": avg_trades,
        "min_trades": min_trades,
        "max_trades": max_trades,
        "num_trajectories": int(wealths_finite.size)
    }


# ============================================================================
# SWEEP
# ============================================================================

def run_sweep():
    """Run parameter sweep."""
    print("=" * 80)
    print("FRICTION THRESHOLD ANALYSIS - Nagy & Rásonyi (2025) Paper Implementation")
    print("=" * 80)
    print()
    print("Configuration:")
    print(f"  Price: AR(1) with α={PRICE_ALPHA}, σ={PRICE_NOISE_STD}, center={PRICE_CENTER}")
    print(f"  Strategy: Contrarian (threshold={CONTRARIAN_THRESHOLD})")
    print(f"  Trajectories: {N_TRAJECTORIES} per (δ, r)")
    print(f"  Time steps: {TERMINAL_TIME}")
    print()
    print(f"  Depth values: {len(DEPTH_VALUES)}")
    print(f"  Resilience values: {len(RESILIENCE_VALUES)}")
    print(f"  Total: {len(DEPTH_VALUES) * len(RESILIENCE_VALUES)} evaluations")
    print()
    
    total = len(DEPTH_VALUES) * len(RESILIENCE_VALUES)
    current = 0
    results = []
    
    print("Running sweep...")
    print("-" * 80)
    
    for depth in DEPTH_VALUES:
        for resilience in RESILIENCE_VALUES:
            current += 1
            if current % 5 == 0 or current == total:
                print(f"  Progress: {current}/{total} ({100*current/total:.0f}%)")
            
            result = evaluate_depth_resilience(depth, resilience)
            results.append(result)
    
    print()
    print("✓ Sweep complete")
    print()
    
    return results


def print_results_table(results):
    """Print Sharpe ratio heatmap."""
    print("=" * 80)
    print("RESULTS: Sharpe Ratio by (Depth, Resilience)")
    print("=" * 80)
    print()
    
    depth_vals = sorted(set(r["depth"] for r in results))
    res_vals = sorted(set(r["resilience"] for r in results))
    
    print(f"{'Depth/Res':>10}", end="")
    for res in res_vals:
        print(f"{res:>8.2f}", end="")
    print()
    print("-" * (10 + 8 * len(res_vals)))
    
    for depth in depth_vals:
        print(f"{depth:>10.1f}", end="")
        for res in res_vals:
            matching = [r for r in results if r["depth"] == depth and r["resilience"] == res]
            if matching:
                sharpe = matching[0]["sharpe_ratio"]
                if np.isnan(sharpe):
                    print(f"{'NaN':>8}", end="")
                else:
                    print(f"{sharpe:>8.3f}", end="")
            else:
                print(f"{'---':>8}", end="")
        print()
    print()


def print_statistics_table(results):
    """Print complete statistics."""
    print("\n" + "=" * 80)
    print("COMPLETE STATISTICS")
    print("=" * 80)
    print()
    
    sorted_results = sorted(results, key=lambda x: (x["depth"], x["resilience"]))
    
    print(f"{'Depth':<8}{'Resil':<8}{'Sharpe':<10}{'E[W]':<10}{'σ(W)':<10}"
          f"{'Min':<10}{'Median':<10}{'Max':<10}{'AvgTr':<8}")
    print("-" * 90)
    
    for r in sorted_results:
        print(f"{r['depth']:<8.1f}"
              f"{r['resilience']:<8.2f}"
              f"{r['sharpe_ratio']:<10.3f}"
              f"{r['expected_wealth']:<10.1f}"
              f"{r['std_wealth']:<10.1f}"
              f"{r['min_wealth']:<10.1f}"
              f"{r['median_wealth']:<10.1f}"
              f"{r['max_wealth']:<10.1f}"
              f"{r['avg_trades']:<8.1f}")
    print()


def main():
    """Main execution."""
    if RANDOM_SEED is not None:
        np.random.seed(RANDOM_SEED)
    
    results = run_sweep()
    
    print_results_table(results)
    print_statistics_table(results)
    
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print()
    print("Implementation matches Nagy & Rásonyi (2025) paper equations:")
    print("  • Spread: ζ_{t+1} = e^{-r_t} × ζ_t + (1/δ_{t+1}) × |X_{t+1} - X_t|")
    print("  • Cash: ξ_{t+1} - ξ_t = -P_{t+1}(X_{t+1} - X_t) - ζ_{t+1}|X_{t+1} - X_t|")
    print("  • Trading: Once per time step (discrete time)")
    print()
    print("✓ Analysis complete")
    print("=" * 80)


if __name__ == "__main__":
    main()