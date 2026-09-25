import { Node, Edge } from '@xyflow/react'

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  extension: string
  childrenCount: number
}

export interface RecentItem {
  path: string
  name: string
  timestamp: string
}

export interface WorkspaceConfig {
  id: string
  name: string
  folders: string[]
  timestamp: string
}

export interface AppState {
  recentFiles: RecentItem[]
  recentFolders: RecentItem[]
  recentWorkspaces: WorkspaceConfig[]
  lastWorkspace?: WorkspaceConfig | null
}

export interface DirectoryNodeData extends Record<string, unknown> {
  name: string
  path: string
  isDir: boolean
  isExpanded: boolean
  childrenCount: number
  depth: number
  workspaceGroup?: string
  onToggle: (nodeId: string, path: string) => void
  onRename?: (oldPath: string, newName: string) => Promise<void>
}

export interface FileNodeData extends Record<string, unknown> {
  name: string
  path: string
  size: number
  extension: string
  depth: number
  workspaceGroup?: string
  isExpanded?: boolean
  isLoadingAST?: boolean
  onToggleAST?: (nodeId: string, path: string) => void
  onRename?: (oldPath: string, newName: string) => Promise<void>
  onSelect?: (path: string) => void
}

export interface WorkspaceGroupData extends Record<string, unknown> {
  title: string
  path: string
  folderCount?: number
  onRemove?: (path: string) => void
}

export interface RootFolderNodeData extends Record<string, unknown> {
  title: string
  path: string
  itemCount?: number
  isWorkspace?: boolean
  onOpenDirectory?: () => void
  onRemove?: (path: string) => void
}

export interface FileGroupNodeData extends Record<string, unknown> {
  filePath: string
  fileName: string
  itemCount: number
  language: string
  isAllCollapsed?: boolean
  searchQuery?: string
  matchCount?: number
  description?: string
  schemaName?: string
  minWidth?: number
  minHeight?: number
  onClose?: (filePath: string) => void
  onRenameFile?: (oldPath: string, newName: string) => Promise<void>
  onToggleCollapseAll?: (filePath: string, collapsed: boolean) => void
  onAddProperty?: (
    filePath: string,
    clientPos?: { clientX: number; clientY: number },
    propertyType?: string,
  ) => void
  onFilterSearch?: (filePath: string, query: string) => void
}

export interface ASTPropertyNodeData extends Record<string, unknown> {
  fileNodeId: string
  filePath: string
  key: string
  value: any
  type: string
  rawText?: string
  description?: string
  startLine?: number
  endLine?: number
  isLongText?: boolean
  isCollapsed?: boolean
  saveStatus?: 'saved' | 'saving' | 'error'
  isDirty?: boolean
  isSearchMatch?: boolean
  hasOutputSocket?: boolean
  hasInputSocket?: boolean
  parentKeyPath?: string[]
  onChange?: (key: string, newValue: any) => void
  onRenameKey?: (oldKey: string, newKey: string) => void
  onChangeType?: (oldType: string, newType: string) => void
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void
  onAddChildProperty?: (parentKey: string, parentKeyPath: string[]) => void
  onAddArrayItem?: (parentKey: string, parentKeyPath: string[]) => void
  onRemoveProperty?: (key: string, parentKeyPath: string[]) => void
}

export type KnotNode = Node<
  | DirectoryNodeData
  | FileNodeData
  | WorkspaceGroupData
  | RootFolderNodeData
  | FileGroupNodeData
  | ASTPropertyNodeData
>
export type KnotEdge = Edge



