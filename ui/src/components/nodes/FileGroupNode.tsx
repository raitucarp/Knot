import React, { memo, useState, useEffect } from 'react'
import { Handle, Position, NodeProps, NodeResizeControl } from '@xyflow/react'
import { Box, HStack, VStack, Text, Badge, IconButton, Input, Button, Portal } from '@chakra-ui/react'
import {
  LuFileCode,
  LuX,
  LuSave,
  LuPlus,
  LuChevronsDownUp,
  LuChevronsUpDown,
  LuSearch,
  LuType,
  LuHash,
  LuToggleLeft,
  LuListFilter,
  LuLayers,
  LuBoxes,
} from 'react-icons/lu'
import { FileGroupNodeData } from '../../types/workspace'

const PROPERTY_TYPES = [
  { type: 'string', label: 'String', desc: 'Text value', icon: LuType, color: '#4ade80' },
  { type: 'number', label: 'Number', desc: 'Numeric value', icon: LuHash, color: '#7dd3fc' },
  { type: 'boolean', label: 'Boolean', desc: 'true / false', icon: LuToggleLeft, color: '#fcd34d' },
  { type: 'array', label: 'Array', desc: 'List of items', icon: LuListFilter, color: '#c084fc' },
  { type: 'object_array', label: 'Array of Objects', desc: 'Structured list', icon: LuLayers, color: '#a5b4fc' },
  { type: 'object', label: 'Object', desc: 'Key-value map', icon: LuBoxes, color: '#fda4af' },
]

