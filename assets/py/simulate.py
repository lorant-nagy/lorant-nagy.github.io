#!/usr/bin/env python3
""" 
Trading Simulation - Contrarian Strategy with Transient Price Impact

Based on Nagy & Rásonyi (2025) "On the utility problem in a market where price impact is transient"

Key formulas from the paper:
- Half-spread dynamics: ζ_{t+1} = e^{-r_t} * ζ_t + (1/δ_{t+1}) * |H_{t+1}|
- Cash dynamics: ξ_{t+1} - ξ_t = -P_{t+1} * H_{t+1} - ζ_{t+1} * |H_{t+1}|

where H_t = X_t - X_{t-1} is the trade at time t (action/increment)
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# =====================================================
# CONFIGURATION
# =====================================================

CSV_PATH = "assets/data/market_primitives.csv"

# Initial wealth
COMMON_CASH = 100.0
INITIAL_INVENTORY = 0.0
INITIAL_ZETA = 0.0

# Random seed
RANDOM_SEED = 42

# Strategy configuration
CONTRARIAN_CONFIG = {
    'enabled': True,
    'mean_reversion_level': 50.0,  # Price center for contrarian strategy
    'action_threshold': 2.0,       # Min price deviation to trigger trade
    'threshold_re': 1.0,           # Resilience threshold (0 = no condition)
    'threshold_de': 1.5,           # Depth threshold (0 = no condition)
}

# =====================================================
# UTILITIES
# =====================================================

def load_csv_data(csv_path: str) -> pd.DataFrame:
    """Load market primitives from CSV file."""
    df = pd.read_csv(csv_path, comment="#")
    df = df.rename(columns={"trajectory_id": "trajectory", "asset_price": "price"})
    return df


def extract_trajectory(df: pd.DataFrame, trajectory_id: int) -> Dict[str, np.ndarray]:
    """Extract a single trajectory as numpy arrays."""
    traj_data = df[df["trajectory"] == trajectory_id].copy()
    if traj_data.empty:
        raise ValueError(f"Trajectory {trajectory_id} not found in CSV.")
    traj_data = traj_data.sort_values("time").reset_index(drop=True)
    return {
        "time": traj_data["time"].values,
        "price": traj_data["price"].values,
        "depth": traj_data["depth"].values,
        "resilience": traj_data["resilience"].values,
    }


def get_unique_trajectories(df: pd.DataFrame) -> List[int]:
    return sorted(df["trajectory"].unique())


def calculate_wealth(cash: float, inventory: float, price: float) -> float:
    """Calculate wealth: cash + inventory * price"""
    return cash + inventory * price


# =====================================================
# TRADING STRATEGY
# =====================================================

def decide_action(price: float, depth: float, resilience: float, config: Dict) -> Optional[float]:
    """
    Contrarian strategy with optional threshold conditions.
    
    Primary logic (always active):
    - Calculate price deviation from mean_reversion_level
    - If |deviation| < action_threshold: no trade
    - If price > mean: SELL (-1)
    - If price < mean: BUY (+1)
    
    Optional threshold conditions (active if thresholds > 0):
    - Only trade if resilience > threshold_re (when threshold_re > 0) - high resilience is GOOD
    - Only trade if depth > threshold_de (when threshold_de > 0) - high depth is GOOD
    """
    if not config['enabled']:
        return None
    
    # Check threshold conditions (if they are set)
    # High resilience and high depth are GOOD market conditions
    threshold_re = config['threshold_re']
    threshold_de = config['threshold_de']
    
    if threshold_re > 0 and resilience < threshold_re:
        return None  # Resilience too low, market not good enough
    
    if threshold_de > 0 and depth < threshold_de:
        return None  # Depth too low, market not liquid enough
    
    # Contrarian logic: trade against price deviation
    mean_level = config['mean_reversion_level']
    action_threshold = config['action_threshold']
    
    price_deviation = price - mean_level
    
    # Only trade if deviation exceeds threshold
    if abs(price_deviation) < action_threshold:
        return None
    
    # Trade AGAINST the deviation
    # If price > mean (high) → SELL (-1)
    # If price < mean (low) → BUY (+1)
    return -1.0 if price_deviation > 0 else +1.0


# =====================================================
# SIMULATION (following paper equations)
# =====================================================

@dataclass
class SimulationState:
    """State following Nagy & Rásonyi (2025) notation."""
    cash: float = COMMON_CASH           # ξ (xi) in the paper
    inventory: float = INITIAL_INVENTORY  # X in the paper
    zeta: float = INITIAL_ZETA          # ζ (half-spread) in the paper
    trades: List[Dict] = field(default_factory=list)
    
    def wealth(self, price: float) -> float:
        return calculate_wealth(self.cash, self.inventory, price)


def run_single_trajectory(trajectory_data: Dict[str, np.ndarray], trajectory_id: int) -> Dict:
    """
    Run simulation following paper equations (1) and (2).
    
    Equation (1): ζ_{t+1} = e^{-r_t} * ζ_t + (1/δ_{t+1}) * |H_{t+1}|
    Equation (2): ξ_{t+1} - ξ_t = -P_{t+1} * H_{t+1} - ζ_{t+1} * |H_{t+1}|
    
    where H_t is the trade (action) at time t
    """
    state = SimulationState()
    
    times = trajectory_data["time"]
    prices = trajectory_data["price"]
    depths = trajectory_data["depth"]
    resiliences = trajectory_data["resilience"]
    
    # Iterate through time (starting from t=1, as paper uses 1-indexing)
    for t_idx in range(len(times)):
        price = prices[t_idx]
        depth = depths[t_idx]
        resilience = resiliences[t_idx]
        
        # Decide action H_t based on current market state
        action = decide_action(price, depth, resilience, CONTRARIAN_CONFIG)
        
        if action is not None and action != 0:
            # First: update half-spread using equation (1)
            # ζ_{t+1} = e^{-r_t} * ζ_t + (1/δ_{t+1}) * |H_{t+1}|
            # Note: t_idx represents t, so we use resilience at t_idx-1 for r_t if available
            if t_idx > 0:
                decay_factor = np.exp(-resiliences[t_idx - 1])
                new_zeta = decay_factor * state.zeta + (1.0 / depth) * abs(action)
            else:
                # At t=0, no previous resilience, just add impact
                new_zeta = state.zeta + (1.0 / depth) * abs(action)
            
            # Second: calculate cash change using equation (2)
            # ξ_{t+1} - ξ_t = -P_{t+1} * H_{t+1} - ζ_{t+1} * |H_{t+1}|
            cash_change = -price * action - new_zeta * abs(action)
            
            # Third: check if we can afford it
            new_cash = state.cash + cash_change
            new_inventory = state.inventory + action
            new_wealth = calculate_wealth(new_cash, new_inventory, price)
            
            if new_wealth >= 0:  # Only trade if wealth stays non-negative
                state.cash = new_cash
                state.inventory = new_inventory
                state.zeta = new_zeta
                state.trades.append({
                    "time": times[t_idx],
                    "action": action,
                    "price": price,
                    "zeta": new_zeta,
                })
            # If we can't afford it, zeta stays at old value and we don't trade
    
    final_wealth = state.wealth(prices[-1])
    
    # Count long vs short trades
    num_long_trades = sum(1 for tr in state.trades if tr["action"] > 0)
    num_short_trades = sum(1 for tr in state.trades if tr["action"] < 0)
    
    return {
        "trajectory_id": trajectory_id,
        "final_wealth": final_wealth,
        "final_cash": state.cash,
        "final_inventory": state.inventory,
        "final_zeta": state.zeta,
        "num_trades": len(state.trades),
        "num_long_trades": num_long_trades,
        "num_short_trades": num_short_trades,
    }


def run_all_trajectories(csv_path: str) -> pd.DataFrame:
    """Run simulation for all trajectories in CSV."""
    if RANDOM_SEED is not None:
        np.random.seed(RANDOM_SEED)
    
    df = load_csv_data(csv_path)
    trajectory_ids = get_unique_trajectories(df)
    
    print("=" * 60)
    print("Contrarian Strategy with Transient Price Impact")
    print("=" * 60)
    print(f"CSV path: {csv_path}")
    print(f"\nStrategy: Contrarian (buy low, sell high)")
    print(f"  Mean reversion level: {CONTRARIAN_CONFIG['mean_reversion_level']}")
    print(f"  Action threshold: {CONTRARIAN_CONFIG['action_threshold']}")
    
    if CONTRARIAN_CONFIG['threshold_re'] > 0 or CONTRARIAN_CONFIG['threshold_de'] > 0:
        print(f"\nAdditional conditions:")
        if CONTRARIAN_CONFIG['threshold_re'] > 0:
            print(f"  Trade only if resilience > {CONTRARIAN_CONFIG['threshold_re']} (high resilience is good)")
        if CONTRARIAN_CONFIG['threshold_de'] > 0:
            print(f"  Trade only if depth > {CONTRARIAN_CONFIG['threshold_de']} (high depth is good)")
    
    print(f"\nInitial cash: {COMMON_CASH:.2f}, initial inventory: {INITIAL_INVENTORY:.2f}\n")
    
    results = []
    for i, traj_id in enumerate(trajectory_ids, start=1):
        if i % 10 == 0 or i == len(trajectory_ids):
            print(f"  Simulating trajectory {i}/{len(trajectory_ids)} (id={traj_id})")
        traj_data = extract_trajectory(df, traj_id)
        res = run_single_trajectory(traj_data, traj_id)
        results.append(res)
    
    results_df = pd.DataFrame(results)
    return results_df


# =====================================================
# STATISTICS
# =====================================================

def calculate_statistics(results_df: pd.DataFrame) -> Dict:
    """Calculate expected wealth, std, Sharpe ratio, etc."""
    final_wealths = results_df["final_wealth"].values
    final_wealths = final_wealths[np.isfinite(final_wealths)]
    
    if final_wealths.size == 0:
        return {
            "expected_wealth": np.nan,
            "std_wealth": np.nan,
            "sharpe_ratio": np.nan,
            "num_trajectories": 0,
            "min_wealth": np.nan,
            "median_wealth": np.nan,
            "max_wealth": np.nan,
            "avg_long_trades": np.nan,
            "avg_short_trades": np.nan,
        }
    
    expected_wealth = float(np.mean(final_wealths))
    std_wealth = float(np.std(final_wealths, ddof=1)) if final_wealths.size > 1 else 0.0
    
    initial_wealth = COMMON_CASH
    expected_return = expected_wealth - initial_wealth
    
    if std_wealth > 0:
        sharpe_ratio = expected_return / std_wealth
    else:
        sharpe_ratio = np.nan
    
    avg_long_trades = float(results_df["num_long_trades"].mean())
    avg_short_trades = float(results_df["num_short_trades"].mean())
    
    stats = {
        "expected_wealth": expected_wealth,
        "std_wealth": std_wealth,
        "sharpe_ratio": sharpe_ratio,
        "num_trajectories": int(final_wealths.size),
        "min_wealth": float(np.min(final_wealths)),
        "median_wealth": float(np.median(final_wealths)),
        "max_wealth": float(np.max(final_wealths)),
        "avg_long_trades": avg_long_trades,
        "avg_short_trades": avg_short_trades,
    }
    return stats


def main():
    results_df = run_all_trajectories(CSV_PATH)
    stats = calculate_statistics(results_df)
    
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Number of trajectories: {stats['num_trajectories']}")
    print(f"Initial wealth: {COMMON_CASH:.2f}")
    print(f"\nExpected final wealth: {stats['expected_wealth']:.4f}")
    print(f"Standard deviation: {stats['std_wealth']:.4f}")
    print(f"Sharpe ratio: {stats['sharpe_ratio']:.4f}")
    print(f"\nMin wealth: {stats['min_wealth']:.4f}")
    print(f"Median wealth: {stats['median_wealth']:.4f}")
    print(f"Max wealth: {stats['max_wealth']:.4f}")
    print(f"\nAvg long trades per trajectory:  {stats['avg_long_trades']:.2f}")
    print(f"Avg short trades per trajectory: {stats['avg_short_trades']:.2f}")
    
    # Check for broke trajectories (wealth <= 0)
    broke_mask = results_df["final_wealth"] <= 0
    broke_count = int(broke_mask.sum())
    total = len(results_df)
    broke_pct = 100.0 * broke_count / total if total > 0 else 0.0
    print(f"\nBroke trajectories (wealth ≤ 0): {broke_count} ({broke_pct:.1f}%)")
    
    out_file = "rollout_results.csv"
    results_df.to_csv(out_file, index=False)
    print(f"\nDetailed results saved to: {out_file}")
    
    return results_df, stats


if __name__ == "__main__":
    main()