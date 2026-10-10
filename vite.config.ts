import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// PR 1 tests are pure engine/data tests, so vitest runs in a node environment.
// The React plugin is wired now so PR 2/3 (Canvas field, timeline) need no config churn.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
