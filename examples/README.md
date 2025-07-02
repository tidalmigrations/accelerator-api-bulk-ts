# Tidal API Bulk Operations Examples

This directory contains example scripts demonstrating various bulk operations with the Tidal API.

## Prerequisites

1. Create a `.env` file in the project root based on `.env.example`
2. Set the required environment variables:
   - `TIDAL_WORKSPACE`
   - `TIDAL_USERNAME`
   - `TIDAL_PASSWORD`
   - Additional variables as needed for specific examples

## Available Examples

### 1. Server Backup Demo (`server-backup-demo.ts`)
Creates a comprehensive backup of all servers in your Tidal workspace.

```bash
npm run demo:server-backup
```

### 2. Hostname to FQDN Demo (`hostname-to-fqdn-demo.ts`)
Demonstrates updating server hostnames to fully qualified domain names.

```bash
npm run demo:hostname-fqdn
```

### 3. CPU Utilization Update Demo (`cpu-utilization-update-demo.ts`)
Updates server CPU utilization values from a CSV file.

**Prerequisites:**
- Set `CPU_UTILIZATION_CSV_PATH` in your `.env` file
- Ensure the CSV file has the required format with columns: `Name`, `CPU Utilization %`, `Memory Utilization %`, `Disk Utilization % (Peak)`

```bash
# Run with actual updates
npm run demo:cpu-utilization

# Run in dry-run mode to preview changes
npm run demo:cpu-utilization:dry-run
```

### 4. CPU Utilization Default Value Demo (`cpu-util-default-value-demo.ts`)
Sets the `cpu-util-manual-pct` custom field to 100 for all servers where it's not already set.

This example:
- Fetches all servers from the Tidal API
- Identifies servers without a CPU utilization value
- Sets the default value to 100% for those servers
- Provides detailed reporting and batch processing

```bash
# Run with actual updates
npm run demo:cpu-util-default

# Run in dry-run mode to preview changes
npm run demo:cpu-util-default:dry-run
```

## Common Features

All examples include:
- **Dry Run Mode**: Use `--dry-run` flag or set `DRY_RUN=true` to preview changes without making actual updates
- **Batch Processing**: Configurable batch sizes to avoid API rate limits
- **Error Handling**: Comprehensive error reporting and retry logic
- **Progress Reporting**: Real-time progress updates during processing
- **Detailed Logging**: Structured logging for debugging and monitoring
- **Report Generation**: JSON reports saved to the `reports/` directory

## Configuration

Examples use configuration from `src/config/environment.ts` which loads from:
- Environment variables
- `.env` file
- Default values

Key configuration options:
- `bulk.batchSize`: Number of items to process in each batch
- `bulk.retryAttempts`: Number of retry attempts for failed operations
- `bulk.retryDelay`: Delay between retry attempts (milliseconds)

## Running Examples

You can run examples in several ways:

1. **Using npm scripts** (recommended):
   ```bash
   npm run demo:cpu-util-default
   npm run demo:cpu-util-default:dry-run
   ```

2. **Using ts-node directly**:
   ```bash
   npx ts-node examples/cpu-util-default-value-demo.ts
   npx ts-node examples/cpu-util-default-value-demo.ts --dry-run
   ```

3. **Using environment variables**:
   ```bash
   DRY_RUN=true npm run demo:cpu-util-default
   ```

## Output

Examples generate:
- Console output with progress updates and summaries
- JSON reports in the `reports/` directory
- Detailed logging (configurable level)

## Error Handling

All examples include robust error handling for:
- Authentication failures
- API errors (rate limits, server errors)
- Network connectivity issues
- Data validation errors
- File system operations

## Support

For questions or issues with these examples, please refer to the main project documentation or create an issue in the repository. 