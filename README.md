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
```

The base URL is automatically generated as `https://{workspace}.tidal.cloud/api/v1`.

## 🚀 Quick Start

### Basic Authentication and Client Setup

```typescript
import { TidalApiClient } from './src/api/client';

const client = new TidalApiClient({ 
  workspace: 'your-workspace' 
});

await client.authenticate('username', 'password');
```

### Server Operations

For detailed examples of server operations including backup functionality, bulk updates, and individual server management, see the examples in the `examples/` folder.

## 🎮 Examples

### Server Backup Demo

Run the server backup demonstration:

```bash
npm run demo:server-backup
```

Or run directly:

```bash
npx ts-node examples/server-backup-demo.ts
```

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

The client provides comprehensive error handling:

```typescript
try {
  const backup = await serverOps.createServerBackup();
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle authentication issues
  } else if (error instanceof ValidationError) {
    // Handle validation errors
  } else {
    // Handle other errors
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
