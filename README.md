# Tidal API TypeScript Bulk Operations Client

A comprehensive TypeScript client for performing bulk operations on Tidal API resources, with specialized support for servers, applications, databases, and more.

## 🚀 Features

- **Foundation & Authentication**: Complete authentication flow with token management
- **Generic Bulk Operations Framework**: Extensible framework for any resource type
- **Server-Specific Operations**: Specialized server operations with backup functionality
- **Comprehensive Validation**: Input validation and error handling
- **Batch Processing**: Intelligent batching to respect API rate limits

## 📦 Installation

```bash
npm install
```

## 🔧 Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
TIDAL_WORKSPACE=your_workspace_name
TIDAL_USERNAME=your_username
TIDAL_PASSWORD=your_password
LOG_LEVEL=info
BULK_BATCH_SIZE=50
BULK_CONCURRENT_BATCHES=3
BULK_RETRY_ATTEMPTS=3
BULK_RETRY_DELAY=1000
```

The base URL is automatically generated as `https://{workspace}.tidal.cloud/api/v1`.

## 🚀 Quick Start

### Method 1: Manual Authentication

```typescript
import { TidalApiClient } from './src/index';
import { loadConfig, getAuthCredentials } from './src/config/environment';

// Load configuration from environment
const config = loadConfig();
const credentials = getAuthCredentials();

const client = new TidalApiClient({
  workspace: config.workspace,
  baseUrl: config.baseUrl
});

// Authenticate with credentials from .env
await client.authenticate(credentials.username, credentials.password);
console.log(`Authenticated: ${client.isAuthenticated()}`);
```

### Method 2: Environment-based Authentication (Recommended)

```typescript
import { createAuthenticatedClient } from './src/index';

// This automatically loads from environment variables
const client = await createAuthenticatedClient();
console.log(`Workspace: ${client.getWorkspace()}`);
```

### Basic Authentication Example

Run the basic authentication example to see both methods in action:

```bash
npx ts-node examples/basic-authentication.ts
```

### Server Operations

For detailed examples of server operations including backup functionality, bulk updates, and individual server management, see the examples in the `examples/` folder.

## 🎮 Examples

### Basic Authentication

Demonstrates both manual and environment-based authentication methods:

```bash
npx ts-node examples/basic-authentication.ts
```

### Server Backup Demo

Run the server backup demonstration:

```bash
npm run demo:server-backup
```

Or run directly:

```bash
npx ts-node examples/server-backup-demo.ts
```

### Available Examples

- `basic-authentication.ts` - Authentication methods and client setup
- `server-backup-demo.ts` - Server backup operations
- `hostname-to-fqdn-demo.ts` - Hostname to FQDN conversion
- `hostname-to-tag-demo.ts` - Hostname to tag operations
- `description-to-hostname-demo.ts` - Description to hostname mapping

See the `examples/` folder for more detailed usage examples and demonstrations.

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testPathPattern=servers
npm test -- --testPathPattern=backup
```

Current test coverage: **88%** (exceeds 80% requirement)

## 🏗️ Architecture

```
src/
├── operations/
│   ├── base.ts              # Abstract base class for all operations
│   ├── generic.ts           # Generic bulk operations framework
│   └── servers.ts           # Server-specific operations
├── api/
│   ├── client.ts            # HTTP client with authentication
│   ├── auth.ts              # Authentication service
│   └── bulk.ts              # Bulk operations service
├── types/
│   └── bulk.ts              # Bulk operation type definitions
└── utils/
    ├── logger.ts            # Logging utilities
    ├── errors.ts            # Error handling
    └── validation.ts        # Input validation

examples/
└── server-backup-demo.ts    # Server backup demonstration

tests/
└── operations/
    └── servers.test.ts       # Server operations tests
```

## 🔍 Error Handling

The client provides comprehensive error handling with specific error types:

```typescript
import { AuthenticationError, TidalApiError, ValidationError } from './src/index';

try {
  const client = await createAuthenticatedClient();
  const response = await client.get('/servers');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
    // Check credentials in .env file
  } else if (error instanceof TidalApiError) {
    console.error('API Error:', error.message);
    console.error(`Status: ${error.status}, Code: ${error.code}`);
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## 🛡️ Security

- Secure credential management via environment variables
- Token-based authentication with automatic refresh
- Input validation for all operations
- Comprehensive error logging without exposing sensitive data

## 🔗 Related Documentation

- [Tidal API Documentation](https://guides.tidal.cloud/)
