#!/usr/bin/env python3
"""
Flexible Parameter Sweep for Threshold Strategy

Automatically sweeps over threshold_re and threshold_de.
Outputs beautiful terminal tables.
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List, Dict, Any
import itertools
from datetime import datetime

# Import simulation components
import sys
sys.path.append('.')

from simulate import (
    load_csv_data,
    extract_trajectory,
    get_unique_trajectories,
    COMMON_CASH,
    CSV_PATH,
)

import simulate

# =====================================================
# SWEEP CONFIGURATION - ONLY LISTS WILL BE SWEPT
# =====================================================

SWEEP_CONFIG = {
    # Fixed parameters (pure contrarian to start)
    'mean_reversion_level': 50.0,
    'action_threshold': [0.5, 1.0, 1.5, 2.0, 2.5],

    'threshold_re': [0.0, 0.3, 0.6, 0.9, 1.2, 1.5],
    'threshold_de': [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0],
}

# Number of trajectories per combination
NUM_TRAJECTORIES = 100
SWEEP_RANDOM_SEED = 42

# =====================================================
# SWEEP RESULT DATACLASS
# =====================================================

@dataclass
class SweepResult:
    config: Dict[str, Any]
    expected_wealth: float
    std_wealth: float
    sharpe_ratio: float
    min_wealth: float
    median_wealth: float
    max_wealth: float
    avg_trades: float
    avg_long_trades: float
    avg_short_trades: float
    broke_pct: float


# =====================================================
# SIMULATION CORE
# =====================================================

def run_single_trajectory_with_config(trajectory_data: Dict[str, np.ndarray], config: Dict) -> Dict:
    """Run single trajectory with specific config."""
    # Temporarily override config
    old_config = simulate.CONTRARIAN_CONFIG.copy()
    simulate.CONTRARIAN_CONFIG.update(config)
    
    result = simulate.run_single_trajectory(trajectory_data, 0)
    
    # Restore config
    simulate.CONTRARIAN_CONFIG = old_config
    
    return result


def run_parameter_combination(df: pd.DataFrame, trajectory_ids: List[int], config: Dict) -> SweepResult:
    results = []
    for traj_id in trajectory_ids:
        traj_data = simulate.extract_trajectory(df, traj_id)
        res = run_single_trajectory_with_config(traj_data, config)
        results.append(res)
    
    wealths = np.array([r["final_wealth"] for r in results])
    wealths = wealths[np.isfinite(wealths)]

    expected_wealth = float(wealths.mean())
    std_wealth = float(wealths.std(ddof=1)) if len(wealths) > 1 else 0.0
    sharpe = (expected_wealth - simulate.COMMON_CASH) / std_wealth if std_wealth > 0 else np.nan

    return SweepResult(
        config=config.copy(),
        expected_wealth=expected_wealth,
        std_wealth=std_wealth,
        sharpe_ratio=sharpe,
        min_wealth=float(wealths.min()),
        median_wealth=float(np.median(wealths)),
        max_wealth=float(wealths.max()),
        avg_trades=float(np.mean([r["num_trades"] for r in results])),
        avg_long_trades=float(np.mean([r["num_long_trades"] for r in results])),
        avg_short_trades=float(np.mean([r["num_short_trades"] for r in results])),
        broke_pct=100.0 * (wealths <= 0).mean(),
    )


# =====================================================
# AUTO-GENERATE SWEEP COMBINATIONS
# =====================================================

def generate_parameter_combinations() -> List[Dict]:
    # Detect which parameters are being swept (i.e., are lists)
    sweep_params = {k: v for k, v in SWEEP_CONFIG.items() if isinstance(v, list)}
    fixed_params = {k: v for k, v in SWEEP_CONFIG.items() if not isinstance(v, list)}

    if not sweep_params:
        print("No parameters to sweep! All values are fixed.")
        return [SWEEP_CONFIG.copy()]

    keys, values = zip(*sweep_params.items())
    combinations = []
    for combo in itertools.product(*values):
        config = fixed_params.copy()
        config.update(dict(zip(keys, combo)))
        config['enabled'] = True  # Always enabled
        combinations.append(config)
    
    return combinations


# =====================================================
# MAIN SWEEP
# =====================================================

def perform_sweep() -> pd.DataFrame:
    if SWEEP_RANDOM_SEED is not None:
        np.random.seed(SWEEP_RANDOM_SEED)

    print("Loading market data...")
    df = simulate.load_csv_data(simulate.CSV_PATH)
    trajectory_ids = simulate.get_unique_trajectories(df)[:NUM_TRAJECTORIES]

    combinations = generate_parameter_combinations()
    print(f"Running sweep over {len(combinations)} parameter combination(s)")
    print(f"Using {NUM_TRAJECTORIES} trajectories each\n")

    results = []
    for idx, config in enumerate(combinations, 1):
        # Pretty print current config (only show swept params)
        swept_part = {k: config[k] for k in config.keys() if k in SWEEP_CONFIG and isinstance(SWEEP_CONFIG[k], list)}
        print(f"[{idx}/{len(combinations)}] Testing → {swept_part}")

        result = run_parameter_combination(df, trajectory_ids, config)
        results.append(result)

    # Convert to DataFrame
    records = []
    for r in results:
        row = r.config.copy()
        row.update({
            'E[Wealth]': r.expected_wealth,
            'Std': r.std_wealth,
            'Sharpe': r.sharpe_ratio,
            'Trades': r.avg_trades,
            'Broke%': r.broke_pct,
            'Min': r.min_wealth,
            'Median': r.median_wealth,
            'Max': r.max_wealth,
        })
        records.append(row)

    results_df = pd.DataFrame(records)
    return results_df


# =====================================================
# PRETTY TERMINAL OUTPUT
# =====================================================

def format_table(df: pd.DataFrame) -> str:
    display = df.copy()

    # Only show swept parameters + key metrics
    swept_cols = [col for col in df.columns if isinstance(SWEEP_CONFIG.get(col), list)]
    metric_cols = ['E[Wealth]', 'Std', 'Sharpe', 'Trades', 'Broke%']

    # Reorder
    cols_to_show = swept_cols + metric_cols
    display = display[cols_to_show]

    # Formatting
    for col in swept_cols:
        if display[col].dtype == bool:
            display[col] = display[col].map({True: 'Yes', False: 'No'})
        elif display[col].dtype == float:
            display[col] = display[col].apply(lambda x: f"{x:.2f}")

    display['E[Wealth]'] = display['E[Wealth]'].apply(lambda x: f"{x:.2f}")
    display['Std'] = display['Std'].apply(lambda x: f"{x:.2f}")
    display['Sharpe'] = display['Sharpe'].apply(lambda x: f"{x:.3f}" if not np.isnan(x) else "N/A")
    display['Trades'] = display['Trades'].apply(lambda x: f"{x:.1f}")
    display['Broke%'] = display['Broke%'].apply(lambda x: f"{x:.1f}%")

    return display.to_string(index=False, float_format=lambda x: f"{x:.3f}")


def print_best_configs(df: pd.DataFrame):
    print("\n" + "="*80)
    print("TOP 10 CONFIGURATIONS BY SHARPE RATIO")
    print("="*80)

    # Get top 10 by Sharpe ratio
    top10 = df.nlargest(10, 'Sharpe')
    
    # Get swept parameter names
    swept_params = [col for col in df.columns if isinstance(SWEEP_CONFIG.get(col), list)]
    
    for rank, (idx, row) in enumerate(top10.iterrows(), 1):
        print(f"\n#{rank} - Sharpe: {row['Sharpe']:.4f}, E[Wealth]: {row['E[Wealth]']:.2f}, Std: {row['Std']:.2f}")
        print(f"     Trades: {row['Trades']:.1f}, Broke%: {row['Broke%']:.1f}%")
        
        # Show swept parameters
        config_str = ", ".join([f"{k}={row[k]}" for k in swept_params if k in row.index])
        print(f"     Config: {config_str}")
    
    # Also show best by wealth
    print("\n" + "-"*80)
    best_wealth = df.loc[df['E[Wealth]'].idxmax()]
    print(f"\nBest by Expected Wealth: {best_wealth['E[Wealth]']:.2f} (Sharpe: {best_wealth['Sharpe']:.4f})")
    config_str = ", ".join([f"{k}={best_wealth[k]}" for k in swept_params if k in best_wealth.index])
    print(f"  Config: {config_str}")


# =====================================================
# MAIN
# =====================================================

def main():
    print("=" * 80)
    print(" THRESHOLD STRATEGY - PARAMETER SWEEP ".center(80))
    print("=" * 80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Trajectories per run: {NUM_TRAJECTORIES}")
    print()

    results_df = perform_sweep()

    # Save
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    outfile = f"sweep_results_{timestamp}.csv"
    results_df.to_csv(outfile, index=False)
    print(f"\nResults saved to: {outfile}")

    # Display
    print("\n" + "="*80)
    print("SWEEP RESULTS TABLE")
    print("="*80)
    print(format_table(results_df))

    print_best_configs(results_df)

    print(f"\nSweep completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)


if __name__ == "__main__":
    main()