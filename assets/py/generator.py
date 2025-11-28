"""
Market Primitives Generator
===========================
Generate market microstructure primitives (asset price, depth, resilience).

HOW TO USE:
-----------
1. Edit the CONFIG section below with your desired parameters
2. Run: python generate_primitives.py
3. Output CSV will be saved to assets/data/ directory

That's it!
"""

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime


# ============================================================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================================================

# Generation settings
N_TRAJECTORIES = 100         # Number of independent price paths to generate
TERMINAL_TIME = 800          # Number of time steps per trajectory
RANDOM_SEED = None           # Set to integer for reproducibility, None for random

# Noise scales (controls volatility for each primitive)
NOISE_SCALE_AP = 0.3         # Asset price noise scale (default 1.0, lower = less volatile)
NOISE_SCALE_DP = 0.2         # Depth noise scale
NOISE_SCALE_RE = 0.2         # Resilience noise scale

# Linear trend for asset price (drift)
TREND_SLOPE = 0.005          # Slope per time step (very low, e.g., 0.005 means +/- 4 units over 800 steps)
TREND_PROBABILITY = 0.5      # Probability of upward trend (0.5 = random sign)

# Differencing flags (controls whether to cumsum the generated series)
DIFF1_AP = False             # If True, asset price is generated as differences (cumsum to get levels)
DIFF1_DP = False             # If True, depth is generated as differences (cumsum to get levels)
DIFF1_RE = False             # If True, resilience is generated as differences (cumsum to get levels)

# AR(1) process parameters
AR_PARAMS = {
    'alpha_ap': 0.95,         # Asset price autocorrelation
    'alpha_dp': 0.95,         # Depth autocorrelation  
    'alpha_re': 0.8,          # Resilience autocorrelation
    'offset_ap': 0.0,         # Asset price offset (added after simulation)
    'offset_dp': 6.0,         # Depth mean level (added after simulation)
    'offset_re': 0.5          # Resilience mean level (added after simulation)
}

# Output settings
OUTPUT_DIR = Path("assets/data")
OUTPUT_FILENAME = "primitives_{timestamp}.csv"


# ============================================================================
# AR(1) ZERO-MEAN GENERATOR
# ============================================================================

