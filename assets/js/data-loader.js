// =====================================================
// DATA LOADER
// =====================================================
// CSV data loading and trajectory extraction

/**
 * Load and parse CSV file containing market primitives
 * @param {string} csvPath - Path to CSV file
 * @returns {Promise<object|null>} Trajectories grouped by ID, or null on error
 */
export async function loadCSVData(csvPath) {
  try {
    console.log(`Loading CSV from: ${csvPath}`);
    
    const response = await fetch(csvPath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV (skip comment lines starting with #)
    const lines = csvText.split('\n').filter(line => !line.startsWith('#') && line.trim());
    
    // Parse data rows
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
    
    // Group by trajectory
    const trajectories = {};
    data.forEach(row => {
      if (!trajectories[row.trajectory_id]) {
        trajectories[row.trajectory_id] = [];
      }
      trajectories[row.trajectory_id].push(row);
    });
    
    // Sort each trajectory by time
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

/**
 * Extract a specific trajectory from CSV data
 * @param {object} trajectories - All trajectories
 * @param {number} trajectoryId - ID of trajectory to extract
 * @returns {object|null} {assetPrice, depth, resilience} arrays, or null on error
 */
export function extractTrajectory(trajectories, trajectoryId) {
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

/**
 * Randomly select a trajectory ID
 * @param {object} trajectories - All trajectories
 * @returns {number} Random trajectory ID
 */
export function selectRandomTrajectory(trajectories) {
  const trajectoryIds = Object.keys(trajectories).map(id => parseInt(id));
  const randomIndex = Math.floor(Math.random() * trajectoryIds.length);
  return trajectoryIds[randomIndex];
}

/**
 * Truncate arrays to specified length
 * @param {object} data - {assetPrice, depth, resilience}
 * @param {number} maxLength - Maximum length (inclusive of index 0)
 * @returns {object} Truncated data
 */
export function truncateData(data, maxLength) {
  return {
    assetPrice: data.assetPrice.slice(0, maxLength + 1),
    depth: data.depth.slice(0, maxLength + 1),
    resilience: data.resilience.slice(0, maxLength + 1)
  };
}
