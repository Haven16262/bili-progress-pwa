import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    env: {
      TEST_DB: ':memory:',
      // Hermetic test env: auth middleware exits at import time without JWT_SECRET
      JWT_SECRET: 'vitest-only-secret-never-production'
    }
  }
})
