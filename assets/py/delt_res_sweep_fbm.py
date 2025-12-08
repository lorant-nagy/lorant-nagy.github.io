#!/usr/bin/env python3
"""
Friction Threshold Analysis - Fractional Brownian Motion Strategy

Uses fractional Brownian motion with H < 0.5 (negative autocorrelation)
Strategy: Momentum-based contrarian
- If 60%+ of recent increments were UP → GO SHORT (expect reversal)
- If 60%+ of recent increments were DOWN → GO LONG (expect reversal)

Based on Nagy & Rásonyi (2025) paper equations for market friction.
"""

import numpy as np
from typing import Dict

# ============================================================================
# CONFIGURATION
# ============================================================================

# Price process - fractional Brownian motion
FBM_HURST = 0.3           # H < 0.5 → negative autocorrelation
FBM_VOLATILITY = 1.0        # Scale parameter
PRICE_CENTER = 0.0

# Strategy parameters
LOOKBACK_WINDOW = 5        # Number of past increments to examine
MOMENTUM_THRESHOLD = 0.70    # 70% threshold for direction
TRADE_SIZE = 1.0

# Trading setup
INITIAL_CASH = 0.0
INITIAL_INVENTORY = 0.0
INITIAL_ZETA = 0.0

# Simulation
N_TRAJECTORIES = 1000
TERMINAL_TIME = 200
TRADING_HORIZON_FRACTION = 0.8

# Sweep ranges
DEPTH_VALUES = [0.2, 0.5, 1.0, 2.0, 4.0]
RESILIENCE_VALUES = [0.01, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.75, 1.0, 1.5, 2.0]

RANDOM_SEED = None

# ============================================================================
# FRACTIONAL BROWNIAN MOTION GENERATION
# ============================================================================

def generate_fbm_davies_harte(n: int, hurst: float) -> np.ndarray:
    """
    Generate fractional Brownian motion using Davies-Harte method.
    
    Args:
        n: Number of time steps
        hurst: Hurst parameter (H < 0.5 gives negative autocorrelation)
    
    Returns:
        Array of length n+1 starting at 0
    """
    # Autocovariance function for fBm increments
    def gamma(k, H):
        return 0.5 * (abs(k-1)**(2*H) - 2*abs(k)**(2*H) + abs(k+1)**(2*H))
    
    # Build circulant embedding
    g = np.zeros(2*n)
    for k in range(n):
        g[k] = gamma(k, hurst)
    for k in range(n, 2*n):
        g[k] = gamma(2*n - k, hurst)
    
    # Eigenvalues via FFT
    lam = np.fft.fft(g).real
    
    # Check for numerical issues
    lam = np.maximum(lam, 0)
    
    # Generate increments
    w1 = np.random.randn(n)
    w2 = np.random.randn(n)
    
    # Complex random vector
    w = np.zeros(2*n, dtype=complex)
    w[0] = np.sqrt(lam[0]) * w1[0] / np.sqrt(2*n)
    w[n] = np.sqrt(lam[n]) * w2[0] / np.sqrt(2*n)
    
    for k in range(1, n):
        w[k] = np.sqrt(lam[k]) * (w1[k] + 1j*w2[k]) / np.sqrt(4*n)
        w[2*n - k] = np.conj(w[k])
    
    # IFFT to get increments
    z = np.fft.ifft(w).real[:n]
    
    # Cumulative sum to get fBm path
    fbm = np.zeros(n + 1)
    fbm[1:] = np.cumsum(z)
    
    return fbm


def generate_fbm_prices(n_trajectories: int, terminal_time: int, 
                        hurst: float, volatility: float, center: float) -> np.ndarray:
    """
    Generate multiple fBm price trajectories.
    
    Returns:
        Array of shape (n_trajectories, terminal_time + 1)
    """
    prices = np.zeros((n_trajectories, terminal_time + 1))
    
    for i in range(n_trajectories):
        fbm = generate_fbm_davies_harte(terminal_time, hurst)
        prices[i] = volatility * fbm + center
    
    return prices


# ============================================================================
# MOMENTUM-BASED STRATEGY
# ============================================================================