def generate_ar1_zero_mean(params):
    """
    AR(1) generator with zero-mean simulation and offset added afterwards.
    
    This matches the JavaScript implementation:
    - Simulates zero-mean AR(1) processes
    - Adds offsets after simulation to shift mean levels
    - Ensures depth and resilience stay positive
    
    Args:
        params: Dictionary with keys 'alpha_ap', 'alpha_dp', 'alpha_re', 
                'offset_ap', 'offset_dp', 'offset_re'
    
    Returns:
        dict: {'asset_price': array, 'depth': array, 'resilience': array}
              Each array has shape (n_trajectories, terminal_time + 1)
    """
    print("\n" + "="*60)
    print("GENERATING AR(1) ZERO-MEAN PROCESSES")
    print("="*60)
    print(f"Parameters:")
    print(f"  alpha_ap = {params['alpha_ap']}")
    print(f"  alpha_dp = {params['alpha_dp']}")
    print(f"  alpha_re = {params['alpha_re']}")
    print(f"  offset_ap = {params['offset_ap']}")
    print(f"  offset_dp = {params['offset_dp']}")
    print(f"  offset_re = {params['offset_re']}")
    print()
    
    n_traj = N_TRAJECTORIES
    T = TERMINAL_TIME
    
    # Initialize arrays
    asset_price = np.zeros((n_traj, T + 1))
    depth = np.zeros((n_traj, T + 1))
    resilience = np.zeros((n_traj, T + 1))
    
    # Generate random trend directions for each trajectory
    # +1 for upward trend, -1 for downward trend
    trend_signs = np.where(np.random.rand(n_traj) < TREND_PROBABILITY, 1.0, -1.0)
    
    print(f"Trend configuration:")
    print(f"  Slope magnitude: {TREND_SLOPE} per time step")
    print(f"  Upward trends: {np.sum(trend_signs == 1)} / {n_traj}")
    print(f"  Downward trends: {np.sum(trend_signs == -1)} / {n_traj}")
    print()
    
    print("Generating time series...")
    
    # Generate AR(1) processes with zero mean
    for t in range(T):
        # Generate innovations (standard normal scaled by respective NOISE_SCALE)
        noise_ap = NOISE_SCALE_AP * np.random.randn(n_traj)
        noise_dp = NOISE_SCALE_DP * np.random.randn(n_traj)
        noise_re = NOISE_SCALE_RE * np.random.randn(n_traj)
        
        # AR(1) recursion (zero mean) + linear trend for asset price
        # trend_signs * TREND_SLOPE gives +TREND_SLOPE or -TREND_SLOPE per step
        asset_price[:, t + 1] = params['alpha_ap'] * asset_price[:, t] + noise_ap + trend_signs * TREND_SLOPE
        depth[:, t + 1] = params['alpha_dp'] * depth[:, t] + noise_dp
        resilience[:, t + 1] = params['alpha_re'] * resilience[:, t] + noise_re
        
        # Progress indicator
        if (t + 1) % 200 == 0 or t == T - 1:
            print(f"  Progress: {t + 1}/{T} time steps")
    
    print("✓ Time series generation complete")
    print(f"  Noise scales: AP={NOISE_SCALE_AP}, DP={NOISE_SCALE_DP}, RE={NOISE_SCALE_RE}")
    print()
    
    # Apply cumulative sum if series were generated as differences
    print("Checking differencing flags...")
    if DIFF1_AP:
        print("  Asset price: applying cumsum (was generated as differences)")
        asset_price = np.cumsum(asset_price, axis=1)
    else:
        print("  Asset price: no cumsum (already in levels)")
    
    if DIFF1_DP:
        print("  Depth: applying cumsum (was generated as differences)")
        depth = np.cumsum(depth, axis=1)
    else:
        print("  Depth: no cumsum (already in levels)")
    
    if DIFF1_RE:
        print("  Resilience: applying cumsum (was generated as differences)")
        resilience = np.cumsum(resilience, axis=1)
    else:
        print("  Resilience: no cumsum (already in levels)")
    
    print()
    print("Applying offsets and constraints...")
    
    # Add offsets after simulation (shift to desired mean levels)
    asset_price += params['offset_ap']
    depth += params['offset_dp']
    resilience += params['offset_re']
    
    # Ensure depth and resilience stay positive (floor at 0.1)
    depth = np.maximum(0.1, depth)
    resilience = np.maximum(0.1, resilience)
    
    print("✓ Offsets applied")
    print(f"  Asset price offset: {params['offset_ap']}")
    print(f"  Depth offset: {params['offset_dp']}")
    print(f"  Resilience offset: {params['offset_re']}")
    
    return {
        'asset_price': asset_price,
        'depth': depth,
        'resilience': resilience
    }


# ============================================================================
# DATA EXPORT
# ============================================================================

def primitives_to_dataframe(primitives):
    """
    Convert primitives dictionary to pandas DataFrame in long format.
    
    Format:
    - trajectory_id: which trajectory (0 to n_trajectories-1)
    - time: time step (0 to terminal_time)
    - asset_price: price deviation from baseline
    - depth: market depth
    - resilience: market resilience
    
    Args:
        primitives: dict with arrays of shape (n_trajectories, terminal_time + 1)
        
    Returns:
        pd.DataFrame: Long-format dataframe with all trajectories
    """
    n_traj = N_TRAJECTORIES
    T = TERMINAL_TIME
    
    print("\n" + "="*60)
    print("CONVERTING TO DATAFRAME")
    print("="*60)
    
    # Create indices for trajectory and time
    trajectory_ids = np.repeat(np.arange(n_traj), T + 1)
    time_steps = np.tile(np.arange(T + 1), n_traj)
    
    # Flatten the arrays
    df = pd.DataFrame({
        'trajectory_id': trajectory_ids,
        'time': time_steps,
        'asset_price': primitives['asset_price'].flatten(),
        'depth': primitives['depth'].flatten(),
        'resilience': primitives['resilience'].flatten()
    })
    
    print(f"✓ Created dataframe with {len(df):,} rows")
    
    return df


