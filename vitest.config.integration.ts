import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Include global setup, but NOT integration-setup.ts for n8n-api tests
      // (they need real network requests, not MSW mocks)
      setupFiles: ['./tests/setup/global-setup.ts'],
      // Integration tests talk to a real n8n, so they opt INTO the real
      // credentials that unit runs now scrub. See tests/setup/test-env.ts.
      env: {
        N8N_MCP_TEST_REAL_CREDENTIALS: 'true',
      },
      // Only include integration tests
      include: ['tests/integration/**/*.test.ts'],
      // Integration tests might need more time
      testTimeout: 30000,
      // Specific pool options for integration tests
      poolOptions: {
        threads: {
          // Run integration tests sequentially by default
          singleThread: true,
          maxThreads: 1
        }
      },
      // Disable coverage for integration tests or set lower thresholds
      coverage: {
        enabled: false
      }
    }
  })
);