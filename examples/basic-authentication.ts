#!/usr/bin/env ts-node

/**
 * Basic Authentication Example
 * 
 * This example demonstrates how to:
 * 1. Load configuration from .env file
 * 2. Create a Tidal API client with environment config
 * 3. Authenticate with credentials from .env
 * 4. Make basic API calls
 * 5. Handle errors gracefully
 * 
 * Prerequisites:
 * - Create a .env file based on .env.example
 * - Set TIDAL_WORKSPACE, TIDAL_USERNAME, TIDAL_PASSWORD
 */

import { TidalApiClient, createAuthenticatedClient } from '../src/index';
import { AuthenticationError, TidalApiError } from '../src/utils/errors';
import { loadConfig, getAuthCredentials } from '../src/config/environment';

async function basicAuthenticationExample() {
  console.log('🚀 Tidal API Basic Authentication Example\n');

  try {
    // Method 1: Manual client creation and authentication
    console.log('📝 Method 1: Manual Authentication');
    
    // Load configuration from environment
    const config = loadConfig();
    const credentials = getAuthCredentials();
    
    const client = new TidalApiClient({
      workspace: config.workspace,
      baseUrl: config.baseUrl
    });

    // Authenticate with credentials from .env
    await client.authenticate(credentials.username, credentials.password);
    console.log('✅ Authentication successful!');
    console.log(`📍 Workspace: ${client.getWorkspace()}`);
    console.log(`🌐 Base URL: ${client.getBaseUrl()}`);
    console.log(`🔐 Authenticated: ${client.isAuthenticated()}\n`);

    // Make a test API call
    try {
      console.log('📡 Making test API call to /servers...');
      const response = await client.get('/servers');
      console.log(`✅ API call successful! Status: ${response.status}`);
      console.log(`📊 Received ${response.data?.length || 0} servers\n`);
    } catch (apiError) {
      console.log('⚠️  API call failed (this is expected if endpoint doesn\'t exist)');
      console.log(`   Error: ${apiError instanceof Error ? apiError.message : String(apiError)}\n`);
    }

  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('❌ Authentication failed:', error.message);
      console.error('   Please check your credentials in .env file\n');
    } else if (error instanceof TidalApiError) {
      console.error('❌ API Error:', error.message);
      console.error(`   Status: ${error.status}, Code: ${error.code}\n`);
    } else {
      console.error('❌ Unexpected error:', error instanceof Error ? error.message : String(error));
      console.error('   Make sure your .env file is configured with TIDAL_WORKSPACE, TIDAL_USERNAME, TIDAL_PASSWORD\n');
    }
  }

  try {
    // Method 2: Using environment variables (recommended)
    console.log('📝 Method 2: Environment-based Authentication');
    console.log('   (Make sure to set TIDAL_WORKSPACE, TIDAL_USERNAME, TIDAL_PASSWORD in .env)');
    
    // This will automatically load from environment variables
    const envClient = await createAuthenticatedClient();
    console.log('✅ Environment-based authentication successful!');
    console.log(`📍 Workspace: ${envClient.getWorkspace()}`);
    console.log(`🔐 Authenticated: ${envClient.isAuthenticated()}\n`);

  } catch (error) {
    console.log('⚠️  Environment-based authentication failed');
    console.log('   This is expected if .env file is not configured');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  console.log('🎉 Example completed!');
  console.log('\n📚 Next steps:');
  console.log('   1. Ensure your .env file has valid Tidal credentials');
  console.log('   2. Try making API calls to your Tidal workspace');
  console.log('   3. Explore bulk operations in Phase 2');
  console.log('\n💡 Note: Both methods above use the same .env configuration');
}

// Run the example
if (require.main === module) {
  basicAuthenticationExample().catch(console.error);
}

export { basicAuthenticationExample }; 