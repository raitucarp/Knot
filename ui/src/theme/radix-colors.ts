import * as radixColors from '@radix-ui/colors'

// List of all primary Radix color scale names
export const radixColorNames = [
  'amber',
  'blue',
  'bronze',
  'brown',
  'crimson',
  'cyan',
  'gold',
  'grass',
  'gray',
  'green',
  'indigo',
  'iris',
  'jade',
  'lime',
  'mauve',
  'mint',
  'olive',
  'orange',
  'pink',
  'plum',
  'purple',
  'red',
  'ruby',
  'sage',
  'sand',
  'sky',
  'slate',
  'teal',
  'tomato',
  'violet',
  'yellow',
] as const

export type RadixColorName = (typeof radixColorNames)[number]

/**
 * Builds tokens for Chakra UI v3 containing both light and dark Radix colors
 */
export function buildRadixColorTokens() {
  const tokens: Record<string, Record<string, { value: string }>> = {}
  const rawColors = radixColors as Record<string, Record<string, string>>

  for (const name of radixColorNames) {
    const lightPalette = rawColors[name]
    const darkPalette = rawColors[`${name}Dark`]

    if (lightPalette) {
      tokens[name] = {}
      for (let step = 1; step <= 12; step++) {
        const key = `${name}${step}`
        if (lightPalette[key]) {
          tokens[name][step.toString()] = { value: lightPalette[key] }
        }
      }
    }

    if (darkPalette) {
      const darkName = `${name}Dark`
      tokens[darkName] = {}
      for (let step = 1; step <= 12; step++) {
        const key = `${name}${step}`
        if (darkPalette[key]) {
          tokens[darkName][step.toString()] = { value: darkPalette[key] }
        }
      }
    }
  }

  return tokens
}

/**
 * Builds semantic tokens that dynamically resolve based on color mode (_light / _dark)
 */
export function buildRadixSemanticTokens() {
  const semanticColors: Record<string, Record<string, { value: string | { _light: string; _dark: string } }>> = {}
  const rawColors = radixColors as Record<string, Record<string, string>>

  for (const name of radixColorNames) {
    const lightPalette = rawColors[name]
    const darkPalette = rawColors[`${name}Dark`]

    if (!lightPalette || !darkPalette) continue

    semanticColors[name] = {
      solid: {
        value: {
          _light: `{colors.${name}.9}`,
          _dark: `{colors.${name}Dark.9}`,
        },
      },
      contrast: {
        value: '#ffffff',
      },
      fg: {
        value: {
          _light: `{colors.${name}.12}`,
          _dark: `{colors.${name}Dark.12}`,
        },
      },
      muted: {
        value: {
          _light: `{colors.${name}.11}`,
          _dark: `{colors.${name}Dark.11}`,
        },
      },
      subtle: {
        value: {
          _light: `{colors.${name}.3}`,
          _dark: `{colors.${name}Dark.3}`,
        },
      },
      emphasized: {
        value: {
          _light: `{colors.${name}.4}`,
          _dark: `{colors.${name}Dark.4}`,
        },
      },
      focusRing: {
        value: {
          _light: `{colors.${name}.8}`,
          _dark: `{colors.${name}Dark.8}`,
        },
      },
    }

    // Map each step 1-12 as responsive tokens
    for (let step = 1; step <= 12; step++) {
      semanticColors[name][step.toString()] = {
        value: {
          _light: `{colors.${name}.${step}}`,
          _dark: `{colors.${name}Dark.${step}}`,
        },
      }
    }
  }

  return semanticColors
}
