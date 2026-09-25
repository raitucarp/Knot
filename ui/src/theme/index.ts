import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import { buildRadixColorTokens, buildRadixSemanticTokens } from './radix-colors'

const radixTokens = buildRadixColorTokens()
const radixSemanticTokens = buildRadixSemanticTokens()

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        ...radixTokens,
      },
      fonts: {
        heading: { value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
        body: { value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
        mono: { value: '"JetBrains Mono", "Fira Code", Menlo, monospace' },
      },
    },
    semanticTokens: {
      colors: {
        ...radixSemanticTokens,
        bg: {
          canvas: {
            value: {
              _light: '{colors.slate.1}',
              _dark: '{colors.slateDark.1}',
            },
          },
          panel: {
            value: {
              _light: '{colors.slate.2}',
              _dark: '{colors.slateDark.2}',
            },
          },
          subtle: {
            value: {
              _light: '{colors.slate.3}',
              _dark: '{colors.slateDark.3}',
            },
          },
          muted: {
            value: {
              _light: '{colors.slate.4}',
              _dark: '{colors.slateDark.4}',
            },
          },
        },
        border: {
          subtle: {
            value: {
              _light: '{colors.slate.4}',
              _dark: '{colors.slateDark.4}',
            },
          },
          default: {
            value: {
              _light: '{colors.slate.6}',
              _dark: '{colors.slateDark.6}',
            },
          },
          emphasized: {
            value: {
              _light: '{colors.slate.8}',
              _dark: '{colors.slateDark.8}',
            },
          },
        },
        accent: {
          solid: {
            value: {
              _light: '{colors.amber.9}',
              _dark: '{colors.amberDark.9}',
            },
          },
          fg: {
            value: {
              _light: '{colors.amber.11}',
              _dark: '{colors.amberDark.11}',
            },
          },
          subtle: {
            value: {
              _light: '{colors.amber.3}',
              _dark: '{colors.amberDark.3}',
            },
          },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
