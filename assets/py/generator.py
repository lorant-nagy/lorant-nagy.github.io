"""
Market Primitives Generator - Modular Version
==============================================
Generate market microstructure primitives using VAR processes with flexible transforms.

HOW TO USE:
-----------
1. Edit the CONFIG section below
2. Run: python generator_modular.py
3. Output CSV saved to specified directory
"""

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from abc import ABC, abstractmethod


# ============================================================================
# CONFIGURATION
# ============================================================================

# Generation settings
N_TRAJECTORIES = 100
TERMINAL_TIME = 800
RANDOM_SEED = 42  # Set to None for random

# AR(1) parameters for each primitive: x[t+1] = alpha * x[t] + noise
AR_PARAMS = {
    'asset_price': {
        'alpha': 0.96,
        'noise_scale': 1.0,  # Innovation standard deviation
    },
    'depth': {
        'alpha': 0.92,
        'noise_scale': 0.387,  # sqrt(0.15) for variance 0.15
    },
    'resilience': {
        'alpha': 0.93,
        'noise_scale': 0.1,  # sqrt(0.10) for variance 0.10
    }
}

# Transform configurations for each primitive
TRANSFORM_CONFIG = {
    'asset_price': {
        'pre_offset': 0.0,
        'pre_scale': 1.0,
        'transform': None,  # No transform (linear)
        'post_offset': 50.0,  # Center at 50
        'post_scale': 1.0,
    },
    'depth': {
        'pre_offset': 0.0,
        'pre_scale': 1.0,
        'transform': {
            'type': 'bounded_sigmoid',
            'params': {
                'lower': 0.2,   # Minimum depth
                'upper': 2.0,    # Maximum depth
                'steepness': 1.0,
            }
        },
        'post_offset': 0.0,
        'post_scale': 1.0,
    },
    'resilience': {
        'pre_offset': 0.0,
        'pre_scale': 1.0,
        'transform': {
            'type': 'bounded_sigmoid',
            'params': {
                'lower': 0.3,    # Minimum resilience
                'upper': 1.4,    # Maximum resilience
                'steepness': 1.0,
            }
        },
        'post_offset': 0.5,
        'post_scale': 1.0,
    }
}

# Output settings
OUTPUT_DIR = Path("assets/data")
OUTPUT_FILENAME = "market_primitives.csv"


# ============================================================================
# AR(1) GENERATOR
# ============================================================================

def generate_ar1(alpha, noise_scale, n_trajectories, terminal_time):
    """
    Generate AR(1) process: x[t+1] = alpha * x[t] + noise
    
    Args:
        alpha: AR(1) coefficient
        noise_scale: Standard deviation of innovation
        n_trajectories: Number of independent trajectories
        terminal_time: Number of time steps per trajectory
    
    Returns:
        Array of shape (n_trajectories, terminal_time + 1)
    """
    series = np.zeros((n_trajectories, terminal_time + 1))
    
    for t in range(terminal_time):
        noise = noise_scale * np.random.randn(n_trajectories)
        series[:, t + 1] = alpha * series[:, t] + noise
    
    return series


# ============================================================================
# TRANSFORM CLASSES
# ============================================================================

class Transform(ABC):
    """Abstract base class for transforms"""
    
    @abstractmethod
    def __call__(self, x):
        """Apply transform to input"""
        pass
    
    @abstractmethod
    def __repr__(self):
        """String representation"""
        pass


class IdentityTransform(Transform):
    """Identity transform (no transformation)"""
    
    def __call__(self, x):
        return x
    
    def __repr__(self):
        return "Identity"


class SigmoidTransform(Transform):
    """Scaled sigmoid transform: scale * sigmoid(x)"""
    
    def __init__(self, scale=1.0):
        self.scale = scale
    
    def __call__(self, x):
        return self.scale / (1.0 + np.exp(-x))
    
    def __repr__(self):
        return f"Sigmoid(scale={self.scale})"


class BoundedSigmoidTransform(Transform):
    """Bounded sigmoid: maps R to [lower, upper]"""
    
    def __init__(self, lower=0.0, upper=1.0, steepness=1.0):
        """
        Args:
            lower: Lower bound
            upper: Upper bound
            steepness: Controls steepness of sigmoid (default 1.0)
        """
        self.lower = lower
        self.upper = upper
        self.steepness = steepness
        self.range = upper - lower
    
    def __call__(self, x):
        """Maps x ∈ R to [lower, upper]"""
        sigmoid = 1.0 / (1.0 + np.exp(-self.steepness * x))
        return self.lower + self.range * sigmoid
    
    def __repr__(self):
        return f"BoundedSigmoid(lower={self.lower}, upper={self.upper}, k={self.steepness})"


class TanhTransform(Transform):
    """Scaled tanh transform: lower + (upper-lower) * (tanh(x) + 1) / 2"""
    
    def __init__(self, lower=-1.0, upper=1.0):
        self.lower = lower
        self.upper = upper
        self.range = upper - lower
    
    def __call__(self, x):
        """Maps x ∈ R to [lower, upper]"""
        return self.lower + self.range * (np.tanh(x) + 1.0) / 2.0
    
    def __repr__(self):
        return f"Tanh(lower={self.lower}, upper={self.upper})"


