import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Engine/data tests run in node; UI tests opt into jsdom per file
    // via a `// @vitest-environment jsdom` docblock.
    environment: 'node',
  },
})
