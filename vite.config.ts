import preact from '@preact/preset-vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { site } from './site.config'

/** Emits manifest.webmanifest from site.config.ts and fills the page title. */
function siteConfigPlugin(): Plugin {
  return {
    name: 'site-config',
    transformIndexHtml: (html) => html.replaceAll('%SITE_NAME%', site.name),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(
          {
            name: site.name,
            short_name: site.name,
            display: 'standalone',
            start_url: '/',
            icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
          },
          null,
          2,
        ),
      })
    },
  }
}

export default defineConfig({
  plugins: [preact(), siteConfigPlugin()],
  build: {
    // Removes Vite's fetch( call from the bundle.
    modulePreload: { polyfill: false },
    // One JS chunk, no code splitting: the offline file relies on it.
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
  },
})