# ============================================================================
# TRANSFORM FACTORY
# ============================================================================

def create_transform(config):
    """Create transform from configuration dictionary"""
    if config is None:
        return IdentityTransform()
    
    transform_type = config.get('type', 'identity')
    params = config.get('params', {})
    
    if transform_type == 'identity':
        return IdentityTransform()
    elif transform_type == 'sigmoid':
        return SigmoidTransform(**params)
    elif transform_type == 'bounded_sigmoid':
        return BoundedSigmoidTransform(**params)
    elif transform_type == 'tanh':
        return TanhTransform(**params)
    else:
        raise ValueError(f"Unknown transform type: {transform_type}")


# ============================================================================
# PRIMITIVES GENERATOR
# ============================================================================

class PrimitivesGenerator:
    """Generate market primitives using independent AR(1) processes with transforms"""
    
    def __init__(self, ar_params, transform_config):
        """
        Args:
            ar_params: Dictionary with AR(1) parameters for each primitive
            transform_config: Dictionary with transform specs for each primitive
        """
        self.ar_params = ar_params
        self.transform_config = transform_config
        
        # Create transforms for each primitive
        self.transforms = {
            'asset_price': self._build_transform_pipeline('asset_price'),
            'depth': self._build_transform_pipeline('depth'),
            'resilience': self._build_transform_pipeline('resilience'),
        }
        
        # Print AR parameters
        self.print_ar_params()
    
    def _build_transform_pipeline(self, name):
        """Build transform pipeline for a primitive"""
        config = self.transform_config[name]
        
        return {
            'pre_offset': config.get('pre_offset', 0.0),
            'pre_scale': config.get('pre_scale', 1.0),
            'transform': create_transform(config.get('transform')),
            'post_offset': config.get('post_offset', 0.0),
            'post_scale': config.get('post_scale', 1.0),
        }
    
    def _apply_transform(self, x, pipeline):
        """Apply full transform pipeline to data"""
        # Pre-processing
        x = x + pipeline['pre_offset']
        x = x * pipeline['pre_scale']
        
        # Core transform
        x = pipeline['transform'](x)
        
        # Post-processing
        x = x + pipeline['post_offset']
        x = x * pipeline['post_scale']
        
        return x
    
    def print_ar_params(self):
        """Print AR(1) parameters"""
        print("\n" + "="*60)
        print("AR(1) PARAMETERS")
        print("="*60)
        
        for name in ['asset_price', 'depth', 'resilience']:
            params = self.ar_params[name]
            print(f"\n{name.upper()}:")
            print(f"  Alpha (AR coefficient): {params['alpha']}")
            print(f"  Noise scale (σ):        {params['noise_scale']}")
            print(f"  Stable: {'✓ Yes' if params['alpha'] < 1.0 else '✗ No'}")
        
        print()
    
    def generate(self, n_trajectories, terminal_time):
        """Generate primitives for multiple trajectories"""
        
        print("\n" + "="*60)
        print("GENERATING MARKET PRIMITIVES")
        print("="*60)
        print(f"Trajectories: {n_trajectories}")
        print(f"Time steps: {terminal_time}")
        print()
        
        # Generate independent AR(1) processes
        print("Generating AR(1) processes...")
        asset_price_raw = generate_ar1(
            alpha=self.ar_params['asset_price']['alpha'],
            noise_scale=self.ar_params['asset_price']['noise_scale'],
            n_trajectories=n_trajectories,
            terminal_time=terminal_time
        )
        
        depth_raw = generate_ar1(
            alpha=self.ar_params['depth']['alpha'],
            noise_scale=self.ar_params['depth']['noise_scale'],
            n_trajectories=n_trajectories,
            terminal_time=terminal_time
        )
        
        resilience_raw = generate_ar1(
            alpha=self.ar_params['resilience']['alpha'],
            noise_scale=self.ar_params['resilience']['noise_scale'],
            n_trajectories=n_trajectories,
            terminal_time=terminal_time
        )
        
        print("✓ AR(1) processes generated")
        print()
        
        # Apply transforms
        print("Applying transforms...")
        asset_price = self._apply_transform(asset_price_raw, self.transforms['asset_price'])
        depth = self._apply_transform(depth_raw, self.transforms['depth'])
        resilience = self._apply_transform(resilience_raw, self.transforms['resilience'])
        
        print("✓ Transforms applied")
        print()
        
        primitives = {
            'asset_price': asset_price,
            'depth': depth,
            'resilience': resilience
        }
        
        return primitives
    
    def print_config(self):
        """Print configuration summary"""
        print("\n" + "="*60)
        print("TRANSFORM CONFIGURATION")
        print("="*60)
        
        for name in ['asset_price', 'depth', 'resilience']:
            pipeline = self.transforms[name]
            print(f"\n{name.upper()}:")
            print(f"  Pre-offset:  {pipeline['pre_offset']}")
            print(f"  Pre-scale:   {pipeline['pre_scale']}")
            print(f"  Transform:   {pipeline['transform']}")
            print(f"  Post-offset: {pipeline['post_offset']}")
            print(f"  Post-scale:  {pipeline['post_scale']}")
        
        print()


