import React from 'react'
import { HStack, Box, Text } from '@chakra-ui/react'
import { LuCircleCheck, LuBinary, LuLayers, LuNetwork } from 'react-icons/lu'

interface StatusBarProps {
  totalNodes?: number
  totalEdges?: number
  activeName?: string
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalNodes = 0,
  totalEdges = 0,
  activeName,
}) => {
  return (
    <HStack
      as="footer"
      height="24px"
      width="100%"
      bg="slateDark.2"
      borderTopWidth="1px"
      borderColor="slateDark.4"
      px="12px"
      justifyContent="space-between"
      alignItems="center"
      fontSize="11px"
      color="slateDark.10"
      flexShrink={0}
      userSelect="none"
    >
      {/* Left side: Status */}
      <HStack gap="10px">
        <HStack gap="6px">
          <Box color="jadeDark.9">
            <LuCircleCheck size={12} />
          </Box>
          <Text color="slateDark.11">{activeName ? activeName : 'Ready'}</Text>
        </HStack>

        {totalNodes > 0 && (
          <HStack gap="4px" color="slateDark.9">
            <LuNetwork size={11} />
            <Text>{totalNodes} nodes, {totalEdges} edges</Text>
          </HStack>
        )}
      </HStack>

      {/* Center: Engine info */}
      <HStack gap="6px">
        <Box color="amberDark.9">
          <LuBinary size={12} />
        </Box>
        <Text color="slateDark.9">Engine: Tree-Sitter (purego dynamic)</Text>
      </HStack>

      {/* Right side: Viewport metrics & version */}
      <HStack gap="12px">
        <HStack gap="4px">
          <LuLayers size={11} />
          <Text>Grid Snap: 24px</Text>
        </HStack>
        <Text color="slateDark.8">Knot v0.1.0</Text>
      </HStack>
    </HStack>
  )
}
