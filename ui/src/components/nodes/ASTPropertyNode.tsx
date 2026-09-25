import React, { memo, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Box, HStack, VStack, Text, Input, Textarea, IconButton, Button, Badge } from '@chakra-ui/react'
import {
  LuType,
  LuHash,
  LuToggleLeft,
  LuListFilter,
  LuBoxes,
  LuLayers,
  LuBinary,
  LuCheck,
  LuLoader,
  LuPlus,
  LuX,
  LuSave,
  LuChevronDown,
  LuChevronRight,
  LuTrash2,
} from 'react-icons/lu'
import { ASTPropertyNodeData } from '../../types/workspace'
import { MarkdownDescription } from '../MarkdownDescription'

interface TypeTheme {
  label: string
  headerBg: string
  borderColor: string
  accentColor: string
  icon: React.ReactNode
}

const getTypeTheme = (type: string): TypeTheme => {
  switch (type) {
    case 'string':
      return {
        label: 'STRING',
        headerBg: '#15803d', // Blender Geometry Green
        borderColor: '#22c55e',
        accentColor: '#4ade80',
        icon: <LuType size={13} />,
      }
    case 'number':
      return {
        label: 'NUMBER',
        headerBg: '#0369a1', // Blender Vector Blue
        borderColor: '#38bdf8',
        accentColor: '#7dd3fc',
        icon: <LuHash size={13} />,
      }
    case 'boolean':
      return {
        label: 'BOOLEAN',
        headerBg: '#b45309', // Blender Amber/Orange
        borderColor: '#f59e0b',
        accentColor: '#fcd34d',
        icon: <LuToggleLeft size={13} />,
      }
    case 'string_array':
    case 'array':
      return {
        label: 'ARRAY',
        headerBg: '#6d28d9', // Blender Curve Purple
        borderColor: '#a855f7',
        accentColor: '#c084fc',
        icon: <LuListFilter size={13} />,
      }
    case 'object_array':
      return {
        label: 'ARRAY [OBJ]',
        headerBg: '#4f46e5', // Indigo
        borderColor: '#818cf8',
        accentColor: '#a5b4fc',
        icon: <LuLayers size={13} />,
      }
    case 'object':
      return {
        label: 'OBJECT',
        headerBg: '#be123c', // Blender Material Ruby/Rose
        borderColor: '#fb7185',
        accentColor: '#fda4af',
        icon: <LuBoxes size={13} />,
      }
    default:
      return {
        label: 'ANY',
        headerBg: '#334155', // Slate
        borderColor: '#64748b',
        accentColor: '#94a3b8',
        icon: <LuBinary size={13} />,
      }
  }
}

