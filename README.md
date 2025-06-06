# Tidal API TypeScript Bulk Operations Client

A TypeScript client library for performing bulk operations on Tidal API resources with authentication, error handling, and comprehensive logging.

## ✅ Features

- ✅ **Authentication Service**: Complete authentication flow with token refresh using `/authenticate` endpoint
- ✅ **API Client**: HTTP client with automatic token management
- ✅ **Error Handling**: Comprehensive error types and handling
- ✅ **Logging**: Configurable logging with multiple levels
- ✅ **Configuration**: Environment-based configuration management
- ✅ **TypeScript**: Full type safety and IntelliSense support
- ✅ **Testing**: Comprehensive unit tests with >80% coverage

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

**Note**: The base URL is automatically generated as `https://{workspace}.tidal.cloud/api/v1` based on your workspace name. You can override this by setting `TIDAL_BASE_URL` if needed.

## 🚀 Quick Start

### Basic Usage

```typescript
import { TidalApiClient } from './src/api/client';

// Create client
const client = new TidalApiClient({
  workspace: 'your-workspace'
  // baseUrl is auto-generated as https://your-workspace.tidal.cloud/api/v1
});

// Authenticate
await client.authenticate('username', 'password');

// Make API calls
const response = await client.get('/servers');
console.log(response.data);
```

### Using Environment Configuration

```typescript
import { createAuthenticatedClient } from './src/index';

// Automatically loads from environment variables
const client = await createAuthenticatedClient();

// Client is ready to use
const servers = await client.get('/servers');
```

### Manual Authentication Service

```typescript
import { AuthService } from './src/api/auth';

const auth = new AuthService('https://your-workspace.tidal.cloud/api/v1');

// Authenticate
const tokens = await auth.authenticate({
  username: 'your-username',
  password: 'your-password'
});

// Check token validity
if (auth.isTokenValid()) {
  const token = auth.getAccessToken();
  // Use token for API calls
}

// Refresh token when needed
if (!auth.isTokenValid()) {
  await auth.refreshAccessToken();
}
```

## 🔍 API Reference

### TidalApiClient

```typescript
class TidalApiClient {
  constructor(config: ClientConfig)
  
  // Authentication
  authenticate(username: string, password: string): Promise<AuthResponse>
  isAuthenticated(): boolean
  
  // HTTP Methods
  get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>
  post<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>>
  put<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>>
  patch<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>>
  delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>
  
  // Utility
  getWorkspace(): string
  getBaseUrl(): string
}
```

### AuthService

```typescript
class AuthService {
  constructor(baseUrl: string)
  
  authenticate(credentials: AuthCredentials): Promise<AuthResponse>
  isTokenValid(): boolean
  getAccessToken(): string | null
  refreshAccessToken(): Promise<AuthResponse>
  clearTokens(): void
  ensureValidToken(credentials?: AuthCredentials): Promise<string>
}
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## 📝 Development

### Build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Development Mode

```bash
npm run dev
```

## 🔧 Error Handling

The client provides comprehensive error handling:

```typescript
import { TidalApiError, AuthenticationError, ConfigurationError } from './src/utils/errors';

try {
  await client.authenticate('invalid', 'credentials');
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof TidalApiError) {
    console.error('API error:', error.status, error.message);
  }
}
```

## 📊 Logging

Configure logging levels:

```typescript
import { logger, LogLevel } from './src/utils/logger';

// Set log level
logger.setLevel(LogLevel.DEBUG);

// Log messages
logger.info('Client initialized');
logger.debug('Making API request', { endpoint: '/servers' });
logger.error('Request failed', { error: 'Network timeout' });
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request
