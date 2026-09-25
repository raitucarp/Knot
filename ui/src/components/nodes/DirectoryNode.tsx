import React, { memo, useRef, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Box, HStack, Text, Badge, Input, IconButton } from '@chakra-ui/react'
import { LuFolder, LuFolderOpen, LuChevronRight, LuChevronDown, LuSave } from 'react-icons/lu'
import { DirectoryNodeData } from '../../types/workspace'

export const DirectoryNode: React.FC<NodeProps> = memo(({ id, data, selected }) => {
  const nodeData = data as unknown as DirectoryNodeData
  const isExpanded = nodeData.isExpanded
  const pointerDownPos = useRef({ x: 0, y: 0 })

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(nodeData.name)
  const isDirty = editName.trim() !== '' && editName.trim() !== nodeData.name

  useEffect(() => {
    setEditName(nodeData.name)
    setIsEditing(false)
  }, [nodeData.name])

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()
    const dx = Math.abs(e.clientX - pointerDownPos.current.x)
    const dy = Math.abs(e.clientY - pointerDownPos.current.y)
    if (dx > 4 || dy > 4) {
      return
    }

    if (nodeData.onToggle) {
      nodeData.onToggle(id, nodeData.path)
    }
  }

  const handleSaveRename = async () => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === nodeData.name) {
      setIsEditing(false)
      return
    }
    if (nodeData.onRename) {
      await nodeData.onRename(nodeData.path, trimmed)
    }
    setIsEditing(false)
  }

  return (
    <Box
      role="group"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      width="240px"
      bg={isExpanded ? 'slateDark.4' : 'slateDark.3'}
      borderColor={selected ? 'amberDark.9' : isExpanded ? 'amberDark.8' : 'slateDark.6'}
      borderWidth="1px"
      borderLeftWidth="4px"
      borderLeftColor="amberDark.9"
      borderRadius="md"
      px="10px"
      py="5px"
      boxShadow={isExpanded ? '0 4px 16px rgba(245, 158, 11, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.3)'}
      cursor={isEditing ? 'default' : 'pointer'}
      transition="all 0.15s ease"
      position="relative"
      _hover={{
        bg: 'slateDark.4',
        borderColor: 'amberDark.8',
        transform: isEditing ? 'none' : 'translateY(-1px)',
      }}
    >
      {/* Target handle from parent on the left */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          background: '#f59e0b',
          width: 8,
          height: 8,
          border: '2px solid #111113',
          left: -5,
        }}
      />

      <HStack justifyContent="space-between" alignItems="center">
        <HStack gap="6px" minWidth="0" flex="1">
          {isDirty ? (
            <IconButton
              aria-label="Save folder rename"
              size="2xs"
              variant="ghost"
              height="18px"
              width="18px"
              minW="18px"
              p="0"
              color="#fbbf24"
              _hover={{ color: '#f59e0b', transform: 'scale(1.15)' }}
              onClick={(e) => {
                e.stopPropagation()
                handleSaveRename()
              }}
              className="nodrag"
              title="Click floppy disk to save rename (or press Enter)"
            >
              <LuSave size={15} />
            </IconButton>
          ) : (
            <Box color="amberDark.9" flexShrink={0}>
              {isExpanded ? <LuFolderOpen size={16} /> : <LuFolder size={16} />}
            </Box>
          )}

          {isEditing ? (
            <Input
              size="2xs"
              height="20px"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveRename()
                } else if (e.key === 'Escape') {
                  setEditName(nodeData.name)
                  setIsEditing(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              bg="transparent"
              border="none"
              outline="none"
              boxShadow="none"
              p="0"
              color="white"
              fontSize="12px"
              fontWeight="medium"
              className="nodrag"
              _focus={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              _hover={{ border: 'none' }}
            />
          ) : (
            <Text
              fontSize="12px"
              fontWeight="medium"
              color="slateDark.12"
              title={`${nodeData.path} (Click to rename)`}
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
              }}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'text',
              }}
            >
              {nodeData.name}
            </Text>
          )}
        </HStack>

        <HStack gap="4px" flexShrink={0}>
          {nodeData.childrenCount > 0 && (
            <Badge
              size="xs"
              variant="subtle"
              bg="slateDark.5"
              color="slateDark.11"
              borderRadius="full"
              px="5px"
              fontSize="10px"
            >
              {nodeData.childrenCount}
            </Badge>
          )}
          <Box color="slateDark.10">
            {isExpanded ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
          </Box>
        </HStack>
      </HStack>

      {/* Source handle to child nodes on the right */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          background: '#f59e0b',
          width: 8,
          height: 8,
          border: '2px solid #111113',
          right: -5,
        }}
      />
    </Box>
  )
})

DirectoryNode.displayName = 'DirectoryNode'
