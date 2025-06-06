import { ApiError } from '../api/types';

export class TidalApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'TidalApiError';
  }

  static fromApiError(error: ApiError): TidalApiError {
    return new TidalApiError(error.message, error.status, error.code, error.details);
  }
}

export class AuthenticationError extends TidalApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class NetworkError extends TidalApiError {
  constructor(message: string, originalError?: Error) {
    super(message, undefined, 'NETWORK_ERROR', originalError);
    this.name = 'NetworkError';
  }
}

export function isApiError(error: any): error is TidalApiError {
  return error instanceof TidalApiError;
}

export function handleApiError(error: any): TidalApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error.response) {
    // Axios error with response
    const status = error.response.status;
    const message = error.response.data?.message || error.message;
    return new TidalApiError(message, status, 'API_ERROR', error.response.data);
  }

  if (error.request) {
    // Network error
    return new NetworkError('Network request failed', error);
  }

  // Generic error
  return new TidalApiError(error.message || 'Unknown error occurred');
} 