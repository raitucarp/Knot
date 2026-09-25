import React, { memo, useRef } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Box, HStack, Text, Badge, IconButton } from '@chakra-ui/react'
import { LuFolderOpen, LuFolderSync, LuX } from 'react-icons/lu'
import { RootFolderNodeData } from '../../types/workspace'

export const RootFolderNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as unknown as RootFolderNodeData
  const pointerDownPos = useRef({ x: 0, y: 0 })

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // If user dragged the node, don't trigger directory picker
    const dx = Math.abs(e.clientX - pointerDownPos.current.x)
    const dy = Math.abs(e.clientY - pointerDownPos.current.y)
    if (dx > 4 || dy > 4) {
      return
    }

    if (nodeData.onOpenDirectory) {
      nodeData.onOpenDirectory()
    }
  }

  return (
    <Box
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      minWidth="280px"
      width="max-content"
      maxWidth="85vw"
      bg="slateDark.2"
      borderColor={selected ? 'amberDark.9' : 'amberDark.7'}
      borderWidth="1.5px"
      borderRadius="lg"
      px="14px"
      py="8px"
      boxShadow="0 4px 18px rgba(0, 0, 0, 0.45)"
      backdropFilter="blur(8px)"
      cursor="pointer"
      transition="all 0.15s ease"
      position="relative"
      title="Click to change directory"
      _hover={{
        bg: 'slateDark.3',
        borderColor: 'amberDark.9',
        transform: 'translateY(-1px)',
        boxShadow: '0 6px 20px rgba(245, 158, 11, 0.2)',
      }}
    >
      {/* Top Header Row */}
      <HStack justifyContent="space-between" alignItems="center" mb="5px">
        <HStack gap="7px" minWidth="0" flex="1">
          <Box color="amberDark.9" flexShrink={0}>
            <LuFolderOpen size={17} />
          </Box>
          <Text
            fontSize="12px"
            fontWeight="bold"
            color="amberDark.11"
            letterSpacing="0.02em"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nodeData.title}
          </Text>
        </HStack>

        <HStack gap="5px" flexShrink={0}>
          {nodeData.itemCount !== undefined && (
            <Badge
              size="xs"
              variant="subtle"
              bg="slateDark.5"
              color="slateDark.11"
              borderRadius="full"
              px="5px"
              fontSize="10px"
            >
              {nodeData.itemCount} {nodeData.itemCount === 1 ? 'item' : 'items'}
            </Badge>
          )}

          <Badge
            size="xs"
            variant="solid"
            bg="amberDark.9"
            color="slateDark.1"
            px="5px"
            fontSize="10px"
            fontWeight="bold"
          >
            {nodeData.isWorkspace ? 'Workspace' : 'Root'}
          </Badge>

          {nodeData.onRemove && (
            <IconButton
              aria-label="Remove workspace folder"
              variant="ghost"
              size="2xs"
              onClick={(e) => {
                e.stopPropagation()
                nodeData.onRemove?.(nodeData.path)
              }}
              color="slateDark.10"
              _hover={{ color: 'redDark.9', bg: 'slateDark.4' }}
            >
              <LuX size={12} />
            </IconButton>
          )}

          <Box color="amberDark.9" opacity={0.7} title="Click to change directory">
            <LuFolderSync size={13} />
          </Box>
        </HStack>
      </HStack>

      {/* Full Path Row */}
      <Text
        fontSize="11px"
        color="slateDark.11"
        fontFamily="mono"
        title={nodeData.path}
        style={{
          whiteSpace: 'nowrap',
          display: 'block',
        }}
      >
        {nodeData.path}
      </Text>

      {/* Output handle dot on bottom border, aligned with left branch column */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        style={{
          background: '#f59e0b',
          width: 9,
          height: 9,
          border: '2px solid #111113',
          borderRadius: '50%',
          bottom: -5,
          left: 20,
          boxShadow: '0 0 6px rgba(245, 158, 11, 0.7)',
        }}
      />
    </Box>
  )
})

RootFolderNode.displayName = 'RootFolderNode'