export const ASTPropertyNode: React.FC<NodeProps> = memo(({ id, data, selected }) => {
  const nodeData = data as unknown as ASTPropertyNodeData
  const theme = getTypeTheme(nodeData.type)

  // Local state for key editing (variable title)
  const [keyName, setKeyName] = useState(nodeData.key)
  const [isKeyDirty, setIsKeyDirty] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(Boolean(nodeData.isCollapsed))

  useEffect(() => {
    if (nodeData.isCollapsed !== undefined) {
      setIsCollapsed(nodeData.isCollapsed)
    }
  }, [nodeData.isCollapsed])

  // Type dropdown state
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const typeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false)
      }
    }
    if (showTypeMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTypeMenu])

  const typeOptions = [
    { type: 'string', label: 'String', icon: <LuType size={12} />, color: '#4ade80' },
    { type: 'number', label: 'Number', icon: <LuHash size={12} />, color: '#7dd3fc' },
    { type: 'boolean', label: 'Boolean', icon: <LuToggleLeft size={12} />, color: '#fcd34d' },
    { type: 'array', label: 'Array (Values)', icon: <LuListFilter size={12} />, color: '#c084fc' },
    { type: 'object_array', label: 'Array of Objects', icon: <LuLayers size={12} />, color: '#a5b4fc' },
    { type: 'object', label: 'Object', icon: <LuBoxes size={12} />, color: '#fda4af' },
  ]

  // Local state for value editing
  const [localVal, setLocalVal] = useState<any>(nodeData.value)
  const [newTagInput, setNewTagInput] = useState('')

  useEffect(() => {
    setKeyName(nodeData.key)
    setIsKeyDirty(false)
  }, [nodeData.key])

  useEffect(() => {
    setLocalVal(nodeData.value)
  }, [nodeData.value])

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setKeyName(val)
    setIsKeyDirty(val.trim() !== nodeData.key)
  }

  const handleSaveKey = () => {
    const trimmed = keyName.trim()
    if (trimmed && trimmed !== nodeData.key && nodeData.onRenameKey) {
      nodeData.onRenameKey(nodeData.key, trimmed)
      setIsKeyDirty(false)
    }
  }

  const handleValueChange = (newVal: any) => {
    setLocalVal(newVal)
    nodeData.onChange?.(nodeData.key, newVal)
  }

  const handleAddTag = () => {
    const trimmed = newTagInput.trim()
    if (!trimmed) return

    let parsedVal: any = trimmed
    if (trimmed.toLowerCase() === 'true') {
      parsedVal = true
    } else if (trimmed.toLowerCase() === 'false') {
      parsedVal = false
    } else if (!isNaN(Number(trimmed)) && !trimmed.startsWith('0x')) {
      parsedVal = Number(trimmed)
    }

    const currentList: any[] = Array.isArray(localVal) ? [...localVal] : []
    currentList.push(parsedVal)
    handleValueChange(currentList)
    setNewTagInput('')
  }

  const handleRemoveTag = (indexToRemove: number) => {
    const currentList: any[] = Array.isArray(localVal) ? [...localVal] : []
    currentList.splice(indexToRemove, 1)
    handleValueChange(currentList)
  }

  const isDescriptionOrLong =
    nodeData.type === 'string' &&
    (nodeData.key.toLowerCase().includes('description') ||
      nodeData.isLongText ||
      (typeof localVal === 'string' && (localVal.length > 50 || localVal.includes('\n'))))

  return (
    <Box
      width={isCollapsed ? '240px' : isDescriptionOrLong ? '300px' : (nodeData.type === 'string_array' || nodeData.type === 'array') ? '280px' : (nodeData.description && String(nodeData.description).length > 100) ? '280px' : '260px'}
      bg="#18191c"
      borderColor={
        nodeData.isSearchMatch
          ? '#38bdf8'
          : selected
          ? theme.borderColor
          : 'rgba(255, 255, 255, 0.12)'
      }
      borderWidth={nodeData.isSearchMatch ? '2px' : '1px'}
      borderRadius="md"
      boxShadow={
        nodeData.isSearchMatch
          ? '0 0 16px rgba(56, 189, 248, 0.45), 0 8px 24px rgba(0, 0, 0, 0.55)'
          : '0 8px 24px rgba(0, 0, 0, 0.55)'
      }
      transition="all 0.15s ease"
      position="relative"
    >
      {/* Target input handle (only if child of an object) */}
      {Boolean(nodeData.hasInputSocket && nodeData.parentKeyPath && nodeData.parentKeyPath.length > 0) && (
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          style={{
            background: theme.borderColor,
            width: 8,
            height: 8,
            border: '2px solid #111113',
            borderRadius: '50%',
            left: -5,
            top: 15,
          }}
        />
      )}

      {/* 1. Blender-Style Title Bar Header Banner */}
      <HStack
        bg={theme.headerBg}
        px="7px"
        py="3px"
        borderTopRadius="md"
        borderBottomRadius={isCollapsed ? 'md' : 'none'}
        justifyContent="space-between"
        alignItems="center"
        borderBottom={isCollapsed ? 'none' : '1px solid rgba(0,0,0,0.3)'}
      >
        <HStack gap="6px" minWidth="0" flex="1">
          {/* Type Icon with click-to-change Dropdown */}
          <Box position="relative" ref={typeMenuRef}>
            <Box
              color={theme.accentColor}
              flexShrink={0}
              cursor="pointer"
              p="2px"
              borderRadius="xs"
              _hover={{ bg: 'rgba(255, 255, 255, 0.2)' }}
              onClick={(e) => {
                e.stopPropagation()
                setShowTypeMenu(!showTypeMenu)
              }}
              title="Click to change data type"
            >
              {theme.icon}
            </Box>

            {showTypeMenu && (
              <Box
                position="absolute"
                top="24px"
                left="0"
                bg="#1a1c23"
                border="1px solid rgba(255, 255, 255, 0.15)"
                borderRadius="md"
                boxShadow="0 8px 24px rgba(0,0,0,0.85)"
                py="4px"
                minW="120px"
                zIndex={9999}
                className="nodrag"
              >
                {typeOptions.map((opt) => (
                  <HStack
                    key={opt.type}
                    px="8px"
                    py="4px"
                    gap="6px"
                    cursor="pointer"
                    bg={nodeData.type === opt.type ? 'rgba(255,255,255,0.1)' : 'transparent'}
                    _hover={{ bg: 'rgba(255,255,255,0.15)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowTypeMenu(false)
                      if (opt.type !== nodeData.type && nodeData.onChangeType) {
                        nodeData.onChangeType(nodeData.type, opt.type)
                      }
                    }}
                  >
                    <Box color={opt.color}>{opt.icon}</Box>
                    <Text fontSize="11px" color={opt.color} fontWeight={nodeData.type === opt.type ? 'bold' : 'normal'}>
                      {opt.label}
                    </Text>
                  </HStack>
                ))}
              </Box>
            )}
          </Box>

          {/* Editable Variable Title */}
          <Input
            value={keyName}
            onChange={handleKeyChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSaveKey()
              }
            }}
            size="xs"
            height="20px"
            bg="transparent"
            border="none"
            outline="none"
            boxShadow="none"
            p="0"
            fontSize="12px"
            fontWeight="bold"
            color="white"
            _focus={{
              bg: 'transparent',
              outline: 'none',
              boxShadow: 'none',
              border: 'none',
            }}
            _hover={{
              bg: 'transparent',
              border: 'none',
            }}
            className="nodrag"
            title={nodeData.description ? `${nodeData.key}: ${nodeData.description}` : 'Click or edit variable name'}
          />

          {/* Dirty indicator */}
          {isKeyDirty && (
            <HStack gap="2px" flexShrink={0}>
              <Text color="#fbbf24" fontSize="13px" fontWeight="bold">
                *
              </Text>
              <IconButton
                aria-label="Save variable name"
                size="2xs"
                variant="ghost"
                height="16px"
                width="16px"
                minW="16px"
                color="#fbbf24"
                _hover={{ bg: 'rgba(0,0,0,0.3)' }}
                onClick={handleSaveKey}
                className="nodrag"
                title="Save variable rename"
              >
                <LuSave size={11} />
              </IconButton>
            </HStack>
          )}
        </HStack>

        {/* Status indicator & collapse toggle on the right */}
        <HStack gap="4px" flexShrink={0}>
          {nodeData.saveStatus === 'saving' && (
            <HStack gap="2px" color="#fcd34d" fontSize="10px">
              <LuLoader className="spin" size={10} />
            </HStack>
          )}
          {nodeData.saveStatus === 'saved' && (
            <Box color="#86efac" opacity={0.8} title="Saved">
              <LuCheck size={12} />
            </Box>
          )}

          {/* Collapse / Expand toggle button */}
          <IconButton
            aria-label={isCollapsed ? 'Expand property' : 'Collapse property'}
            size="2xs"
            variant="ghost"
            height="18px"
            width="18px"
            minW="18px"
            p="0"
            color="white"
            opacity={0.8}
            _hover={{ opacity: 1, bg: 'rgba(0, 0, 0, 0.25)' }}
            onClick={(e) => {
              e.stopPropagation()
              const next = !isCollapsed
              setIsCollapsed(next)
              nodeData.onToggleCollapse?.(id, next)
            }}
            className="nodrag"
            title={isCollapsed ? 'Expand value' : 'Collapse to key only'}
          >
            {isCollapsed ? <LuChevronRight size={12} /> : <LuChevronDown size={12} />}
          </IconButton>

          {/* Delete / Remove property button */}
          {nodeData.onRemoveProperty && (
            <IconButton
              aria-label="Remove property"
              size="2xs"
              variant="ghost"
              height="18px"
              width="18px"
              minW="18px"
              p="0"
              color="white"
              opacity={0.6}
              _hover={{ opacity: 1, color: '#f87185', bg: 'rgba(244, 63, 94, 0.25)' }}
              onClick={(e) => {
                e.stopPropagation()
                nodeData.onRemoveProperty?.(nodeData.key, nodeData.parentKeyPath || [])
              }}
              className="nodrag"
              title="Delete property"
            >
              <LuTrash2 size={11} />
            </IconButton>
          )}
        </HStack>
      </HStack>

      {/* 2. Blender-Style Node Body */}
      {!isCollapsed && (
      <Box p="8px 10px" borderBottomRadius="md">
        {/* Description / Long Text */}
        {isDescriptionOrLong && (
          <Textarea
            value={localVal || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            size="xs"
            rows={3}
            bg="#111215"
            borderColor="rgba(255, 255, 255, 0.1)"
            color="slateDark.12"
            fontSize="11px"
            resize="vertical"
            _hover={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
            _focus={{ borderColor: theme.borderColor, outline: 'none' }}
            className="nodrag"
            placeholder="Enter text..."
          />
        )}

        {/* Standard String */}
        {nodeData.type === 'string' && !isDescriptionOrLong && (
          <Input
            value={localVal || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            size="xs"
            bg="#111215"
            borderColor="rgba(255, 255, 255, 0.1)"
            color="slateDark.12"
            fontSize="11px"
            height="24px"
            _hover={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
            _focus={{ borderColor: theme.borderColor, outline: 'none' }}
            className="nodrag"
            placeholder="String value"
          />
        )}

        {/* Number */}
        {nodeData.type === 'number' && (
          <Input
            type="number"
            value={localVal !== undefined ? localVal : ''}
            onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
            size="xs"
            bg="#111215"
            borderColor="rgba(255, 255, 255, 0.1)"
            color="slateDark.12"
            fontSize="11px"
            height="24px"
            _hover={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
            _focus={{ borderColor: theme.borderColor, outline: 'none' }}
            className="nodrag"
          />
        )}

        {/* Boolean Toggle */}
        {nodeData.type === 'boolean' && (
          <HStack gap="8px">
            <Button
              size="xs"
              height="22px"
              variant={localVal ? 'solid' : 'outline'}
              bg={localVal ? '#b45309' : '#111215'}
              color={localVal ? 'white' : 'slateDark.10'}
              borderColor="rgba(255, 255, 255, 0.15)"
              onClick={() => handleValueChange(!localVal)}
              className="nodrag"
              _hover={{ opacity: 0.9 }}
            >
              {localVal ? 'true' : 'false'}
            </Button>
            <Text fontSize="10px" color="slateDark.10">
              Toggle boolean
            </Text>
          </HStack>
        )}

        {/* Array (Values: Strings, Numbers, Booleans) */}
        {(nodeData.type === 'string_array' || nodeData.type === 'array') && (
          <VStack align="stretch" gap="5px">
            <HStack wrap="wrap" gap="4px">
              {(Array.isArray(localVal) ? localVal : []).map((item: any, idx: number) => {
                const isNum = typeof item === 'number'
                const isBool = typeof item === 'boolean'
                const itemBg = isNum
                  ? 'rgba(14, 165, 233, 0.2)'
                  : isBool
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(109, 40, 217, 0.25)'
                const itemBorder = isNum
                  ? 'rgba(56, 189, 248, 0.4)'
                  : isBool
                  ? 'rgba(251, 191, 36, 0.4)'
                  : 'rgba(168, 85, 247, 0.3)'
                const itemColor = isNum ? '#7dd3fc' : isBool ? '#fcd34d' : '#c084fc'

                return (
                  <Badge
                    key={`${String(item)}_${idx}`}
                    size="xs"
                    variant="subtle"
                    bg={itemBg}
                    color={itemColor}
                    border={`1px solid ${itemBorder}`}
                    borderRadius="xs"
                    px="5px"
                    py="1px"
                    fontSize="10px"
                    display="inline-flex"
                    alignItems="center"
                    gap="3px"
                  >
                    <Text fontWeight={isNum || isBool ? 'bold' : 'normal'}>
                      {isBool ? (item ? 'true' : 'false') : String(item)}
                    </Text>
                    <IconButton
                      aria-label={`Remove item ${String(item)}`}
                      variant="ghost"
                      size="2xs"
                      height="12px"
                      width="12px"
                      minW="12px"
                      p="0"
                      color={itemColor}
                      _hover={{ color: '#f87171' }}
                      onClick={() => handleRemoveTag(idx)}
                      className="nodrag"
                    >
                      <LuX size={9} />
                    </IconButton>
                  </Badge>
                )
              })}
              {(!localVal || (Array.isArray(localVal) && localVal.length === 0)) && (
                <Text fontSize="10px" color="slateDark.9" fontStyle="italic">
                  (Empty array)
                </Text>
              )}
            </HStack>

            <HStack gap="4px" mt="2px">
              <Input
                size="2xs"
                placeholder="+ Add item (text, number, boolean)..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                bg="#111215"
                borderColor="rgba(255, 255, 255, 0.1)"
                color="slateDark.12"
                fontSize="10px"
                height="22px"
                className="nodrag"
              />
              <Button
                size="2xs"
                height="22px"
                px="6px"
                variant="solid"
                bg="#6d28d9"
                color="white"
                _hover={{ bg: '#7c3aed' }}
                onClick={handleAddTag}
                className="nodrag"
                title="Add value to array"
              >
                <LuPlus size={11} />
              </Button>
            </HStack>
          </VStack>
        )}

        {/* Array of Objects (Branches to [0], [1]... child nodes to the right) */}
        {nodeData.type === 'object_array' && (
          <HStack justifyContent="space-between" alignItems="center" py="2px">
            <Badge
              size="xs"
              variant="subtle"
              bg="rgba(79, 70, 229, 0.2)"
              color="#a5b4fc"
              borderRadius="xs"
              px="6px"
              py="2px"
              fontSize="10px"
            >
              {Array.isArray(localVal) ? localVal.length : 0} items
            </Badge>
            <Button
              size="2xs"
              height="20px"
              variant="solid"
              bg="rgba(79, 70, 229, 0.4)"
              color="#a5b4fc"
              _hover={{ bg: 'rgba(79, 70, 229, 0.7)' }}
              onClick={(e) => {
                e.stopPropagation()
                nodeData.onAddArrayItem?.(nodeData.key, nodeData.parentKeyPath || [])
              }}
              className="nodrag"
              fontSize="10px"
              title="Add object item to this array"
            >
              <LuPlus size={11} style={{ marginRight: 3 }} /> Add Item
            </Button>
          </HStack>
        )}

        {/* Object (Branches to child nodes to the right) */}
        {nodeData.type === 'object' && (
          <HStack justifyContent="space-between" alignItems="center" py="2px">
            <Badge
              size="xs"
              variant="subtle"
              bg="rgba(190, 18, 60, 0.2)"
              color="#fda4af"
              border="1px solid rgba(251, 113, 133, 0.3)"
              px="6px"
              fontSize="9px"
            >
              {typeof localVal === 'object' && localVal !== null
                ? `${Object.keys(localVal).length} keys`
                : 'Object'}
            </Badge>

            <Button
              size="2xs"
              height="20px"
              variant="solid"
              bg="rgba(190, 18, 60, 0.4)"
              color="#fda4af"
              _hover={{ bg: 'rgba(190, 18, 60, 0.7)' }}
              onClick={(e) => {
                e.stopPropagation()
                nodeData.onAddChildProperty?.(nodeData.key, nodeData.parentKeyPath || [])
              }}
              className="nodrag"
              fontSize="10px"
              title="Add child key to this object"
            >
              <LuPlus size={11} style={{ marginRight: 3 }} /> Add Field
            </Button>
          </HStack>
        )}

        {/* Generic other */}
        {nodeData.type === 'other' && (
          <Box
            bg="#111215"
            p="5px 8px"
            borderRadius="xs"
            borderWidth="1px"
            borderColor="rgba(255, 255, 255, 0.1)"
            fontSize="10px"
            fontFamily="mono"
            color="slateDark.11"
            maxH="60px"
            overflowY="auto"
            whiteSpace="pre-wrap"
          >
            {nodeData.rawText || String(localVal)}
          </Box>
        )}

        {/* Schema Description Hint (with Markdown & Read more) */}
        {Boolean(nodeData.description) && (
          <MarkdownDescription
            content={String(nodeData.description)}
            nodeId={id}
            parentId={(data as any)?.parentId || (nodeData.fileNodeId ? `group_${nodeData.fileNodeId}` : undefined)}
          />
        )}

        {/* Source Code Line Number Hint */}
        <HStack justifyContent="flex-end" pt="4px" mt="2px">
          <Text
            fontSize="9px"
            fontFamily="mono"
            color="rgba(255, 255, 255, 0.35)"
            letterSpacing="0.4px"
            title="Line number in source code"
            userSelect="none"
          >
            {nodeData.startLine
              ? nodeData.endLine && nodeData.endLine > nodeData.startLine
                ? `Line ${nodeData.startLine}–${nodeData.endLine}`
                : `Line ${nodeData.startLine}`
              : 'Line —'}
          </Text>
        </HStack>
      </Box>
      )}

      {/* Source output handle for objects and object arrays to connect to child nodes */}
      {(nodeData.hasOutputSocket || nodeData.type === 'object' || nodeData.type === 'object_array') && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          style={{
            background: theme.borderColor,
            width: 8,
            height: 8,
            border: '2px solid #111113',
            borderRadius: '50%',
            right: -5,
            top: 15,
            boxShadow: `0 0 6px ${theme.borderColor}`,
          }}
        />
      )}
    </Box>
  )
})

ASTPropertyNode.displayName = 'ASTPropertyNode'