def momentum_decision(price_history: np.ndarray, current_idx: int, 
                      lookback: int, threshold: float) -> float:
    """
    Momentum-based contrarian strategy.
    
    Logic: With H < 0.5, negative autocorrelation means:
    - Recent upward moves → expect reversal down → GO SHORT
    - Recent downward moves → expect reversal up → GO LONG
    
    Args:
        price_history: Array of prices up to current time
        current_idx: Current time index
        lookback: Number of past increments to examine
        threshold: Fraction threshold (e.g., 0.6 for 60%)
    
    Returns:
        +1 (buy), -1 (sell), or 0 (hold)
    """
    if current_idx < lookback:
        return 0.0  # Not enough history
    
    # Get recent increments
    recent_increments = np.diff(price_history[current_idx - lookback:current_idx + 1])
    
    # Count directions
    up_count = np.sum(recent_increments > 0)
    down_count = np.sum(recent_increments < 0)
    total = len(recent_increments)
    
    if total == 0:
        return 0.0
    
    up_fraction = up_count / total
    down_fraction = down_count / total
    
    # Momentum contrarian logic
    if up_fraction >= threshold:
        # Strong upward momentum → expect reversal → SHORT
        return -TRADE_SIZE
    elif down_fraction >= threshold:
        # Strong downward momentum → expect reversal → LONG
        return TRADE_SIZE
    else:
        # No clear signal
        return 0.0


# ============================================================================
# TRADING SIMULATION
# ============================================================================

def run_trajectory_fbm(prices: np.ndarray, depth: float, resilience: float) -> Dict:
    """
    Run trajectory with fBm prices and momentum strategy.
    
    Market friction follows Nagy & Rásonyi (2025):
    - Spread: ζ_{t+1} = e^{-r_t} × ζ_t + (1/δ_{t+1}) × |X_{t+1} - X_t|
    - Cash: ξ_{t+1} - ξ_t = -P_{t+1}(X_{t+1} - X_t) - ζ_{t+1}|X_{t+1} - X_t|
    """
    T = len(prices) - 1
    liquidation_start = int(T * TRADING_HORIZON_FRACTION)
    
    # State
    cash = INITIAL_CASH
    inventory = INITIAL_INVENTORY
    zeta = INITIAL_ZETA
    num_trades = 0
    
    # Trading loop
    for t in range(T):
        X_t = inventory
        zeta_t = zeta
        
        # Decide action
        if t < liquidation_start:
            # Momentum strategy
            action = momentum_decision(prices, t, LOOKBACK_WINDOW, MOMENTUM_THRESHOLD)
        else:
            # Liquidation
            if t == liquidation_start:
                liquidation_periods = T - liquidation_start
                liquidation_rate = -inventory / liquidation_periods if liquidation_periods > 0 else 0
            
            action = round(liquidation_rate) if inventory != 0 else 0.0
            
            # Don't overshoot zero
            if inventory != 0 and np.sign(inventory) != np.sign(inventory + action):
                action = -inventory
        
        # Update inventory
        X_t_plus_1 = X_t + action
        
        # Update spread (Paper Equation 1)
        decayed_zeta = np.exp(-resilience) * zeta_t
        zeta_t_plus_1 = decayed_zeta + (1.0 / depth) * abs(action)
        
        # Update cash (Paper Equation 2)
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
    """Evaluate momentum strategy for given (depth, resilience)."""
    prices = generate_fbm_prices(
        N_TRAJECTORIES, 
        TERMINAL_TIME,
        FBM_HURST,
        FBM_VOLATILITY,
        PRICE_CENTER
    )
    
    results = []
    for i in range(N_TRAJECTORIES):
        res = run_trajectory_fbm(prices[i], depth, resilience)
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
    print("FRICTION THRESHOLD ANALYSIS - Fractional Brownian Motion Strategy")
    print("=" * 80)
    print()
    print("Configuration:")
    print(f"  Price: fBm with H={FBM_HURST} (negative autocorrelation)")
    print(f"  Volatility: {FBM_VOLATILITY}")
    print(f"  Strategy: Momentum contrarian")
    print(f"    - Lookback: {LOOKBACK_WINDOW} steps")
    print(f"    - Threshold: {MOMENTUM_THRESHOLD:.0%}")
    print(f"    - Logic: {int(MOMENTUM_THRESHOLD*100)}%+ up → SHORT, {int(MOMENTUM_THRESHOLD*100)}%+ down → LONG")
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
    print(f"Strategy exploits negative autocorrelation of fBm with H={FBM_HURST}")
    print(f"  • When {int(MOMENTUM_THRESHOLD*100)}%+ recent moves are UP → GO SHORT (expect reversal)")
    print(f"  • When {int(MOMENTUM_THRESHOLD*100)}%+ recent moves are DOWN → GO LONG (expect reversal)")
    print()
    print("Market friction model from Nagy & Rásonyi (2025):")
    print("  • Spread: ζ_{t+1} = e^{-r_t} × ζ_t + (1/δ_{t+1}) × |X_{t+1} - X_t|")
    print("  • Cash: ξ_{t+1} - ξ_t = -P_{t+1}(X_{t+1} - X_t) - ζ_{t+1}|X_{t+1} - X_t|")
    print()
    print("✓ Analysis complete")
    print("=" * 80)


if __name__ == "__main__":
    main()