def save_primitives(primitives, params):
    """
    Save primitives to CSV file with metadata.
    
    Args:
        primitives: dict with generated data
        params: dict with generator parameters
        
    Returns:
        Path: path to saved file
    """
    print("\n" + "="*60)
    print("SAVING TO FILE")
    print("="*60)
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = OUTPUT_FILENAME.format(timestamp=timestamp)
    filepath = OUTPUT_DIR / filename
    
    # Convert to dataframe
    df = primitives_to_dataframe(primitives)
    
    # Create metadata header
    metadata = [
        f"# Market Primitives Dataset",
        f"# Generated: {datetime.now().isoformat()}",
        f"# Generator: AR(1) zero-mean with linear trend",
        f"#",
        f"# Parameters:",
        f"# n_trajectories: {N_TRAJECTORIES}",
        f"# terminal_time: {TERMINAL_TIME}",
        f"# noise_scale_ap: {NOISE_SCALE_AP}",
        f"# noise_scale_dp: {NOISE_SCALE_DP}",
        f"# noise_scale_re: {NOISE_SCALE_RE}",
        f"# trend_slope: {TREND_SLOPE}",
        f"# trend_probability: {TREND_PROBABILITY}",
        f"# diff1_ap: {DIFF1_AP}",
        f"# diff1_dp: {DIFF1_DP}",
        f"# diff1_re: {DIFF1_RE}",
    ]
    
    # Add generator-specific parameters
    for key, value in params.items():
        metadata.append(f"# {key}: {value}")
    
    metadata.append(f"#")
    
    # Write metadata
    with open(filepath, 'w') as f:
        f.write('\n'.join(metadata) + '\n')
    
    # Append data
    df.to_csv(filepath, mode='a', index=False)
    
    print(f"✓ Saved to: {filepath}")
    print(f"  - {N_TRAJECTORIES} trajectories")
    print(f"  - {TERMINAL_TIME + 1} time steps each")
    print(f"  - Total data points: {len(df):,}")
    
    return filepath


# ============================================================================
# STATISTICS
# ============================================================================

def print_statistics(primitives):
    """Print summary statistics of generated primitives"""
    
    print("\n" + "="*60)
    print("SUMMARY STATISTICS")
    print("="*60)
    
    for name, data in primitives.items():
        print(f"\n{name.upper()}:")
        print(f"  Shape:    {data.shape}")
        print(f"  Mean:     {data.mean():>8.4f}")
        print(f"  Std Dev:  {data.std():>8.4f}")
        print(f"  Min:      {data.min():>8.4f}")
        print(f"  Max:      {data.max():>8.4f}")
        
        # Check for issues
        if np.any(np.isnan(data)):
            print(f"  ⚠ WARNING: Contains NaN values!")
        if np.any(np.isinf(data)):
            print(f"  ⚠ WARNING: Contains infinite values!")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function"""
    
    print("\n" + "="*70)
    print(" "*20 + "MARKET PRIMITIVES GENERATOR")
    print("="*70)
    print()
    print(f"Configuration:")
    print(f"  Generator:        AR(1) zero-mean")
    print(f"  Trajectories:     {N_TRAJECTORIES}")
    print(f"  Time steps:       {TERMINAL_TIME}")
    print(f"  Random seed:      {RANDOM_SEED if RANDOM_SEED is not None else 'None (random)'}")
    
    # Set random seed if provided
    if RANDOM_SEED is not None:
        np.random.seed(RANDOM_SEED)
        print(f"\n✓ Random seed set to: {RANDOM_SEED}")
    
    # Generate primitives
    params = AR_PARAMS
    primitives = generate_ar1_zero_mean(params)
    
    # Print statistics
    print_statistics(primitives)
    
    # Save to file
    filepath = save_primitives(primitives, params)
    
    print("\n" + "="*70)
    print(" "*30 + "✓ COMPLETE")
    print("="*70)
    print(f"\nYour data is ready at:")
    print(f"  {filepath.absolute()}")
    print()


if __name__ == "__main__":
    main()