# ============================================================================
# DATA EXPORT
# ============================================================================

def primitives_to_dataframe(primitives, n_trajectories, terminal_time):
    """Convert primitives to long-format DataFrame"""
    
    print("\n" + "="*60)
    print("CONVERTING TO DATAFRAME")
    print("="*60)
    
    trajectory_ids = np.repeat(np.arange(n_trajectories), terminal_time + 1)
    time_steps = np.tile(np.arange(terminal_time + 1), n_trajectories)
    
    df = pd.DataFrame({
        'trajectory_id': trajectory_ids,
        'time': time_steps,
        'asset_price': primitives['asset_price'].flatten(),
        'depth': primitives['depth'].flatten(),
        'resilience': primitives['resilience'].flatten()
    })
    
    print(f"✓ Created dataframe with {len(df):,} rows")
    print()
    
    return df


def save_primitives(df, ar_params, transform_config):
    """Save primitives to CSV with metadata"""
    
    print("\n" + "="*60)
    print("SAVING TO FILE")
    print("="*60)
    
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUTPUT_DIR / OUTPUT_FILENAME
    
    # Build metadata
    metadata = [
        f"# Market Primitives Dataset",
        f"# Generated: {datetime.now().isoformat()}",
        f"# Generator: Independent AR(1) processes with transforms",
        f"#",
        f"# Parameters:",
        f"# n_trajectories: {N_TRAJECTORIES}",
        f"# terminal_time: {TERMINAL_TIME}",
        f"# random_seed: {RANDOM_SEED}",
        f"#",
        f"# AR(1) Parameters:",
    ]
    
    for name in ['asset_price', 'depth', 'resilience']:
        params = ar_params[name]
        metadata.append(f"# {name}:")
        metadata.append(f"#   alpha: {params['alpha']}")
        metadata.append(f"#   noise_scale: {params['noise_scale']}")
    
    metadata.append(f"#")
    metadata.append(f"# Transforms:")
    for name, config in transform_config.items():
        transform_info = config.get('transform')
        if transform_info is None:
            transform_type = 'identity'
        else:
            transform_type = transform_info.get('type', 'identity')
        metadata.append(f"#   {name}: {transform_type}")
    
    metadata.append("#")
    
    # Write metadata and data
    with open(filepath, 'w') as f:
        f.write('\n'.join(metadata) + '\n')
    
    df.to_csv(filepath, mode='a', index=False)
    
    print(f"✓ Saved to: {filepath}")
    print(f"  - {N_TRAJECTORIES} trajectories")
    print(f"  - {TERMINAL_TIME + 1} time steps each")
    print(f"  - Total rows: {len(df):,}")
    print()
    
    return filepath


# ============================================================================
# STATISTICS
# ============================================================================

def print_statistics(primitives):
    """Print summary statistics"""
    
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
        
        if np.any(np.isnan(data)):
            print(f"  ⚠ WARNING: Contains NaN values!")
        if np.any(np.isinf(data)):
            print(f"  ⚠ WARNING: Contains infinite values!")
    
    print()


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Main execution"""
    
    print("\n" + "="*70)
    print(" "*15 + "MARKET PRIMITIVES GENERATOR")
    print("="*70)
    print()
    print(f"Configuration:")
    print(f"  Generator:     Independent AR(1) processes")
    print(f"  Trajectories:  {N_TRAJECTORIES}")
    print(f"  Time steps:    {TERMINAL_TIME}")
    print(f"  Random seed:   {RANDOM_SEED if RANDOM_SEED is not None else 'None (random)'}")
    
    if RANDOM_SEED is not None:
        np.random.seed(RANDOM_SEED)
        print(f"\n✓ Random seed set to: {RANDOM_SEED}")
    
    # Initialize generator
    generator = PrimitivesGenerator(
        ar_params=AR_PARAMS,
        transform_config=TRANSFORM_CONFIG
    )
    
    # Print configuration
    generator.print_config()
    
    # Generate primitives
    primitives = generator.generate(N_TRAJECTORIES, TERMINAL_TIME)
    
    # Print statistics
    print_statistics(primitives)
    
    # Convert to dataframe
    df = primitives_to_dataframe(primitives, N_TRAJECTORIES, TERMINAL_TIME)
    
    # Save to file
    filepath = save_primitives(df, AR_PARAMS, TRANSFORM_CONFIG)
    
    print("\n" + "="*70)
    print(" "*30 + "✓ COMPLETE")
    print("="*70)
    print(f"\nYour data is ready at:")
    print(f"  {filepath.absolute()}")
    print()


if __name__ == "__main__":
    main()