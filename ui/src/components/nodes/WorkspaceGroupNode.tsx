import React, { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { Box, HStack, Text, Badge, IconButton } from '@chakra-ui/react'
import { LuLayers, LuX } from 'react-icons/lu'
import { WorkspaceGroupData } from '../../types/workspace'

export const WorkspaceGroupNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const groupData = data as unknown as WorkspaceGroupData

  return (
    <Box
      width="250px"
      bg="slateDark.2"
      borderColor={selected ? 'amberDark.9' : 'amberDark.6'}
      borderWidth="1px"
      borderRadius="lg"
      p="10px"
      boxShadow="0 4px 18px rgba(0, 0, 0, 0.45)"
      backdropFilter="blur(8px)"
      position="relative"
    >
      <HStack justifyContent="space-between" alignItems="center" mb="4px">
        <HStack gap="6px" minWidth="0">
          <Box color="amberDark.9">
            <LuLayers size={16} />
          </Box>
          <Text
            fontSize="12px"
            fontWeight="bold"
            color="amberDark.11"
            letterSpacing="0.03em"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {groupData.title}
          </Text>
        </HStack>

        <HStack gap="4px">
          <Badge size="xs" variant="solid" bg="amberDark.9" color="slateDark.1" px="6px">
            Workspace
          </Badge>
          {groupData.onRemove && (
            <IconButton
              aria-label="Remove workspace folder"
              variant="ghost"
              size="2xs"
              onClick={(e) => {
                e.stopPropagation()
                groupData.onRemove?.(groupData.path)
              }}
              color="slateDark.10"
              _hover={{ color: 'redDark.9', bg: 'slateDark.4' }}
            >
              <LuX size={12} />
            </IconButton>
          )}
        </HStack>
      </HStack>

      <Text
        fontSize="10px"
        color="slateDark.10"
        fontFamily="mono"
        title={groupData.path}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {groupData.path}
      </Text>
    </Box>
  )
})

WorkspaceGroupNode.displayName = 'WorkspaceGroupNode'