export const FileGroupNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const groupData = data as unknown as FileGroupNodeData

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(groupData.fileName)
  const isDirty = editTitle.trim() !== '' && editTitle.trim() !== groupData.fileName

  const [isAllCollapsed, setIsAllCollapsed] = useState(Boolean(groupData.isAllCollapsed))
  const [searchQuery, setSearchQuery] = useState(groupData.searchQuery || '')
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  useEffect(() => {
    if (groupData.searchQuery !== undefined) {
      setSearchQuery(groupData.searchQuery)
    }
  }, [groupData.searchQuery])

  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    groupData.onFilterSearch?.(groupData.filePath, val)
  }

  const handleSaveTitle = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === groupData.fileName) {
      setIsEditingTitle(false)
      return
    }
    if (groupData.onRenameFile) {
      await groupData.onRenameFile(groupData.filePath, trimmed)
    }
    setIsEditingTitle(false)
  }

  const handleToggleCollapseAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !isAllCollapsed
    setIsAllCollapsed(next)
    groupData.onToggleCollapseAll?.(groupData.filePath, next)
  }

  const [contextMenu, setContextMenu] = useState<{ clientX: number; clientY: number } | null>(null)

  useEffect(() => {
    if (!contextMenu) return

    const handlePointerDown = (e: MouseEvent) => {
      const menuEl = document.getElementById(`group-context-menu-${groupData.filePath}`)
      if (menuEl && menuEl.contains(e.target as Node)) {
        return
      }
      setContextMenu(null)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [contextMenu, groupData.filePath])

  const handleSelectType = (pType: string) => {
    if (contextMenu) {
      groupData.onAddProperty?.(groupData.filePath, { clientX: contextMenu.clientX, clientY: contextMenu.clientY }, pType)
    }
    setContextMenu(null)
  }

  return (
    <Box
      width="100%"
      height="100%"
      bg="rgba(10, 26, 20, 0.92)"
      backdropFilter="blur(16px)"
      borderColor={selected ? '#10b981' : 'rgba(16, 185, 129, 0.5)'}
      borderWidth="1.5px"
      borderStyle="dashed"
      borderRadius="xl"
      boxShadow="0 24px 60px rgba(0, 0, 0, 0.8), inset 0 0 24px rgba(16, 185, 129, 0.05)"
      position="relative"
      pointerEvents="all"
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ clientX: e.clientX, clientY: e.clientY })
      }}
    >
      {/* Node Resize Controls anchoring top-left so header, sockets, and child coordinates never invert or displace */}
      {Boolean(selected) && (
        <>
          <NodeResizeControl
            position="bottom-right"
            minWidth={groupData.minWidth || 700}
            minHeight={groupData.minHeight || 220}
            className="nodrag"
            style={{
              background: '#10b981',
              border: '2px solid #064e3b',
              borderRadius: '4px',
              width: '12px',
              height: '12px',
              position: 'absolute',
              right: -6,
              bottom: -6,
              cursor: 'nwse-resize',
              zIndex: 10,
            }}
          />
          <NodeResizeControl
            position="right"
            minWidth={groupData.minWidth || 700}
            minHeight={groupData.minHeight || 220}
            className="nodrag"
            style={{
              background: '#10b981',
              border: '1px solid #064e3b',
              borderRadius: '2px',
              width: '6px',
              height: '32px',
              position: 'absolute',
              right: -3,
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'ew-resize',
              zIndex: 10,
            }}
          />
          <NodeResizeControl
            position="bottom"
            minWidth={groupData.minWidth || 700}
            minHeight={groupData.minHeight || 220}
            className="nodrag"
            style={{
              background: '#10b981',
              border: '1px solid #064e3b',
              borderRadius: '2px',
              width: '32px',
              height: '6px',
              position: 'absolute',
              bottom: -3,
              left: '50%',
              transform: 'translateX(-50%)',
              cursor: 'ns-resize',
              zIndex: 10,
            }}
          />
        </>
      )}

      {/* Target handle on the left where the single edge from the file connects */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          background: '#10b981',
          width: 10,
          height: 10,
          border: '2px solid #111113',
          borderRadius: '50%',
          left: -6,
          boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)',
        }}
      />

      {/* Blender Frame Header */}
      <HStack
        bg="linear-gradient(90deg, rgba(6, 78, 59, 0.95), rgba(4, 47, 46, 0.95))"
        px="14px"
        py="8px"
        borderTopRadius="xl"
        borderBottom="1px solid rgba(16, 185, 129, 0.35)"
        justifyContent="space-between"
        alignItems="center"
      >
        <HStack gap="8px" minWidth="0" flex="1">
          {/* Floppy disk icon replacement when dirty */}
          {isDirty ? (
            <IconButton
              aria-label="Save file rename"
              size="2xs"
              variant="ghost"
              height="20px"
              width="20px"
              minW="20px"
              p="0"
              color="#fbbf24"
              _hover={{ color: '#f59e0b', transform: 'scale(1.15)' }}
              onClick={(e) => {
                e.stopPropagation()
                handleSaveTitle()
              }}
              className="nodrag"
              title="Click floppy disk to save rename (or press Enter)"
            >
              <LuSave size={16} />
            </IconButton>
          ) : (
            <Box color="#34d399" flexShrink={0}>
              <LuFileCode size={16} />
            </Box>
          )}

          {isEditingTitle ? (
            <Input
              size="2xs"
              height="20px"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSaveTitle()
                } else if (e.key === 'Escape') {
                  setEditTitle(groupData.fileName)
                  setIsEditingTitle(false)
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
              fontWeight="bold"
              className="nodrag"
              _focus={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              _hover={{ border: 'none' }}
            />
          ) : (
            <Text
              fontSize="12px"
              fontWeight="bold"
              color="white"
              letterSpacing="0.02em"
              cursor="text"
              onClick={(e) => {
                e.stopPropagation()
                setIsEditingTitle(true)
              }}
              title={`${groupData.fileName} (Click to rename)`}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {groupData.fileName}
            </Text>
          )}

          <Badge
            size="xs"
            variant="solid"
            bg="rgba(16, 185, 129, 0.3)"
            color="#a7f3d0"
            border="1px solid rgba(52, 211, 153, 0.4)"
            fontSize="9px"
            px="5px"
            flexShrink={0}
          >
            {groupData.language.toUpperCase()} CONTAINER
          </Badge>

          {groupData.schemaName && (
            <Badge
              size="xs"
              variant="solid"
              bg="rgba(14, 165, 233, 0.25)"
              color="#7dd3fc"
              border="1px solid rgba(56, 189, 248, 0.4)"
              fontSize="9px"
              px="5px"
              flexShrink={0}
              title={groupData.description || groupData.schemaName}
            >
              {groupData.schemaName}
            </Badge>
          )}
        </HStack>

        <HStack gap="6px" flexShrink={0}>
          {/* Search filter input */}
          <HStack
            bg="rgba(0, 0, 0, 0.4)"
            border="1px solid"
            borderColor={searchQuery ? 'rgba(52, 211, 153, 0.7)' : 'rgba(255, 255, 255, 0.15)'}
            borderRadius="md"
            px="6px"
            py="1px"
            height="22px"
            gap="4px"
            className="nodrag"
            _focusWithin={{
              borderColor: '#34d399',
              bg: 'rgba(0, 0, 0, 0.65)',
              boxShadow: '0 0 8px rgba(52, 211, 153, 0.35)',
            }}
          >
            <Box color={searchQuery ? '#34d399' : 'rgba(255, 255, 255, 0.4)'} flexShrink={0}>
              <LuSearch size={11} />
            </Box>
            <Input
              size="2xs"
              height="18px"
              width={isSearchFocused || searchQuery ? '120px' : '85px'}
              transition="all 0.2s ease"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') {
                  handleSearchChange('')
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Filter key/val..."
              bg="transparent"
              border="none"
              outline="none"
              boxShadow="none"
              p="0"
              color="white"
              fontSize="10px"
              _focus={{ outline: 'none', border: 'none', boxShadow: 'none' }}
              _placeholder={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '10px' }}
            />
            {searchQuery && (
              <IconButton
                aria-label="Clear search"
                size="2xs"
                variant="ghost"
                height="16px"
                width="16px"
                minW="16px"
                p="0"
                color="rgba(255, 255, 255, 0.6)"
                _hover={{ color: 'white', bg: 'rgba(255, 255, 255, 0.15)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleSearchChange('')
                }}
              >
                <LuX size={10} />
              </IconButton>
            )}
          </HStack>

          {groupData.itemCount > 0 && (
            <Badge
              size="xs"
              variant="subtle"
              bg={
                groupData.matchCount !== undefined
                  ? groupData.matchCount === 0
                    ? 'rgba(239, 68, 68, 0.25)'
                    : 'rgba(16, 185, 129, 0.25)'
                  : 'rgba(0, 0, 0, 0.4)'
              }
              color={
                groupData.matchCount !== undefined
                  ? groupData.matchCount === 0
                    ? '#fca5a5'
                    : '#6ee7b7'
                  : '#d1fae5'
              }
              borderRadius="full"
              px="6px"
              fontSize="9px"
              title={
                groupData.matchCount !== undefined
                  ? `${groupData.matchCount} matching nodes found`
                  : `${groupData.itemCount} properties in this file`
              }
            >
              {groupData.matchCount !== undefined
                ? `${groupData.matchCount} / ${groupData.itemCount}`
                : `${groupData.itemCount} properties`}
            </Badge>
          )}

          {/* Add Key Button */}
          {groupData.onAddProperty && (
            <Button
              size="2xs"
              height="20px"
              variant="solid"
              bg="rgba(16, 185, 129, 0.25)"
              color="#a7f3d0"
              border="1px solid rgba(52, 211, 153, 0.35)"
              _hover={{ bg: 'rgba(16, 185, 129, 0.45)' }}
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setContextMenu({ clientX: rect.left, clientY: rect.bottom + 4 })
              }}
              className="nodrag"
              fontSize="10px"
              title="Add new key to JSON"
            >
              <LuPlus size={11} style={{ marginRight: 2 }} /> Key
            </Button>
          )}

          {/* Collapse All / Expand All Button */}
          {groupData.onToggleCollapseAll && (
            <IconButton
              aria-label={isAllCollapsed ? 'Expand all properties' : 'Collapse all properties'}
              size="2xs"
              variant="ghost"
              height="20px"
              width="20px"
              minW="20px"
              p="0"
              color="#a7f3d0"
              _hover={{ bg: 'rgba(0,0,0,0.3)', color: 'white' }}
              onClick={handleToggleCollapseAll}
              className="nodrag"
              title={isAllCollapsed ? 'Expand all properties' : 'Collapse all properties (keys only)'}
            >
              {isAllCollapsed ? <LuChevronsUpDown size={13} /> : <LuChevronsDownUp size={13} />}
            </IconButton>
          )}

          {groupData.onClose && (
            <IconButton
              aria-label="Close group"
              size="2xs"
              variant="ghost"
              height="20px"
              width="20px"
              minW="20px"
              p="0"
              color="#a7f3d0"
              _hover={{ color: '#f87171', bg: 'rgba(0,0,0,0.3)' }}
              onClick={(e) => {
                e.stopPropagation()
                groupData.onClose?.(groupData.filePath)
              }}
              className="nodrag"
            >
              <LuX size={13} />
            </IconButton>
          )}
        </HStack>
      </HStack>

      {groupData.description && (
        <Box
          px="14px"
          py="4px"
          bg="rgba(4, 47, 46, 0.6)"
          borderBottom="1px solid rgba(16, 185, 129, 0.2)"
        >
          <Text
            fontSize="10.5px"
            color="#a7f3d0"
            fontStyle="italic"
            lineHeight="1.3"
            title={groupData.description}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {groupData.description}
          </Text>
        </Box>
      )}

      {/* Right-click Type Selection Context Menu */}
      {contextMenu && (
        <Portal>
          <Box
            id={`group-context-menu-${groupData.filePath}`}
            position="fixed"
            left={`${Math.min(contextMenu.clientX, window.innerWidth - 210)}px`}
            top={`${Math.min(contextMenu.clientY, window.innerHeight - 260)}px`}
            zIndex={999999}
            bg="#0c1916"
            borderColor="rgba(16, 185, 129, 0.45)"
            borderWidth="1px"
            borderRadius="md"
            boxShadow="0 12px 32px rgba(0, 0, 0, 0.85), 0 0 1px rgba(16, 185, 129, 0.6)"
            p="6px"
            minW="195px"
            pointerEvents="all"
            className="nodrag"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <Box px="8px" py="4px" mb="4px" borderBottom="1px solid rgba(16, 185, 129, 0.2)">
              <Text fontSize="10px" fontWeight="bold" textTransform="uppercase" letterSpacing="0.06em" color="#6ee7b7">
                Add Property
              </Text>
            </Box>
            <VStack align="stretch" gap="2px">
              {PROPERTY_TYPES.map((pt) => {
                const IconComp = pt.icon
                return (
                  <HStack
                    key={pt.type}
                    as="button"
                    px="8px"
                    py="5px"
                    borderRadius="sm"
                    cursor="pointer"
                    transition="all 0.15s ease"
                    _hover={{ bg: 'rgba(16, 185, 129, 0.2)', transform: 'translateX(2px)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectType(pt.type)
                    }}
                    gap="8px"
                    textAlign="left"
                    width="100%"
                  >
                    <Box
                      color={pt.color}
                      bg="rgba(0, 0, 0, 0.45)"
                      p="4px"
                      borderRadius="sm"
                      border={`1px solid ${pt.color}33`}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <IconComp size={13} />
                    </Box>
                    <VStack align="start" gap="0" flex="1" minW="0">
                      <Text fontSize="11px" fontWeight="semibold" color="white" lineHeight="1.2">
                        {pt.label}
                      </Text>
                      <Text fontSize="9px" color="rgba(255, 255, 255, 0.5)" lineHeight="1.2">
                        {pt.desc}
                      </Text>
                    </VStack>
                  </HStack>
                )
              })}
            </VStack>
          </Box>
        </Portal>
      )}
    </Box>
  )
})

FileGroupNode.displayName = 'FileGroupNode'
