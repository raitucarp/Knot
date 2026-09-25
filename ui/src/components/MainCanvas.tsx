import React, { useCallback, useMemo, useEffect, useRef } from 'react'
import { Box, Text, VStack, Button, HStack } from '@chakra-ui/react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Edge,
  OnNodeDrag,
  NodeChange,
} from '@xyflow/react'
import { LuFolderOpen, LuLayers } from 'react-icons/lu'
import { DirectoryNode } from './nodes/DirectoryNode'
import { FileNode } from './nodes/FileNode'
import { WorkspaceGroupNode } from './nodes/WorkspaceGroupNode'
import { RootFolderNode } from './nodes/RootFolderNode'
import { ASTPropertyNode } from './nodes/ASTPropertyNode'
import { FileGroupNode } from './nodes/FileGroupNode'
import { FileEntry, KnotNode, KnotEdge } from '../types/workspace'
import { ReadDirectory, RenamePath } from '@/lib/github.com/raitucarp/knot/internal/workspace/service'
import { ParseFile, SaveFileContent } from '@/lib/github.com/raitucarp/knot/internal/parser/parserservice'
import { ASTNodeData } from '@/lib/github.com/raitucarp/knot/internal/parser/models'

interface MainCanvasProps {
  currentFolders: string[]
  workspaceName?: string
  onOpenDirectoryPrompt?: () => void
  onOpenWorkspacePrompt?: () => void
  onFileSelect?: (filePath: string) => void
  onStatsChange?: (stats: { totalNodes: number; totalEdges: number }) => void
}

function lookupSchemaProp(props?: Record<string, string>, path?: string): string | undefined {
  if (!props || !path) return undefined
  if (props[path]) return props[path]
  const normalized = path.replace(/\/?\[\d+\]/g, '').replace(/^\/+|\/+$/g, '')
  if (props[normalized]) return props[normalized]
  return undefined
}

function getNodeDimensions(data: any): { width: number; height: number } {
  if (data?.isCollapsed) {
    return { width: 240, height: 32 }
  }

  const isDesc = Boolean(data?.isLongText || (typeof data?.value === 'string' && (data.value.length > 50 || data.value.includes('\n'))))
  const isTagArray = data?.type === 'string_array' || data?.type === 'array'
  const isObj = data?.type === 'object' || data?.type === 'object_array'
  const descText = typeof data?.description === 'string' ? data.description.trim() : ''
  const hasSchemaDesc = Boolean(descText.length > 0)

  let width = 260
  if (isDesc) {
    width = 300
  } else if (isTagArray) {
    width = 280
  } else if (hasSchemaDesc && descText.length > 100) {
    width = 280
  }

  let height = 96
  if (isDesc) {
    height = 140
  } else if (isTagArray) {
    const count = Array.isArray(data?.value) ? data.value.length : 0
    height = count > 2 ? 165 : 135
  } else if (isObj) {
    height = 96
  } else if (data?.type === 'boolean' || data?.type === 'number') {
    height = 96
  }

  if (hasSchemaDesc) {
    const isLong = descText.length > 110 || descText.includes('\n')
    if (isLong) {
      // Default collapsed state renders ~3 lines preview + "Read more..." button
      height += 68
    } else {
      const charsPerLine = Math.floor((width - 24) / 6.2)
      const descLines = Math.max(1, Math.ceil(descText.length / charsPerLine))
      height += descLines * 16 + 12
    }
  }

  return { width, height }
}

interface LayoutNodeItem {
  id: string
  key: string
  data: any
  width: number
  height: number
  children?: LayoutNodeItem[]
}

interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
  containerWidth: number
  containerHeight: number
}

function computeHierarchicalLayout(
  rootItems: LayoutNodeItem[],
  startX: number = 24,
  startY: number = 52,
  verticalGap: number = 20,
  horizontalGap: number = 48,
  maxLeafPerCol: number = 4,
): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>()
  let maxRelX = 500
  let maxRelY = 120

  interface RelativeSubtree {
    item: LayoutNodeItem
    width: number
    height: number
    internalOffsets: Map<string, { dx: number; dy: number }>
  }

  // 1. Recursive helper to measure the relative subtree layout of a node and its descendants
  function measureSubtree(
    item: LayoutNodeItem,
    relX: number,
    relY: number,
    offsets: Map<string, { dx: number; dy: number }>,
  ): { width: number; height: number } {
    offsets.set(item.id, { dx: relX, dy: relY })

    const children = item.children || []
    if (children.length === 0) {
      return { width: item.width, height: item.height }
    }

    const childStartX = relX + item.width + horizontalGap
    const allChildrenAreLeaves = children.every(
      (c) => !c.children || c.children.length === 0,
    )

    if (allChildrenAreLeaves && children.length > 1) {
      // MULTI-COLUMN WRAPPING for leaf children (e.g. compilerOptions, dependencies)
      // Capped at MAX_CHILD_COLS = 3 to prevent excessive horizontal expansion
      const MAX_CHILD_COLS = 3
      const numCols = Math.min(
        MAX_CHILD_COLS,
        Math.max(1, Math.ceil(children.length / maxLeafPerCol)),
      )
      const perCol = Math.max(1, Math.ceil(children.length / numCols))
      const colWidths: number[] = new Array(numCols).fill(0)
      const colHeights: number[] = new Array(numCols).fill(0)

      // Pass 1: measure max width of each column
      children.forEach((child, idx) => {
        const colIdx = Math.min(numCols - 1, Math.floor(idx / perCol))
        colWidths[colIdx] = Math.max(colWidths[colIdx], child.width)
      })

      // Calculate starting X for each column based on measured widths
      const colStartX: number[] = new Array(numCols).fill(childStartX)
      for (let c = 1; c < numCols; c++) {
        colStartX[c] = colStartX[c - 1] + colWidths[c - 1] + horizontalGap
      }

      // Pass 2: assign relative offsets column by column starting at relY
      children.forEach((child, idx) => {
        const colIdx = Math.min(numCols - 1, Math.floor(idx / perCol))
        const childX = colStartX[colIdx]
        const childY = relY + colHeights[colIdx]

        offsets.set(child.id, { dx: childX, dy: childY })
        colHeights[colIdx] += child.height + verticalGap
      })

      const childrenBlockHeight = Math.max(0, ...colHeights) - verticalGap
      let totalChildrenWidth = 0
      colWidths.forEach((w, i) => {
        totalChildrenWidth += w + (i > 0 ? horizontalGap : 0)
      })

      const totalSubtreeWidth = item.width + horizontalGap + totalChildrenWidth
      const totalSubtreeHeight = Math.max(item.height, childrenBlockHeight)

      return { width: totalSubtreeWidth, height: totalSubtreeHeight }
    } else {
      // SINGLE-COLUMN / NESTED SUBTREES
      let curChildY = relY
      let maxChildSubtreeWidth = 0

      children.forEach((child) => {
        const childBox = measureSubtree(child, childStartX, curChildY, offsets)
        maxChildSubtreeWidth = Math.max(maxChildSubtreeWidth, childBox.width)
        curChildY += childBox.height + verticalGap
      })

      const childrenBlockHeight = Math.max(0, curChildY - relY - verticalGap)
      const totalSubtreeWidth = item.width + horizontalGap + maxChildSubtreeWidth
      const totalSubtreeHeight = Math.max(item.height, childrenBlockHeight)

      return { width: totalSubtreeWidth, height: totalSubtreeHeight }
    }
  }

  // 2. Pre-measure all root blocks into self-contained 2D rectangular units
  const rootBlocks: RelativeSubtree[] = rootItems.map((rootItem) => {
    const offsets = new Map<string, { dx: number; dy: number }>()
    const box = measureSubtree(rootItem, 0, 0, offsets)
    return {
      item: rootItem,
      width: box.width,
      height: box.height,
      internalOffsets: offsets,
    }
  })

  // 3. 2D Compactification / Shelf Packing with tolerable max width limit
  // Allows spawning to the side (multiple columns) balanced with spawning downwards
  const TARGET_MAX_WIDTH = 1250

  let curRowX = startX
  let curRowY = startY
  let currentRowHeight = 0
  let isFirstInRow = true

  rootBlocks.forEach((block) => {
    // If not first item in this row, check if placing this block exceeds TARGET_MAX_WIDTH
    if (!isFirstInRow && curRowX + block.width > TARGET_MAX_WIDTH) {
      // Wrap to next row
      curRowX = startX
      curRowY += currentRowHeight + verticalGap
      currentRowHeight = 0
      isFirstInRow = true
    }

    // Assign absolute positions for this block and all its descendants
    block.internalOffsets.forEach((offset, id) => {
      positions.set(id, { x: curRowX + offset.dx, y: curRowY + offset.dy })
    })

    maxRelX = Math.max(maxRelX, curRowX + block.width)
    maxRelY = Math.max(maxRelY, curRowY + block.height)

    currentRowHeight = Math.max(currentRowHeight, block.height)
    curRowX += block.width + horizontalGap
    isFirstInRow = false
  })

  const containerWidth = Math.max(700, maxRelX + 36)
  const containerHeight = Math.max(220, maxRelY + 36)

  return {
    positions,
    containerWidth,
    containerHeight,
  }
}

