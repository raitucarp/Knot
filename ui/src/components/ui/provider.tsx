'use client'

import { ChakraProvider } from '@chakra-ui/react'
import { ColorModeProvider } from './color-mode'
import { system } from '@/theme'
import * as React from 'react'

export function Provider(props: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider defaultTheme="dark" forcedTheme="dark">
        {props.children}
      </ColorModeProvider>
    </ChakraProvider>
  )
}
