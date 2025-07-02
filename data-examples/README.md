# Data Directory

This directory contains sample data files used by the examples.

## server-utilization.csv

Sample CSV file for the CPU utilization update demo. This file demonstrates the required format for importing server utilization data.

### Format Requirements

The CSV file must have the following structure:

```csv
Name,CPU Utilization %,Memory Utilization %,Disk Utilization % (Peak)
server01,25.5,65.2,45.3
server02,78.9,92.1,67.8
```

### Column Descriptions

- **Name**: Server hostname (must match hostnames in your Tidal workspace)
- **CPU Utilization %**: CPU utilization percentage (used to update the `cpu-util-manual-pct` custom field)
- **Memory Utilization %**: Memory utilization percentage (currently for reference only)
- **Disk Utilization % (Peak)**: Peak disk utilization percentage (currently for reference only)

### Usage

1. Replace the sample data with your actual server utilization data
2. Ensure server names match the hostnames in your Tidal workspace
3. Configure the path in your `.env` file:
   ```env
   CPU_UTILIZATION_CSV_PATH=data-examples/server-utilization.csv
   ```
4. Run the demo:
   ```bash
   npm run demo:cpu-utilization
   ```

### Notes

- Rows with missing or invalid CPU utilization data (empty or "-") will be skipped
- The demo will search for exact hostname matches (case-insensitive)
- Servers not found in Tidal will be reported in the failed updates section 