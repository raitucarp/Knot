import React, { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Box, HStack, Text, Badge, Input, IconButton } from '@chakra-ui/react'
import {
  LuFile,
  LuFileCode,
  LuFileText,
  LuFileImage,
  LuFileSpreadsheet,
  LuSave,
} from 'react-icons/lu'
import { FileNodeData } from '../../types/workspace'

const formatSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getFileMeta = (ext: string) => {
  switch (ext.toLowerCase()) {
    case '.go':
      return { icon: <LuFileCode size={15} />, color: '#00add8', label: 'GO' }
    case '.ts':
    case '.tsx':
      return { icon: <LuFileCode size={15} />, color: '#3178c6', label: 'TS' }
    case '.js':
    case '.jsx':
      return { icon: <LuFileCode size={15} />, color: '#f7df1e', label: 'JS' }
    case '.json':
      return { icon: <LuFileSpreadsheet size={15} />, color: '#46a758', label: 'JSON' }
    case '.md':
    case '.txt':
      return { icon: <LuFileText size={15} />, color: '#ab4aba', label: 'DOC' }
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.svg':
    case '.ico':
      return { icon: <LuFileImage size={15} />, color: '#e5484d', label: 'IMG' }
    case '.yaml':
    case '.yml':
    case '.toml':
      return { icon: <LuFileCode size={15} />, color: '#f76b15', label: 'CFG' }
    default:
      return { icon: <LuFile size={15} />, color: '#889096', label: ext.replace('.', '').toUpperCase() || 'FILE' }
  }
}

export const FileNode: React.FC<NodeProps> = memo(({ id, data, selected }) => {
  const nodeData = data as unknown as FileNodeData
  const meta = getFileMeta(nodeData.extension || '')
  const pointerDownPos = useRef({ x: 0, y: 0 })
  const isExpanded = nodeData.isExpanded
  const isLoading = nodeData.isLoadingAST

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

    if (nodeData.onToggleAST) {
      nodeData.onToggleAST(id, nodeData.path)
    } else if (nodeData.onSelect) {
      nodeData.onSelect(nodeData.path)
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
      borderColor={selected ? 'cyanDark.9' : isExpanded ? meta.color : 'slateDark.6'}
      borderWidth="1px"
      borderLeftWidth="3px"
      borderLeftColor={meta.color}
      borderRadius="md"
      px="10px"
      py="5px"
      boxShadow={isExpanded ? `0 4px 14px ${meta.color}22` : '0 2px 8px rgba(0, 0, 0, 0.3)'}
      cursor={isEditing ? 'default' : 'pointer'}
      transition="all 0.15s ease"
      position="relative"
      _hover={{
        bg: 'slateDark.4',
        borderColor: meta.color,
        transform: isEditing ? 'none' : 'translateY(-1px)',
      }}
    >
      {/* Target handle from parent on the left */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          background: meta.color,
          width: 7,
          height: 7,
          border: '2px solid #111113',
          left: -4,
        }}
      />

      <HStack justifyContent="space-between" alignItems="center">
        <HStack gap="6px" minWidth="0" flex="1">
          {isDirty ? (
            <IconButton
              aria-label="Save file rename"
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
            <Box color={meta.color} flexShrink={0}>
              {meta.icon}
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
              fontWeight={isExpanded ? 'semibold' : 'normal'}
              className="nodrag"
              _focus={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              _hover={{ border: 'none' }}
            />
          ) : (
            <Text
              fontSize="12px"
              fontWeight={isExpanded ? 'semibold' : 'normal'}
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
          {isLoading ? (
            <Text fontSize="10px" color="amberDark.9">
              Parsing...
            </Text>
          ) : (
            <Text fontSize="10px" color="slateDark.10" fontFamily="mono">
              {formatSize(nodeData.size)}
            </Text>
          )}
          <Badge
            size="xs"
            variant={isExpanded ? 'solid' : 'outline'}
            style={
              isExpanded
                ? { backgroundColor: meta.color, color: '#111113' }
                : { borderColor: meta.color, color: meta.color }
            }
            borderRadius="xs"
            px="3px"
            fontSize="9px"
            fontWeight="bold"
          >
            {meta.label}
          </Badge>
        </HStack>
      </HStack>

      {/* Source handle to AST nodes on the right */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          background: meta.color,
          width: 7,
          height: 7,
          border: '2px solid #111113',
          right: -4,
        }}
      />
    </Box>
  )
})

FileNode.displayName = 'FileNode'