const CanvasInner: React.FC<MainCanvasProps> = ({
  currentFolders,
  workspaceName,
  onOpenDirectoryPrompt,
  onOpenWorkspacePrompt,
  onFileSelect,
  onStatsChange,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<KnotNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<KnotEdge>([])
  const { fitView, getNode, getNodes, screenToFlowPosition } = useReactFlow()

  // Custom nodes change handler that clamps child nodes within parent fileGroupNode container boundaries
  const handleNodesChange = useCallback(
    (changes: NodeChange<KnotNode>[]) => {
      const clampedChanges = changes.map((change) => {
        if (change.type === 'position' && change.position) {
          const targetNode = nodes.find((n) => n.id === change.id)
          if (targetNode && targetNode.parentId && targetNode.parentId.startsWith('group_')) {
            const parentNode = nodes.find((n) => n.id === targetNode.parentId)
            const isDescBanner = Boolean((parentNode?.data as any)?.description)
            const minY = isDescBanner ? 80 : 52
            const minX = 24

            const clampedX = Math.max(minX, change.position.x)
            const clampedY = Math.max(minY, change.position.y)

            return {
              ...change,
              position: { x: clampedX, y: clampedY },
            }
          }
        }
        return change
      })

      onNodesChange(clampedChanges)
    },
    [nodes, onNodesChange],
  )

  // Register custom node types
  const nodeTypes = useMemo(
    () => ({
      directoryNode: DirectoryNode,
      fileNode: FileNode,
      workspaceGroup: WorkspaceGroupNode,
      rootFolderNode: RootFolderNode,
      fileGroupNode: FileGroupNode,
      astPropertyNode: ASTPropertyNode,
    }),
    [],
  )

  const handleAddArrayItemRef = useRef<any>(null)
  const handleAddChildPropertyRef = useRef<any>(null)

  // Report stats back to parent for status bar
  useEffect(() => {
    onStatsChange?.({ totalNodes: nodes.length, totalEdges: edges.length })
  }, [nodes.length, edges.length, onStatsChange])

  // Helper to recursively collect all descendant node IDs
  const getDescendantIds = useCallback((parentId: string, currentEdges: Edge[]): Set<string> => {
    const descendants = new Set<string>()
    const queue = [parentId]

    while (queue.length > 0) {
      const current = queue.shift()!
      const childEdges = currentEdges.filter((e) => e.source === current)
      for (const edge of childEdges) {
        if (!descendants.has(edge.target)) {
          descendants.add(edge.target)
          queue.push(edge.target)
        }
      }
    }

    return descendants
  }, [])

  const onFileSelectRef = useRef(onFileSelect)
  onFileSelectRef.current = onFileSelect

  const onOpenDirectoryPromptRef = useRef(onOpenDirectoryPrompt)
  onOpenDirectoryPromptRef.current = onOpenDirectoryPrompt

  // Cache for file data objects (used for re-serializing JSON upon edits)
  const fileDataCacheRef = useRef<Map<string, Record<string, any>>>(new Map())
  const saveTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const schemaPropertiesRef = useRef<Map<string, Record<string, string>>>(new Map())
  const schemaInfoRef = useRef<Map<string, { description?: string; schemaName?: string }>>(new Map())

  // Handler for renaming file or folder on disk via backend
  const handleRenameFileOrFolder = useCallback(
    async (oldPath: string, newName: string) => {
      try {
        const separator = oldPath.includes('\\') ? '\\' : '/'
        const pathParts = oldPath.split(/[/\\]/)
        pathParts[pathParts.length - 1] = newName
        const newPath = pathParts.join(separator)

        await RenamePath(oldPath, newPath)

        // Update memory cache key if exists
        if (fileDataCacheRef.current.has(oldPath)) {
          const cached = fileDataCacheRef.current.get(oldPath)
          fileDataCacheRef.current.delete(oldPath)
          fileDataCacheRef.current.set(newPath, cached!)
        }

        // Update node in canvas state
        setNodes((currentNodes) =>
          currentNodes.map((n) => {
            const nodeData = n.data as any
            if (nodeData.path === oldPath) {
              const ext = (newName.match(/\.[^.]+$/) || [''])[0]
              return {
                ...n,
                data: {
                  ...nodeData,
                  name: newName,
                  path: newPath,
                  extension: ext || nodeData.extension,
                },
              }
            }
            if (n.type === 'fileGroupNode' && nodeData.filePath === oldPath) {
              return {
                ...n,
                data: {
                  ...nodeData,
                  fileName: newName,
                  filePath: newPath,
                },
              }
            }
            if (n.type === 'astPropertyNode' && nodeData.filePath === oldPath) {
              return {
                ...n,
                data: {
                  ...nodeData,
                  filePath: newPath,
                },
              }
            }
            return n
          }),
        )
      } catch (err) {
        console.error('Failed to rename path:', err)
      }
    },
    [setNodes],
  )

  // Handler for renaming a variable / key inside JSON AST
  const handleRenameKey = useCallback(
    (filePath: string, nodeId: string, oldKey: string, newKey: string, parentKeyPath: string[] = []) => {
      const currentData = fileDataCacheRef.current.get(filePath) || {}

      let target = currentData
      for (const seg of parentKeyPath) {
        if (target[seg] && typeof target[seg] === 'object') {
          target = target[seg]
        }
      }

      if (target && typeof target === 'object' && oldKey in target) {
        const val = target[oldKey]
        delete target[oldKey]
        target[newKey] = val
      }
      fileDataCacheRef.current.set(filePath, currentData)

      // Debounced save to disk (300ms)
      const existingTimer = saveTimeoutsRef.current.get(filePath)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }
      const timer = setTimeout(async () => {
        try {
          const jsonString = JSON.stringify(currentData, null, 2) + '\n'
          await SaveFileContent(filePath, jsonString)
        } catch (err) {
          console.error(`Failed to auto-save renamed key in ${filePath}:`, err)
        }
      }, 300)
      saveTimeoutsRef.current.set(filePath, timer)

      // Update schema description if key matches schema
      const pKeyPath = parentKeyPath || []
      const newFullPath = [...pKeyPath, newKey].join('/')
      const fileSchemaProps = schemaPropertiesRef.current.get(filePath)
      const newDesc = lookupSchemaProp(fileSchemaProps, newFullPath)

      // Update node state
      setNodes((currentNodes) =>
        currentNodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                key: newKey,
                description: newDesc !== undefined ? newDesc : (n.data as any).description,
                saveStatus: 'saved',
              },
            }
          }
          return n
        }),
      )
    },
    [setNodes],
  )

  // Helper to re-parse file and dynamically update startLine/endLine and schema descriptions
  const refreshLineNumbers = useCallback(
    async (filePath: string) => {
      try {
        const result = await ParseFile(filePath)
        if (result) {
          if (result.schemaProperties) {
            schemaPropertiesRef.current.set(filePath, result.schemaProperties as Record<string, string>)
          }
          if (result.description || result.schemaName) {
            schemaInfoRef.current.set(filePath, {
              description: result.description,
              schemaName: result.schemaName,
            })
          }
          const lineMap = new Map<string, { startLine: number; endLine: number; description?: string }>()
          const traverse = (nodes: ASTNodeData[], parentPath: string[]) => {
            nodes.forEach((n) => {
              const fullPath = [...parentPath, n.key].join('/')
              lineMap.set(fullPath, { startLine: n.startLine, endLine: n.endLine, description: n.description })
              if (n.children && n.children.length > 0) {
                traverse(n.children, [...parentPath, n.key])
              }
            })
          }
          if (result.nodes) {
            traverse(result.nodes, [])
          }

          setNodes((currentNodes) =>
            currentNodes.map((n) => {
              if (n.type === 'fileGroupNode' && (n.data as any).filePath === filePath) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    description: result.description || (n.data as any).description,
                    schemaName: result.schemaName || (n.data as any).schemaName,
                  },
                }
              }
              if (n.type === 'astPropertyNode' && (n.data as any).filePath === filePath) {
                const pKeyPath = (n.data as any).parentKeyPath || []
                const fullPath = [...pKeyPath, (n.data as any).key].join('/')
                const info = lineMap.get(fullPath)
                if (info) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      startLine: info.startLine,
                      endLine: info.endLine,
                      description: info.description || (n.data as any).description,
                    },
                  }
                }
              }
              return n
            }),
          )
        }
      } catch (err) {
        console.error(`Failed to refresh line numbers and schema for ${filePath}:`, err)
      }
    },
    [setNodes],
  )

  // Auto-save handler for property value changes
  const handleASTPropertyChange = useCallback(
    (filePath: string, nodeId: string, key: string, newValue: any, parentKeyPath: string[] = []) => {
      // 1. Update local node state immediately
      setNodes((currentNodes) =>
        currentNodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                value: newValue,
                saveStatus: 'saving',
              },
            }
          }
          return n
        }),
      )

      // 2. Update cached JSON object
      const currentData = fileDataCacheRef.current.get(filePath) || {}
      if (parentKeyPath && parentKeyPath.length > 0) {
        let target: any = currentData
        for (const seg of parentKeyPath) {
          const isArrIdx = seg.startsWith('[') && seg.endsWith(']')
          const idx = isArrIdx ? parseInt(seg.slice(1, -1), 10) : NaN
          const lookup = !isNaN(idx) ? idx : seg
          if (!target[lookup] || typeof target[lookup] !== 'object') {
            target[lookup] = !isNaN(idx) ? [] : {}
          }
          target = target[lookup]
        }
        const isArrIdx = key.startsWith('[') && key.endsWith(']')
        const idx = isArrIdx ? parseInt(key.slice(1, -1), 10) : NaN
        if (!isNaN(idx) && Array.isArray(target)) {
          target[idx] = newValue
        } else {
          target[key] = newValue
        }
      } else {
        currentData[key] = newValue
      }
      fileDataCacheRef.current.set(filePath, currentData)

      // 3. Clear existing debounce timer for this file
      const existingTimer = saveTimeoutsRef.current.get(filePath)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      // 4. Set debounced auto-save (400ms)
      const timer = setTimeout(async () => {
        try {
          const jsonString = JSON.stringify(currentData, null, 2) + '\n'
          await SaveFileContent(filePath, jsonString)
          refreshLineNumbers(filePath)

          setNodes((currentNodes) =>
            currentNodes.map((n) => {
              if (n.type === 'astPropertyNode' && (n.data as any).filePath === filePath) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    saveStatus: 'saved',
                  },
                }
              }
              return n
            }),
          )
        } catch (err) {
          console.error(`Failed to auto-save ${filePath}:`, err)
          setNodes((currentNodes) =>
            currentNodes.map((n) => {
              if (n.type === 'astPropertyNode' && (n.data as any).filePath === filePath) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    saveStatus: 'error',
                  },
                }
              }
              return n
            }),
          )
        }
      }, 400)

      saveTimeoutsRef.current.set(filePath, timer)
    },
    [refreshLineNumbers, setNodes],
  )

  // Global Ctrl+S listener to save any pending edits immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveTimeoutsRef.current.forEach(async (timer, filePath) => {
          clearTimeout(timer)
          const currentData = fileDataCacheRef.current.get(filePath)
          if (currentData) {
            try {
              const jsonString = JSON.stringify(currentData, null, 2) + '\n'
              await SaveFileContent(filePath, jsonString)
              refreshLineNumbers(filePath)
              setNodes((currentNodes) =>
                currentNodes.map((n) => {
                  if (n.type === 'astPropertyNode' && (n.data as any).filePath === filePath) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        saveStatus: 'saved',
                      },
                    }
                  }
                  return n
                }),
              )
            } catch (err) {
              console.error(`Failed Ctrl+S save for ${filePath}:`, err)
            }
          }
        })
        saveTimeoutsRef.current.clear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [refreshLineNumbers, setNodes])

  // Handler to change property data type
  const handleChangeType = useCallback(
    (filePath: string, nodeId: string, _oldType: string, newType: string) => {
      setNodes((currentNodes) => {
        const targetNode = currentNodes.find((n) => n.id === nodeId)
        if (!targetNode) return currentNodes

        const curVal = (targetNode.data as any).value
        const key = (targetNode.data as any).key
        const parentKeyPath = (targetNode.data as any).parentKeyPath || []

        let convertedVal: any
        switch (newType) {
          case 'string':
            convertedVal = typeof curVal === 'object' ? JSON.stringify(curVal) : String(curVal ?? '')
            break
          case 'number':
            const parsedNum = parseFloat(curVal)
            convertedVal = isNaN(parsedNum) ? 0 : parsedNum
            break
          case 'boolean':
            convertedVal = Boolean(curVal)
            break
          case 'string_array':
          case 'array':
            convertedVal = Array.isArray(curVal) ? curVal : curVal !== undefined && curVal !== '' ? [curVal] : []
            break
          case 'object_array':
            convertedVal =
              Array.isArray(curVal) && curVal.length > 0 && typeof curVal[0] === 'object' ? curVal : []
            break
          case 'object':
            convertedVal =
              typeof curVal === 'object' && curVal !== null && !Array.isArray(curVal) ? curVal : {}
            break
          default:
            convertedVal = curVal
        }

        // Trigger property change to update cache and auto-save
        handleASTPropertyChange(filePath, nodeId, key, convertedVal, parentKeyPath)

        return currentNodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                type: newType,
                value: convertedVal,
                saveStatus: 'saving',
                hasOutputSocket: newType === 'object' || newType === 'object_array',
              },
            }
          }
          return n
        })
      })
    },
    [handleASTPropertyChange, setNodes],
  )

  // Handler to toggle collapse state of an individual property node and auto-resize the container
  const handleToggleCollapse = useCallback(
    (nodeId: string, collapsed: boolean) => {
      setNodes((currentNodes) => {
        const targetNode = currentNodes.find((n) => n.id === nodeId)
        if (!targetNode) return currentNodes

        const groupId = targetNode.parentId
        const oldDimensions = getNodeDimensions(targetNode.data)
        const newDimensions = getNodeDimensions({
          ...targetNode.data,
          isCollapsed: collapsed,
        })
        const deltaH = newDimensions.height - oldDimensions.height

        const curX = targetNode.position.x
        const curY = targetNode.position.y

        // 1. Update target node and shift any siblings directly below it in the same column
        const updatedNodes = currentNodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                isCollapsed: collapsed,
              },
            }
          }
          if (groupId && n.parentId === groupId && n.id !== nodeId) {
            if (Math.abs(n.position.x - curX) < 50 && n.position.y > curY) {
              return {
                ...n,
                position: {
                  ...n.position,
                  y: Math.max(52, Math.round(n.position.y + deltaH)),
                },
              }
            }
          }
          return n
        })

        // 2. Automatically expand the parent container so it always encloses all children
        if (groupId) {
          const groupNode = updatedNodes.find((n) => n.id === groupId)
          if (groupNode) {
            const children = updatedNodes.filter((n) => n.parentId === groupId)
            let maxRight = 600
            let maxBottom = 150

            children.forEach((c) => {
              const dims = getNodeDimensions(c.data)
              maxRight = Math.max(maxRight, c.position.x + dims.width)
              maxBottom = Math.max(maxBottom, c.position.y + dims.height)
            })

            const curW = Number(groupNode.style?.width) || (groupNode.data as any)?.minWidth || 700
            const curH = Number(groupNode.style?.height) || (groupNode.data as any)?.minHeight || 220

            // If expanding, expand container. If collapsing, snugly fit.
            const newW = Math.max(700, curW, maxRight + 36)
            const newH = Math.max(140, collapsed ? maxBottom + 36 : Math.max(curH, maxBottom + 36))

            return updatedNodes.map((n) => {
              if (n.id === groupId) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    minWidth: newW,
                    minHeight: newH,
                  },
                  style: {
                    ...n.style,
                    width: newW,
                    height: newH,
                  },
                }
              }
              return n
            })
          }
        }

        return updatedNodes
      })
    },
    [setNodes],
  )

  // Handler to collapse or expand all properties in a group and auto-resize the container
  const handleToggleCollapseAll = useCallback(
    (groupId: string, fileNodeId: string, collapsed: boolean) => {
      setNodes((currentNodes) => {
        const groupNode = currentNodes.find((n) => n.id === groupId)
        if (!groupNode) return currentNodes

        const groupProps = currentNodes.filter(
          (n) => n.parentId === groupId && n.type === 'astPropertyNode',
        )

        const hasBanner = Boolean((groupNode.data as any)?.description)
        const startY = hasBanner ? 80 : 52

        // Build tree from groupProps
        const buildLayoutTree = (node: KnotNode): LayoutNodeItem => {
          const dims = collapsed
            ? { width: 240, height: 32 }
            : getNodeDimensions(node.data)

          const key = (node.data as any).key || ''
          const parentKeyPath = (node.data as any).parentKeyPath || []
          const fullPathPrefix = [...parentKeyPath, key].join('/')

          const children = groupProps.filter((c) => {
            const p = ((c.data as any).parentKeyPath || []).join('/')
            return p === fullPathPrefix
          })

          return {
            id: node.id,
            key,
            data: node.data,
            width: dims.width,
            height: dims.height,
            children: children.map(buildLayoutTree),
          }
        }

        const isRoot = (n: KnotNode) => {
          const pkp = (n.data as any).parentKeyPath
          return !pkp || pkp.length === 0
        }

        const rootNodes = groupProps.filter(isRoot)
        const rootItems = rootNodes.map(buildLayoutTree)

        const { positions, containerWidth, containerHeight } = computeHierarchicalLayout(
          rootItems,
          24,
          startY,
          collapsed ? 10 : 20,
          collapsed ? 44 : 56,
          4,
        )

        const groupWidth = containerWidth
        const groupHeight = Math.max(collapsed ? 140 : 220, containerHeight)

        return currentNodes.map((n) => {
          if (n.id === groupId) {
            return {
              ...n,
              data: {
                ...n.data,
                isAllCollapsed: collapsed,
                minWidth: groupWidth,
                minHeight: groupHeight,
              },
              style: {
                ...n.style,
                width: groupWidth,
                height: groupHeight,
              },
            }
          }
          if (n.type === 'astPropertyNode' && (n.data as any).fileNodeId === fileNodeId) {
            const newPos = positions.get(n.id) || n.position
            return {
              ...n,
              position: newPos,
              data: {
                ...n.data,
                isCollapsed: collapsed,
              },
            }
          }
          return n
        })
      })
    },
    [setNodes],
  )

  // Handler to delete/remove a property key from file and canvas
  const handleRemoveProperty = useCallback(
    (filePath: string, fileNodeId: string, nodeId: string, key: string, parentKeyPath: string[] = []) => {
      // 1. Remove key from cache object
      const currentData = fileDataCacheRef.current.get(filePath) || {}
      let target: any = currentData
      for (const seg of parentKeyPath) {
        const isArrIdx = seg.startsWith('[') && seg.endsWith(']')
        const idx = isArrIdx ? parseInt(seg.slice(1, -1), 10) : NaN
        const lookup = !isNaN(idx) ? idx : seg
        if (!target[lookup] || typeof target[lookup] !== 'object') {
          return
        }
        target = target[lookup]
      }
      const isArrIdx = key.startsWith('[') && key.endsWith(']')
      const idx = isArrIdx ? parseInt(key.slice(1, -1), 10) : NaN
      if (!isNaN(idx) && Array.isArray(target)) {
        target.splice(idx, 1)
      } else {
        delete target[key]
      }
      fileDataCacheRef.current.set(filePath, currentData)

      // 2. Debounced save to file
      const existingTimer = saveTimeoutsRef.current.get(filePath)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }
      const timer = setTimeout(async () => {
        try {
          const jsonString = JSON.stringify(currentData, null, 2) + '\n'
          await SaveFileContent(filePath, jsonString)
          refreshLineNumbers(filePath)
        } catch (err) {
          console.error(`Failed to auto-save after removing key in ${filePath}:`, err)
        }
      }, 400)
      saveTimeoutsRef.current.set(filePath, timer)

      // 3. Remove nodes and edges
      const groupId = `group_${fileNodeId}`
      setNodes((currentNodes) => {
        const fullPathPrefix = [...parentKeyPath, key].join('/')
        const idsToRemove = new Set<string>([nodeId])

        currentNodes.forEach((n) => {
          if (n.type === 'astPropertyNode' && (n.data as any).fileNodeId === fileNodeId) {
            const nPath = ((n.data as any).parentKeyPath || []).join('/')
            if (nPath === fullPathPrefix || nPath.startsWith(fullPathPrefix + '/')) {
              idsToRemove.add(n.id)
            }
          }
        })

        setEdges((edges) =>
          edges.filter((e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)),
        )

        const remainingNodes = currentNodes.filter((n) => !idsToRemove.has(n.id))

        // Recalculate container bounds after removal
        const remainingGroupChildren = remainingNodes.filter(
          (n) => n.parentId === groupId && n.type === 'astPropertyNode',
        )

        let maxChildX = 0
        let maxChildY = 0
        remainingGroupChildren.forEach((c) => {
          const isDesc = (c.data as any).isLongText
          const isTag = (c.data as any).type === 'string_array' || (c.data as any).type === 'array'
          const isObj = (c.data as any).type === 'object' || (c.data as any).type === 'object_array'
          const cW = isDesc ? 300 : isTag ? 280 : 260
          const cH = isDesc ? 130 : isTag ? 125 : isObj ? 86 : 90
          maxChildX = Math.max(maxChildX, c.position.x + cW)
          maxChildY = Math.max(maxChildY, c.position.y + cH)
        })

        const newWidth = Math.max(700, maxChildX + 36)
        const newHeight = Math.max(220, maxChildY + 36)

        return remainingNodes.map((n) => {
          if (n.id === groupId) {
            return {
              ...n,
              data: {
                ...n.data,
                itemCount: Math.max(0, ((n.data as any).itemCount || 1) - 1),
                minWidth: newWidth,
                minHeight: newHeight,
              },
              style: {
                ...n.style,
                width: newWidth,
                height: newHeight,
              },
            }
          }
          return n
        })
      })
    },
    [setNodes, setEdges],
  )

  // Handler for filter search within a file group container
  const handleFilterSearch = useCallback(
    (filePath: string, rawQuery: string) => {
      const query = rawQuery.trim().toLowerCase()

      setNodes((currentNodes) => {
        const groupNode = currentNodes.find(
          (n) => n.type === 'fileGroupNode' && (n.data as any).filePath === filePath,
        )
        if (!groupNode) return currentNodes
        const groupId = groupNode.id

        const groupChildren = currentNodes.filter(
          (n) => n.parentId === groupId && n.type === 'astPropertyNode',
        )

        if (!query) {
          // Reset: unhide all nodes in this group
          setEdges((currentEdges) =>
            currentEdges.map((e) => {
              const srcInGroup = groupChildren.some((c) => c.id === e.source)
              const tgtInGroup = groupChildren.some((c) => c.id === e.target)
              if (srcInGroup || tgtInGroup) {
                return { ...e, hidden: false }
              }
              return e
            }),
          )

          return currentNodes.map((n) => {
            if (n.id === groupId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  searchQuery: '',
                  matchCount: undefined,
                },
              }
            }
            if (n.parentId === groupId && n.type === 'astPropertyNode') {
              return {
                ...n,
                hidden: false,
                data: {
                  ...n.data,
                  isSearchMatch: false,
                },
              }
            }
            return n
          })
        }

        // Check if node matches directly by key or value
        const directlyMatches = (node: KnotNode) => {
          const data = node.data as any
          const keyMatch = Boolean(
            data.key && typeof data.key === 'string' && data.key.toLowerCase().includes(query),
          )
          if (keyMatch) return true

          // For container nodes (object or object_array), do NOT check value or rawText
          // because their value/rawText contains the serialized code of child properties
          if (data.type === 'object' || data.type === 'object_array') {
            return false
          }

          const val = data.value
          if (typeof val === 'string' && val.toLowerCase().includes(query)) return true
          if (typeof val === 'number' && String(val).toLowerCase().includes(query)) return true
          if (typeof val === 'boolean' && String(val).toLowerCase().startsWith(query)) return true
          if (Array.isArray(val)) {
            if (val.some((item) => String(item).toLowerCase().includes(query))) return true
          }
          if (
            data.type === 'other' &&
            data.rawText &&
            typeof data.rawText === 'string' &&
            data.rawText.toLowerCase().includes(query)
          ) {
            return true
          }
          return false
        }

        const directMatchIds = new Set<string>()
        groupChildren.forEach((child) => {
          if (directlyMatches(child)) {
            directMatchIds.add(child.id)
          }
        })

        // Collect visible node IDs: direct matches + their ancestors up the hierarchy
        const visibleNodeIds = new Set<string>(directMatchIds)

        setEdges((currentEdges) => {
          // Walk up incoming edges to include all ancestors so paths remain unbroken
          let changed = true
          while (changed) {
            changed = false
            currentEdges.forEach((edge) => {
              if (visibleNodeIds.has(edge.target) && !visibleNodeIds.has(edge.source)) {
                const srcInGroup = groupChildren.some((c) => c.id === edge.source)
                if (srcInGroup) {
                  visibleNodeIds.add(edge.source)
                  changed = true
                }
              }
            })
          }

          // Update edge visibility
          return currentEdges.map((e) => {
            const srcInGroup = groupChildren.some((c) => c.id === e.source)
            const tgtInGroup = groupChildren.some((c) => c.id === e.target)
            if (srcInGroup || tgtInGroup) {
              const isVisible = visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
              return {
                ...e,
                hidden: !isVisible,
              }
            }
            return e
          })
        })

        return currentNodes.map((n) => {
          if (n.id === groupId) {
            return {
              ...n,
              data: {
                ...n.data,
                searchQuery: rawQuery,
                matchCount: directMatchIds.size,
                itemCount: groupChildren.length,
              },
            }
          }
          if (n.parentId === groupId && n.type === 'astPropertyNode') {
            const isVisible = visibleNodeIds.has(n.id)
            return {
              ...n,
              hidden: !isVisible,
              data: {
                ...n.data,
                isSearchMatch: directMatchIds.has(n.id),
              },
            }
          }
          return n
        })
      })
    },
    [setNodes, setEdges],
  )

  // Handler to add a child property inside an object node
  const handleAddChildProperty = useCallback(
    (parentNodeId: string, filePath: string, parentKey: string, parentKeyPath: string[]) => {
      const currentData = fileDataCacheRef.current.get(filePath) || {}
      let targetObj: any = currentData
      for (const seg of parentKeyPath) {
        const isArrIdx = seg.startsWith('[') && seg.endsWith(']')
        const idx = isArrIdx ? parseInt(seg.slice(1, -1), 10) : NaN
        const lookup = !isNaN(idx) ? idx : seg
        if (!targetObj[lookup] || typeof targetObj[lookup] !== 'object') {
          targetObj[lookup] = !isNaN(idx) ? [] : {}
        }
        targetObj = targetObj[lookup]
      }
      const isArrIdx = parentKey.startsWith('[') && parentKey.endsWith(']')
      const idx = isArrIdx ? parseInt(parentKey.slice(1, -1), 10) : NaN
      const parentLookup = !isNaN(idx) ? idx : parentKey
      const parentObj = parentKey ? (targetObj[parentLookup] = targetObj[parentLookup] || {}) : targetObj

      let counter = 1
      let newKey = `newField_${counter}`
      while (parentObj[newKey] !== undefined) {
        counter++
        newKey = `newField_${counter}`
      }
      parentObj[newKey] = ''

      const childKeyPath = [...parentKeyPath, parentKey]
      const childId = `prop_${parentNodeId}_child_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      const fileSchemaProps = schemaPropertiesRef.current.get(filePath)
      const childDesc = lookupSchemaProp(fileSchemaProps, [...childKeyPath, newKey].join('/'))
      handleASTPropertyChange(filePath, childId, newKey, '', childKeyPath)

      setNodes((currentNodes) => {
        const parentNode = currentNodes.find((n) => n.id === parentNodeId)
        if (!parentNode) return currentNodes

        const fileNodeId = (parentNode.data as any).fileNodeId
        const siblings = currentNodes.filter(
          (n) =>
            n.type === 'astPropertyNode' &&
            (n.data as any).parentKeyPath?.join('/') === childKeyPath.join('/'),
        )
        const colIdx = Math.floor(siblings.length / 4)
        const rowIdx = siblings.length % 4
        const branchRelX = parentNode.position.x + 280 + 44 + colIdx * (280 + 36)
        const branchRelY = Math.max(52, parentNode.position.y) + rowIdx * (162 + 24)

        const newChildNode: KnotNode = {
          id: childId,
          type: 'astPropertyNode',
          parentId: parentNode.parentId,
          position: { x: branchRelX, y: branchRelY },
          data: {
            fileNodeId,
            filePath,
            key: newKey,
            value: '',
            type: 'string',
            rawText: `"${newKey}": ""`,
            description: childDesc,
            isLongText: false,
            saveStatus: 'saved',
            hasInputSocket: true,
            hasOutputSocket: false,
            parentKeyPath: childKeyPath,
            onChange: (k: string, v: any) =>
              handleASTPropertyChange(filePath, childId, k, v, childKeyPath),
            onRenameKey: (oldK: string, newK: string) =>
              handleRenameKey(filePath, childId, oldK, newK, childKeyPath),
            onChangeType: (oldT: string, newT: string) =>
              handleChangeType(filePath, childId, oldT, newT),
            onToggleCollapse: (nid: string, col: boolean) =>
              handleToggleCollapse(nid, col),
            onAddChildProperty: (pk: string, pkp: string[]) =>
              handleAddChildPropertyRef.current?.(childId, filePath, pk, pkp),
            onAddArrayItem: (pk: string, pkp: string[]) =>
              handleAddArrayItemRef.current?.(childId, filePath, pk, pkp),
            onRemoveProperty: (k: string, pkp: string[]) =>
              handleRemoveProperty(filePath, fileNodeId, childId, k, pkp),
          },
        }

        const newEdge: KnotEdge = {
          id: `edge_${parentNodeId}_${childId}`,
          source: parentNodeId,
          sourceHandle: 'output',
          target: childId,
          targetHandle: 'input',
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#fb7185',
            strokeWidth: 1.5,
            opacity: 0.85,
          },
        }

        setEdges((edges) => [...edges, newEdge])

        // Automatically expand group container to wrap the new child node
        const groupId = parentNode.parentId
        return currentNodes
          .map((n) => {
            if (n.id === parentNodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  hasOutputSocket: true,
                },
              }
            }
            if (n.id === groupId) {
              const curW = Number(n.style?.width) || 700
              const curH = Number(n.style?.height) || 220
              const reqW = Math.max(curW, branchRelX + 280 + 36)
              const reqH = Math.max(curH, branchRelY + 90 + 36)
              return {
                ...n,
                data: {
                  ...n.data,
                  minWidth: reqW,
                  minHeight: reqH,
                },
                style: {
                  ...n.style,
                  width: reqW,
                  height: reqH,
                },
              }
            }
            return n
          })
          .concat(newChildNode)
      })
    },
    [handleASTPropertyChange, handleRenameKey, handleChangeType, handleToggleCollapse, handleRemoveProperty, setNodes, setEdges],
  )
  handleAddChildPropertyRef.current = handleAddChildProperty

  // Handler to add an object item to an object_array
  const handleAddArrayItem = useCallback(
    (parentNodeId: string, filePath: string, parentKey: string, parentKeyPath: string[]) => {
      const currentData = fileDataCacheRef.current.get(filePath) || {}
      let targetObj: any = currentData
      for (const seg of parentKeyPath) {
        const isArrIdx = seg.startsWith('[') && seg.endsWith(']')
        const idx = isArrIdx ? parseInt(seg.slice(1, -1), 10) : NaN
        const lookup = !isNaN(idx) ? idx : seg
        if (!targetObj[lookup] || typeof targetObj[lookup] !== 'object') {
          targetObj[lookup] = !isNaN(idx) ? [] : {}
        }
        targetObj = targetObj[lookup]
      }

      const isArrIdx = parentKey.startsWith('[') && parentKey.endsWith(']')
      const idx = isArrIdx ? parseInt(parentKey.slice(1, -1), 10) : NaN
      const parentLookup = !isNaN(idx) ? idx : parentKey
      if (!Array.isArray(targetObj[parentLookup])) {
        targetObj[parentLookup] = []
      }
      const arr = targetObj[parentLookup] as any[]
      const newIndex = arr.length
      const newElemKey = `[${newIndex}]`
      const newElemVal = {}
      arr.push(newElemVal)

      const childKeyPath = [...parentKeyPath, parentKey]
      const childId = `prop_${parentNodeId}_item_${newIndex}_${Date.now()}`
      handleASTPropertyChange(filePath, childId, newElemKey, newElemVal, childKeyPath)

      setNodes((currentNodes) => {
        const parentNode = currentNodes.find((n) => n.id === parentNodeId)
        if (!parentNode) return currentNodes

        const fileNodeId = (parentNode.data as any).fileNodeId
        const siblings = currentNodes.filter(
          (n) =>
            n.type === 'astPropertyNode' &&
            (n.data as any).parentKeyPath?.join('/') === childKeyPath.join('/'),
        )
        const branchRelX = parentNode.position.x + 280 + 44
        const branchRelY = parentNode.position.y + siblings.length * (86 + 24)

        const newChildNode: KnotNode = {
          id: childId,
          type: 'astPropertyNode',
          parentId: parentNode.parentId,
          position: { x: branchRelX, y: branchRelY },
          data: {
            fileNodeId,
            filePath,
            key: newElemKey,
            value: newElemVal,
            type: 'object',
            rawText: '{}',
            isLongText: false,
            saveStatus: 'saved',
            hasInputSocket: true,
            hasOutputSocket: true,
            parentKeyPath: childKeyPath,
            onChange: (k: string, v: any) =>
              handleASTPropertyChange(filePath, childId, k, v, childKeyPath),
            onRenameKey: (oldK: string, newK: string) =>
              handleRenameKey(filePath, childId, oldK, newK, childKeyPath),
            onChangeType: (oldT: string, newT: string) =>
              handleChangeType(filePath, childId, oldT, newT),
            onToggleCollapse: (nid: string, col: boolean) =>
              handleToggleCollapse(nid, col),
            onAddChildProperty: (pk: string, pkp: string[]) =>
              handleAddChildPropertyRef.current?.(childId, filePath, pk, pkp),
            onAddArrayItem: (pk: string, pkp: string[]) =>
              handleAddArrayItemRef.current?.(childId, filePath, pk, pkp),
            onRemoveProperty: (k: string, pkp: string[]) =>
              handleRemoveProperty(filePath, fileNodeId, childId, k, pkp),
          },
        }

        const newEdge: KnotEdge = {
          id: `edge_${parentNodeId}_${childId}`,
          source: parentNodeId,
          sourceHandle: 'output',
          target: childId,
          targetHandle: 'input',
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#818cf8', // Indigo/purple for array items
            strokeWidth: 1.5,
            opacity: 0.85,
          },
        }

        setEdges((edges) => [...edges, newEdge])

        const groupId = parentNode.parentId
        return currentNodes
          .map((n) => {
            if (n.id === parentNodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  hasOutputSocket: true,
                  value: [...arr],
                },
              }
            }
            if (n.id === groupId) {
              const curW = Number(n.style?.width) || 700
              const curH = Number(n.style?.height) || 220
              const reqW = Math.max(curW, branchRelX + 280 + 36)
              const reqH = Math.max(curH, branchRelY + 90 + 36)
              return {
                ...n,
                data: {
                  ...n.data,
                  minWidth: reqW,
                  minHeight: reqH,
                },
                style: {
                  ...n.style,
                  width: reqW,
                  height: reqH,
                },
              }
            }
            return n
          })
          .concat(newChildNode)
      })
    },
    [handleASTPropertyChange, handleRenameKey, handleChangeType, handleToggleCollapse, handleRemoveProperty, setNodes, setEdges],
  )
  handleAddArrayItemRef.current = handleAddArrayItem

  // Handler to add a root property inside the JSON group container
  const handleAddProperty = useCallback(
    (
      filePath: string,
      fileNodeId: string,
      groupId: string,
      clientPos?: { clientX: number; clientY: number },
      propertyType: string = 'string',
    ) => {
      const currentData = fileDataCacheRef.current.get(filePath) || {}
      let counter = 1
      let newKey = `newKey_${counter}`
      while (currentData[newKey] !== undefined) {
        counter++
        newKey = `newKey_${counter}`
      }

      let defaultValue: any = ''
      let rawText = `"${newKey}": ""`
      switch (propertyType) {
        case 'number':
          defaultValue = 0
          rawText = `"${newKey}": 0`
          break
        case 'boolean':
          defaultValue = false
          rawText = `"${newKey}": false`
          break
        case 'array':
        case 'string_array':
          defaultValue = []
          rawText = `"${newKey}": []`
          break
        case 'object_array':
          defaultValue = []
          rawText = `"${newKey}": []`
          break
        case 'object':
          defaultValue = {}
          rawText = `"${newKey}": {}`
          break
        case 'string':
        default:
          defaultValue = ''
          rawText = `"${newKey}": ""`
      }

      currentData[newKey] = defaultValue

      const newPropId = `prop_${fileNodeId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

      handleASTPropertyChange(filePath, newPropId, newKey, defaultValue, [])

      setNodes((currentNodes) => {
        const groupNode = currentNodes.find((n) => n.id === groupId)
        const groupChildren = currentNodes.filter(
          (n) => n.parentId === groupId && n.type === 'astPropertyNode',
        )

        const hasBanner = Boolean((groupNode?.data as any)?.description)
        const startY = hasBanner ? 80 : 52

        let posX = 24
        let posY = startY
        let foundCustomSlot = false

        // 1. If clicked at specific coordinate, place at click spot if it doesn't collide
        if (clientPos && groupNode) {
          const flowPos = screenToFlowPosition({ x: clientPos.clientX, y: clientPos.clientY })
          const rawRelX = flowPos.x - groupNode.position.x
          const rawRelY = flowPos.y - groupNode.position.y

          const candX = Math.max(24, Math.round(rawRelX / 24) * 24)
          const candY = Math.max(startY, Math.round(rawRelY / 24) * 24)

          const collides = groupChildren.some((child) => {
            const cX = child.position.x
            const cY = child.position.y
            const { width: cW, height: cH } = getNodeDimensions(child.data)
            return !(candX + 260 < cX || candX > cX + cW || candY + 90 < cY || candY > cY + cH)
          })

          if (!collides) {
            posX = candX
            posY = candY
            foundCustomSlot = true
          }
        }

        // 2. Otherwise find the next free slot across masonry columns
        if (!foundCustomSlot) {
          let col1Bottom = startY
          let col2Bottom = startY
          groupChildren.forEach((child) => {
            const { height: cH } = getNodeDimensions(child.data)
            const bottom = child.position.y + cH + 24
            if (Math.abs(child.position.x - 24) < 60) {
              col1Bottom = Math.max(col1Bottom, bottom)
            } else if (Math.abs(child.position.x - 338) < 60) {
              col2Bottom = Math.max(col2Bottom, bottom)
            } else {
              col1Bottom = Math.max(col1Bottom, bottom)
              col2Bottom = Math.max(col2Bottom, bottom)
            }
          })

          if (col1Bottom <= col2Bottom) {
            posX = 24
            posY = col1Bottom
          } else {
            posX = 338
            posY = col2Bottom
          }
        }

        const fileSchemaProps = schemaPropertiesRef.current.get(filePath)
        const propDesc = lookupSchemaProp(fileSchemaProps, newKey)
        const hasChildBranches = propertyType === 'object' || propertyType === 'object_array'

        const newNode: KnotNode = {
          id: newPropId,
          type: 'astPropertyNode',
          parentId: groupId,
          position: { x: posX, y: posY },
          data: {
            fileNodeId,
            filePath,
            key: newKey,
            value: defaultValue,
            type: propertyType,
            rawText,
            description: propDesc,
            isLongText: false,
            saveStatus: 'saved',
            hasInputSocket: false,
            hasOutputSocket: hasChildBranches,
            parentKeyPath: [],
            onChange: (k: string, v: any) =>
              handleASTPropertyChange(filePath, newPropId, k, v, []),
            onRenameKey: (oldK: string, newK: string) =>
              handleRenameKey(filePath, newPropId, oldK, newK, []),
            onChangeType: (oldT: string, newT: string) =>
              handleChangeType(filePath, newPropId, oldT, newT),
            onToggleCollapse: (nid: string, col: boolean) =>
              handleToggleCollapse(nid, col),
            onAddChildProperty: (pk: string, pkp: string[]) =>
              handleAddChildPropertyRef.current?.(newPropId, filePath, pk, pkp),
            onAddArrayItem: (pk: string, pkp: string[]) =>
              handleAddArrayItemRef.current?.(newPropId, filePath, pk, pkp),
            onRemoveProperty: (k: string, pkp: string[]) =>
              handleRemoveProperty(filePath, fileNodeId, newPropId, k, pkp),
          },
        }

        // Auto-resize group container to enclose the newly added property
        const curWidth = Number(groupNode?.style?.width) || 700
        const curHeight = Number(groupNode?.style?.height) || 220
        const newWidth = Math.max(curWidth, posX + 280 + 36)
        const newHeight = Math.max(curHeight, posY + 90 + 36)

        return currentNodes
          .map((n) => {
            if (n.id === groupId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  itemCount: ((n.data as any).itemCount || 0) + 1,
                  minWidth: newWidth,
                  minHeight: newHeight,
                },
                style: {
                  ...n.style,
                  width: newWidth,
                  height: newHeight,
                },
              }
            }
            return n
          })
          .concat(newNode)
      })
    },
    [
      handleASTPropertyChange,
      handleRenameKey,
      handleChangeType,
      handleToggleCollapse,
      handleAddChildProperty,
      handleRemoveProperty,
      screenToFlowPosition,
      setNodes,
    ],
  )

  // Toggle AST parsing & expand / collapse for a file node
  const handleToggleFileAST = useCallback(
    async (fileNodeId: string, filePath: string) => {
      onFileSelectRef.current?.(filePath)

      const fileNode = getNode(fileNodeId)
      if (!fileNode) return

      const isCurrentlyExpanded = (fileNode.data as any).isExpanded
      const groupId = `group_${fileNodeId}`

      if (isCurrentlyExpanded) {
        // COLLAPSE: Remove group node, all AST property nodes for this file, and edges
        setNodes((currentNodes) => {
          const removedIds = new Set<string>([groupId])
          currentNodes.forEach((n) => {
            if (n.type === 'astPropertyNode' && (n.data as any).fileNodeId === fileNodeId) {
              removedIds.add(n.id)
            }
          })
          setEdges((currentEdges) =>
            currentEdges.filter(
              (e) => !removedIds.has(e.source) && !removedIds.has(e.target) && e.source !== fileNodeId,
            ),
          )
          return currentNodes
            .filter((n) => !removedIds.has(n.id))
            .map((n) =>
              n.id === fileNodeId
                ? { ...n, data: { ...n.data, isExpanded: false, isLoadingAST: false } }
                : n,
            )
        })
      } else {
        // EXPAND: Call Tree-Sitter backend
        setNodes((currentNodes) =>
          currentNodes.map((n) => (n.id === fileNodeId ? { ...n, data: { ...n.data, isLoadingAST: true } } : n)),
        )

        try {
          const result = await ParseFile(filePath)
          if (!result || !result.nodes || result.nodes.length === 0) {
            setNodes((currentNodes) =>
              currentNodes.map((n) =>
                n.id === fileNodeId ? { ...n, data: { ...n.data, isExpanded: true, isLoadingAST: false } } : n,
              ),
            )
            return
          }

          // Cache parsed values for auto-save serialization
          const fileObj: Record<string, any> = {}
          result.nodes.forEach((n) => {
            fileObj[n.key] = n.value
          })
          fileDataCacheRef.current.set(filePath, fileObj)

          if (result.schemaProperties) {
            schemaPropertiesRef.current.set(filePath, result.schemaProperties as Record<string, string>)
          }
          if (result.description || result.schemaName) {
            schemaInfoRef.current.set(filePath, {
              description: result.description,
              schemaName: result.schemaName,
            })
          }

          const parentX = fileNode.position.x
          const parentY = fileNode.position.y

          // Calculate non-overlapping position if other file containers are already open
          const allCurrentNodes = getNodes()
          const otherGroups = allCurrentNodes.filter(
            (n) => n.type === 'fileGroupNode' && n.id !== groupId,
          )

          let groupX = parentX + 320
          let groupY = Math.max(30, parentY - 20)

          if (otherGroups.length > 0) {
            let maxRight = -Infinity
            let minTop = Infinity
            otherGroups.forEach((g) => {
              const w = typeof g.style?.width === 'number' ? g.style.width : 680
              const right = g.position.x + w
              if (right > maxRight) {
                maxRight = right
              }
              if (g.position.y < minTop) {
                minTop = g.position.y
              }
            })
            groupX = Math.max(groupX, maxRight + 56)
            groupY = Math.max(30, Math.min(minTop, parentY - 20))
          }

          const newNodes: KnotNode[] = []
          const newEdges: KnotEdge[] = []

          // SINGLE EDGE: file node output handle -> FileGroupNode input handle
          newEdges.push({
            id: `edge_${fileNodeId}_${groupId}`,
            source: fileNodeId,
            sourceHandle: 'output',
            target: groupId,
            targetHandle: 'input',
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: '#10b981',
              strokeWidth: 2,
              opacity: 0.9,
            },
          })

          const ext = ((fileNode.data as any).extension || '').toLowerCase()

          // Layout constants and hierarchical tree layout calculation
          const VERTICAL_GAP = 20
          const HORIZONTAL_COL_GAP = 56
          const MAX_NODES_PER_COL = 4
          const hasBanner = Boolean(result.description)
          const startY = hasBanner ? 80 : 52

          const toLayoutItem = (astNode: ASTNodeData): LayoutNodeItem => {
            const isDesc =
              astNode.type === 'string' &&
              (astNode.key.toLowerCase().includes('description') ||
                (typeof astNode.value === 'string' &&
                  (astNode.value.length > 50 || astNode.value.includes('\n'))))
            const dims = getNodeDimensions({ ...astNode, isLongText: isDesc })
            const children = (astNode.children || []).map(toLayoutItem)
            return {
              id: astNode.id,
              key: astNode.key,
              data: { ...astNode, isLongText: isDesc },
              width: dims.width,
              height: dims.height,
              children,
            }
          }

          const rootLayoutItems = result.nodes.map(toLayoutItem)
          const { positions, containerWidth, containerHeight } = computeHierarchicalLayout(
            rootLayoutItems,
            24,
            startY,
            VERTICAL_GAP,
            HORIZONTAL_COL_GAP,
            MAX_NODES_PER_COL,
          )

          const processNodeRecursively = (
            item: ASTNodeData,
            parentNodeId: string | null,
            parentKeyPath: string[],
          ) => {
            const pos = positions.get(item.id) || { x: 24, y: startY }
            const isDesc =
              item.type === 'string' &&
              (item.key.toLowerCase().includes('description') ||
                (typeof item.value === 'string' &&
                  (item.value.length > 50 || item.value.includes('\n'))))
            const hasChildBranches = Boolean(
              (item.type === 'object' || item.type === 'object_array') &&
                item.children &&
                item.children.length > 0,
            )

            newNodes.push({
              id: item.id,
              type: 'astPropertyNode',
              parentId: groupId,
              position: { x: pos.x, y: pos.y },
              data: {
                fileNodeId,
                filePath,
                key: item.key,
                value: item.value,
                type: item.type,
                rawText: item.rawText,
                description: item.description,
                startLine: item.startLine,
                endLine: item.endLine,
                isLongText: isDesc,
                saveStatus: 'saved',
                hasInputSocket: parentNodeId !== null,
                hasOutputSocket: hasChildBranches,
                parentKeyPath,
                onChange: (k: string, v: any) =>
                  handleASTPropertyChange(filePath, item.id, k, v, parentKeyPath),
                onRenameKey: (oldK: string, newK: string) =>
                  handleRenameKey(filePath, item.id, oldK, newK, parentKeyPath),
                onChangeType: (oldT: string, newT: string) =>
                  handleChangeType(filePath, item.id, oldT, newT),
                onToggleCollapse: (nid: string, col: boolean) =>
                  handleToggleCollapse(nid, col),
                onAddChildProperty: (pk: string, pkp: string[]) =>
                  handleAddChildPropertyRef.current?.(item.id, filePath, pk, pkp),
                onAddArrayItem: (pk: string, pkp: string[]) =>
                  handleAddArrayItemRef.current?.(item.id, filePath, pk, pkp),
                onRemoveProperty: (k: string, pkp: string[]) =>
                  handleRemoveProperty(filePath, fileNodeId, item.id, k, pkp),
              },
            })

            // Connecting edge from parent object/array to child node
            if (parentNodeId !== null) {
              newEdges.push({
                id: `edge_${parentNodeId}_${item.id}`,
                source: parentNodeId,
                sourceHandle: 'output',
                target: item.id,
                targetHandle: 'input',
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: item.key.startsWith('[') ? '#818cf8' : '#fb7185', // Indigo for array items, ruby for object keys
                  strokeWidth: 1.5,
                  opacity: 0.85,
                },
              })
            }

            if (hasChildBranches && item.children) {
              const currentKeyPath = [...parentKeyPath, item.key]
              item.children.forEach((child) => {
                processNodeRecursively(child, item.id, currentKeyPath)
              })
            }
          }

          result.nodes.forEach((rootNode) => {
            processNodeRecursively(rootNode, null, [])
          })

          const groupWidth = containerWidth
          const groupHeight = containerHeight

          // Container group node added FIRST (rendered as backdrop frame)
          const groupNode: KnotNode = {
            id: groupId,
            type: 'fileGroupNode',
            position: { x: groupX, y: groupY },
            data: {
              filePath,
              fileName: (fileNode.data as any).name || filePath.split(/[/\\]/).pop() || filePath,
              itemCount: newNodes.filter((n) => n.type === 'astPropertyNode').length,
              language: ext.replace('.', '') || 'json',
              description: result.description,
              schemaName: result.schemaName,
              isAllCollapsed: false,
              minWidth: groupWidth,
              minHeight: groupHeight,
              onClose: () => handleToggleFileASTRef.current?.(fileNodeId, filePath),
              onRenameFile: handleRenameFileOrFolder,
              onToggleCollapseAll: (_fp: string, collapsed: boolean) =>
                handleToggleCollapseAll(groupId, fileNodeId, collapsed),
              onAddProperty: (_fp: string, clientPos?: { clientX: number; clientY: number }, pType?: string) =>
                handleAddProperty(filePath, fileNodeId, groupId, clientPos, pType),
              onFilterSearch: handleFilterSearch,
            },
            style: {
              width: groupWidth,
              height: groupHeight,
            },
          }

          newNodes.unshift(groupNode)

          setNodes((currentNodes) => [
            ...currentNodes.map((n) =>
              n.id === fileNodeId ? { ...n, data: { ...n.data, isExpanded: true, isLoadingAST: false } } : n,
            ),
            ...newNodes,
          ])
          setEdges((currentEdges) => [...currentEdges, ...newEdges])
        } catch (err) {
          console.error(`Failed to parse file AST for ${filePath}:`, err)
          setNodes((currentNodes) =>
            currentNodes.map((n) => (n.id === fileNodeId ? { ...n, data: { ...n.data, isLoadingAST: false } } : n)),
          )
        }
      }
    },
    [
      getNode,
      getNodes,
      handleASTPropertyChange,
      handleRenameKey,
      handleChangeType,
      handleToggleCollapse,
      handleToggleCollapseAll,
      handleAddProperty,
      handleAddChildProperty,
      handleRemoveProperty,
      handleRenameFileOrFolder,
      setNodes,
      setEdges,
    ],
  )

  const handleToggleFileASTRef = useRef(handleToggleFileAST)
  handleToggleFileASTRef.current = handleToggleFileAST

  // Toggle expand / collapse for a folder node
  const handleToggleExpand = useCallback(
    async (nodeId: string, dirPath: string) => {
      const parentNode = getNode(nodeId)
      if (!parentNode) return

      const isCurrentlyExpanded = (parentNode.data as any).isExpanded

      if (isCurrentlyExpanded) {
        // COLLAPSE: Remove all descendant nodes and edges (including any opened AST groups/properties)
        setEdges((currentEdges) => {
          const descendantIds = getDescendantIds(nodeId, currentEdges)
          setNodes((currentNodes) => {
            currentNodes.forEach((n) => {
              if (n.type === 'astPropertyNode' && descendantIds.has((n.data as any).fileNodeId)) {
                descendantIds.add(n.id)
              }
              if (n.type === 'fileGroupNode' && descendantIds.has(n.id.replace('group_', ''))) {
                descendantIds.add(n.id)
              }
            })
            return currentNodes
              .filter((n) => !descendantIds.has(n.id))
              .map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isExpanded: false } } : n))
          })
          return currentEdges.filter(
            (e) => e.source !== nodeId && !descendantIds.has(e.source) && !descendantIds.has(e.target),
          )
        })
      } else {
        // EXPAND: Fetch children and spawn to the right
        try {
          const entries: FileEntry[] = (await ReadDirectory(dirPath)) || []
          if (entries.length === 0) {
            setNodes((current) =>
              current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isExpanded: true } } : n)),
            )
            return
          }

          const parentX = parentNode.position.x
          const parentY = parentNode.position.y
          const childX = parentX + 270
          const itemHeight = 38
          const startY = parentY

          const newNodes: KnotNode[] = []
          const newEdges: KnotEdge[] = []

          entries.forEach((entry, idx) => {
            const childId = `node_${dirPath}_${entry.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
            const childY = startY + idx * itemHeight

            if (entry.isDir) {
              newNodes.push({
                id: childId,
                type: 'directoryNode',
                position: { x: childX, y: childY },
                data: {
                  name: entry.name,
                  path: entry.path,
                  isDir: true,
                  isExpanded: false,
                  childrenCount: entry.childrenCount,
                  depth: ((parentNode.data as any).depth || 0) + 1,
                  workspaceGroup: (parentNode.data as any).workspaceGroup,
                  onToggle: handleToggleExpand,
                  onRename: handleRenameFileOrFolder,
                },
              })
            } else {
              newNodes.push({
                id: childId,
                type: 'fileNode',
                position: { x: childX, y: childY },
                data: {
                  name: entry.name,
                  path: entry.path,
                  size: entry.size,
                  extension: entry.extension,
                  depth: ((parentNode.data as any).depth || 0) + 1,
                  workspaceGroup: (parentNode.data as any).workspaceGroup,
                  isExpanded: false,
                  isLoadingAST: false,
                  onToggleAST: (id, path) => handleToggleFileASTRef.current?.(id, path),
                  onSelect: (path) => onFileSelectRef.current?.(path),
                  onRename: handleRenameFileOrFolder,
                },
              })
            }

            newEdges.push({
              id: `edge_${nodeId}_${childId}`,
              source: nodeId,
              sourceHandle: 'output',
              target: childId,
              targetHandle: 'input',
              type: 'smoothstep',
              animated: false,
              style: {
                stroke: '#f59e0b',
                strokeWidth: 1.5,
                opacity: 0.75,
              },
            })
          })

          setNodes((current) => [
            ...current.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, isExpanded: true } } : n)),
            ...newNodes,
          ])
          setEdges((current) => [...current, ...newEdges])
        } catch (err) {
          console.error('Failed to read directory:', err)
        }
      }
    },
    [getNode, getDescendantIds, handleRenameFileOrFolder, setNodes, setEdges],
  )

  // Populate canvas when currentFolders change
  useEffect(() => {
    if (!currentFolders || currentFolders.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    let isMounted = true

    const loadAllFolders = async () => {
      const allNodes: KnotNode[] = []
      const allEdges: KnotEdge[] = []
      const isMultiFolder = currentFolders.length > 1
      const itemHeight = 38

      for (let fIdx = 0; fIdx < currentFolders.length; fIdx++) {
        const folderPath = currentFolders[fIdx]
        const folderName = folderPath.split(/[/\\]/).pop() || folderPath
        const columnX = 60 + fIdx * 350
        const rootId = `root_folder_${fIdx}`

        try {
          const entries: FileEntry[] = (await ReadDirectory(folderPath)) || []

          allNodes.push({
            id: rootId,
            type: 'rootFolderNode',
            position: { x: columnX, y: 40 },
            data: {
              title: folderName,
              path: folderPath,
              itemCount: entries.length,
              isWorkspace: isMultiFolder,
              onOpenDirectory: () => onOpenDirectoryPromptRef.current?.(),
            },
          })

          const startY = 115
          const childX = columnX + 36

          entries.forEach((entry, idx) => {
            const childId = `root_${fIdx}_${entry.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
            const childY = startY + idx * itemHeight

            if (entry.isDir) {
              allNodes.push({
                id: childId,
                type: 'directoryNode',
                position: { x: childX, y: childY },
                data: {
                  name: entry.name,
                  path: entry.path,
                  isDir: true,
                  isExpanded: false,
                  childrenCount: entry.childrenCount,
                  depth: 0,
                  workspaceGroup: folderName,
                  onToggle: handleToggleExpand,
                  onRename: handleRenameFileOrFolder,
                },
              })
            } else {
              allNodes.push({
                id: childId,
                type: 'fileNode',
                position: { x: childX, y: childY },
                data: {
                  name: entry.name,
                  path: entry.path,
                  size: entry.size,
                  extension: entry.extension,
                  depth: 0,
                  workspaceGroup: folderName,
                  isExpanded: false,
                  isLoadingAST: false,
                  onToggleAST: (id, path) => handleToggleFileASTRef.current?.(id, path),
                  onSelect: (path) => onFileSelectRef.current?.(path),
                  onRename: handleRenameFileOrFolder,
                },
              })
            }

            allEdges.push({
              id: `edge_${rootId}_${childId}`,
              source: rootId,
              sourceHandle: 'output',
              target: childId,
              targetHandle: 'input',
              type: 'smoothstep',
              animated: false,
              style: {
                stroke: '#f59e0b',
                strokeWidth: 1.5,
                opacity: 0.75,
              },
            })
          })
        } catch (err) {
          console.error(`Failed to load root folder ${folderPath}:`, err)
        }
      }

      if (!isMounted) return
      setNodes(allNodes)
      setEdges(allEdges)

      setTimeout(() => {
        if (!isMounted) return
        fitView({ padding: 0.25, maxZoom: 1.0, duration: 0 })
      }, 50)
    }

    loadAllFolders()

    return () => {
      isMounted = false
    }
  }, [currentFolders, fitView, handleRenameFileOrFolder, handleToggleExpand, setNodes, setEdges])

  // Auto-resize group container when child node is dragged
  const handleNodeDrag: OnNodeDrag<KnotNode> = useCallback(
    (_, draggedNode) => {
      if (draggedNode.parentId && draggedNode.parentId.startsWith('group_')) {
        const groupId = draggedNode.parentId
        setNodes((currentNodes) => {
          const groupNode = currentNodes.find((n) => n.id === groupId)
          if (!groupNode) return currentNodes

          const { width: childWidth, height: childHeight } = getNodeDimensions(draggedNode.data)

          const requiredWidth = Math.max(700, draggedNode.position.x + childWidth + 36)
          const requiredHeight = Math.max(220, draggedNode.position.y + childHeight + 36)

          const currentWidth = (groupNode.style?.width as number) || 700
          const currentHeight = (groupNode.style?.height as number) || 220

          if (requiredWidth > currentWidth || requiredHeight > currentHeight) {
            const nextWidth = Math.max(currentWidth, requiredWidth)
            const nextHeight = Math.max(currentHeight, requiredHeight)
            return currentNodes.map((n) =>
              n.id === groupId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      minWidth: nextWidth,
                      minHeight: nextHeight,
                    },
                    style: {
                      ...n.style,
                      width: nextWidth,
                      height: nextHeight,
                    },
                  }
                : n,
            )
          }

          return currentNodes
        })
      }
    },
    [setNodes],
  )

  // Ensure group container bounds snugly wrap all children after drag release
  const handleNodeDragStop: OnNodeDrag<KnotNode> = useCallback(
    (_, draggedNode) => {
      if (draggedNode.parentId && draggedNode.parentId.startsWith('group_')) {
        const groupId = draggedNode.parentId
        setNodes((currentNodes) => {
          const groupNode = currentNodes.find((n) => n.id === groupId)
          if (!groupNode) return currentNodes

          const siblings = currentNodes.filter(
            (n) => n.parentId === groupId && n.type === 'astPropertyNode',
          )

          let maxX = 0
          let maxY = 0
          siblings.forEach((c) => {
            const { width: cW, height: cH } = getNodeDimensions(c.data)
            maxX = Math.max(maxX, c.position.x + cW)
            maxY = Math.max(maxY, c.position.y + cH)
          })

          const reqWidth = Math.max(700, maxX + 36)
          const reqHeight = Math.max(220, maxY + 36)

          const currentWidth = (groupNode.style?.width as number) || 700
          const currentHeight = (groupNode.style?.height as number) || 220

          if (reqWidth > currentWidth || reqHeight > currentHeight) {
            const nextWidth = Math.max(currentWidth, reqWidth)
            const nextHeight = Math.max(currentHeight, reqHeight)
            return currentNodes.map((n) =>
              n.id === groupId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      minWidth: nextWidth,
                      minHeight: nextHeight,
                    },
                    style: {
                      ...n.style,
                      width: nextWidth,
                      height: nextHeight,
                    },
                  }
                : n,
            )
          }

          return currentNodes
        })
      }
    },
    [setNodes],
  )

  return (
    <Box flex="1" width="100%" height="100%" position="relative" bg="slateDark.1" overflow="hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onlyRenderVisibleElements={true}
        colorMode="dark"
        minZoom={0.15}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        fitViewOptions={{ maxZoom: 1.0, padding: 0.25 }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnScroll={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background id="1" gap={24} size={1.5} color="#2b2e35" variant={BackgroundVariant.Dots} />
        {currentFolders.length > 0 && nodes.length > 0 && (
          <Controls
            showInteractive={true}
            style={{
              bottom: 12,
              left: 12,
              backgroundColor: '#18191c',
              borderColor: '#2e3138',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          />
        )}
        {currentFolders.length > 0 && nodes.length > 0 && (
          <MiniMap
            position="bottom-right"
            bgColor="#121316"
            maskColor="rgba(0, 0, 0, 0.65)"
            maskStrokeColor="#f59e0b"
            maskStrokeWidth={1.5}
            nodeColor={(n) => {
              if (n.type === 'rootFolderNode' || n.type === 'workspaceGroup') return '#f59e0b'
              if (n.type === 'directoryNode') return '#d97706'
              if (n.type === 'fileGroupNode') return 'rgba(16, 185, 129, 0.4)'
              if (n.type === 'astPropertyNode') return '#10b981'
              return '#3b82f6'
            }}
            nodeBorderRadius={3}
            pannable={true}
            zoomable={true}
            style={{
              backgroundColor: '#18191c',
              borderColor: '#2e3138',
              borderWidth: '1px',
              borderRadius: '8px',
              width: 180,
              height: 120,
            }}
          />
        )}
      </ReactFlow>

      {/* Empty state prompt */}
      {nodes.length === 0 && (
        <VStack
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          gap="16px"
          p="24px"
          bg="slateDark.2"
          borderColor="slateDark.5"
          borderWidth="1px"
          borderRadius="xl"
          boxShadow="0 16px 40px rgba(0,0,0,0.5)"
        >
          <Box color="amberDark.9">
            <LuFolderOpen size={40} />
          </Box>
          <VStack gap="4px" textAlign="center">
            <Text fontSize="15px" fontWeight="bold" color="slateDark.12">
              No Directory or Workspace Opened
            </Text>
            <Text fontSize="12px" color="slateDark.10" maxW="320px">
              Open a directory to explore files and folders as expandable visual nodes, or add multiple folders to a workspace.
            </Text>
          </VStack>

          <HStack gap="12px">
            <Button
              size="sm"
              variant="solid"
              bg="amberDark.9"
              color="slateDark.1"
              _hover={{ bg: 'amberDark.10' }}
              onClick={onOpenDirectoryPrompt}
            >
              <LuFolderOpen style={{ marginRight: 6 }} /> Open Directory
            </Button>
            <Button
              size="sm"
              variant="outline"
              borderColor="slateDark.6"
              color="slateDark.11"
              _hover={{ bg: 'slateDark.4', color: 'slateDark.12' }}
              onClick={onOpenWorkspacePrompt}
            >
              <LuLayers style={{ marginRight: 6 }} /> Open Workspace
            </Button>
          </HStack>
        </VStack>
      )}
    </Box>
  )
}

export const MainCanvas: React.FC<MainCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
