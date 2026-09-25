import React from 'react'
import { HStack, Button, Menu, Portal, Text, Box } from '@chakra-ui/react'
import {
  LuFolder,
  LuFolderOpen,
  LuFolderPlus,
  LuLayers,
  LuFile,
  LuChevronRight,
  LuSave,
  LuLogOut,
  LuUndo2,
  LuRedo2,
  LuScissors,
  LuCopy,
  LuClipboardPaste,
  LuZoomIn,
  LuZoomOut,
  LuMaximize,
  LuCircleHelp,
  LuInfo,
  LuBinary,
  LuTrash2,
} from 'react-icons/lu'
import { Window } from '@wailsio/runtime'
import { RecentItem, WorkspaceConfig } from '../types/workspace'

interface MenuBarProps {
  onOpenFile?: () => void
  onOpenDirectory?: () => void
  onAddFolderToWorkspace?: () => void
  onOpenRecentFile?: (path: string) => void
  onOpenRecentFolder?: (path: string) => void
  onOpenRecentWorkspace?: (ws: WorkspaceConfig) => void
  onClearRecent?: (category: string) => void
  recentFiles?: RecentItem[]
  recentFolders?: RecentItem[]
  recentWorkspaces?: WorkspaceConfig[]
  onOpenAbout?: () => void
  onOpenTreeSitterTest?: () => void
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onOpenFile,
  onOpenDirectory,
  onAddFolderToWorkspace,
  onOpenRecentFile,
  onOpenRecentFolder,
  onOpenRecentWorkspace,
  onClearRecent,
  recentFiles = [],
  recentFolders = [],
  recentWorkspaces = [],
  onOpenAbout,
  onOpenTreeSitterTest,
}) => {
  const menuBtnProps = {
    variant: 'ghost' as const,
    size: 'xs' as const,
    px: '8px',
    height: '24px',
    fontSize: '12px',
    fontWeight: 'normal' as const,
    color: 'slate.11',
    borderRadius: 'sm',
    _hover: { bg: 'slate.4', color: 'slate.12' },
    _active: { bg: 'slate.5' },
  }

  const menuContentProps = {
    bg: 'slateDark.2',
    borderColor: 'slateDark.6',
    borderWidth: '1px',
    borderRadius: 'md',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    p: '4px',
    minW: '220px',
    zIndex: 9999,
  }

  const menuItemProps = {
    fontSize: '12px',
    px: '8px',
    py: '5px',
    borderRadius: 'sm',
    color: 'slateDark.12',
    cursor: 'pointer',
    _hover: { bg: 'slateDark.4', color: 'amberDark.11' },
  }

  const handleExit = () => {
    try {
      Window.Close()
    } catch {
      // ignore
    }
  }

  return (
    <HStack
      gap="2px"
      height="100%"
      alignItems="center"
      className="wails-no-drag"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* File Menu */}
      <Menu.Root positioning={{ placement: 'bottom-start', gutter: 4 }}>
        <Menu.Trigger asChild>
          <Button {...menuBtnProps}>File</Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content {...menuContentProps}>
              <Menu.Item value="open-file" {...menuItemProps} onClick={onOpenFile}>
                <LuFile size={14} style={{ marginRight: 8, color: '#38bdf8' }} />
                <Text flex="1">Open File...</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+O</Text>
              </Menu.Item>

              <Menu.Item value="open-dir" {...menuItemProps} onClick={onOpenDirectory}>
                <LuFolderOpen size={14} style={{ marginRight: 8, color: '#f59e0b' }} />
                <Text flex="1">Open Directory...</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+K Ctrl+O</Text>
              </Menu.Item>

              <Menu.Item value="add-workspace" {...menuItemProps} onClick={onAddFolderToWorkspace}>
                <LuFolderPlus size={14} style={{ marginRight: 8, color: '#10b981' }} />
                <Text flex="1">Add Folder to Workspace...</Text>
              </Menu.Item>

              <Menu.Separator borderColor="slateDark.5" my="3px" />

              {/* Submenu: Open Recent File */}
              <Menu.Root positioning={{ placement: 'right-start', gutter: 2 }}>
                <Menu.TriggerItem {...menuItemProps}>
                  <LuFile size={14} style={{ marginRight: 8 }} />
                  <Text flex="1">Open Recent File</Text>
                  <LuChevronRight size={14} />
                </Menu.TriggerItem>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content {...menuContentProps} minW="260px">
                      {recentFiles.length === 0 ? (
                        <Box px="12px" py="8px">
                          <Text fontSize="11px" color="slateDark.9">No recent files</Text>
                        </Box>
                      ) : (
                        recentFiles.map((item) => (
                          <Menu.Item
                            key={item.path}
                            value={item.path}
                            {...menuItemProps}
                            onClick={() => onOpenRecentFile?.(item.path)}
                          >
                            <LuFile size={13} style={{ marginRight: 6, flexShrink: 0 }} />
                            <Box flex="1" overflow="hidden">
                              <Text
                                fontSize="12px"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {item.name}
                              </Text>
                              <Text
                                fontSize="9px"
                                color="slateDark.9"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {item.path}
                              </Text>
                            </Box>
                          </Menu.Item>
                        ))
                      )}
                      {recentFiles.length > 0 && (
                        <>
                          <Menu.Separator borderColor="slateDark.5" my="3px" />
                          <Menu.Item
                            value="clear-recent-files"
                            {...menuItemProps}
                            onClick={() => onClearRecent?.('files')}
                          >
                            <LuTrash2 size={13} style={{ marginRight: 6, color: '#f87171' }} />
                            <Text fontSize="11px" color="redDark.11">Clear File History</Text>
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>

              {/* Submenu: Open Recent Folder */}
              <Menu.Root positioning={{ placement: 'right-start', gutter: 2 }}>
                <Menu.TriggerItem {...menuItemProps}>
                  <LuFolder size={14} style={{ marginRight: 8 }} />
                  <Text flex="1">Open Recent Folder</Text>
                  <LuChevronRight size={14} />
                </Menu.TriggerItem>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content {...menuContentProps} minW="260px">
                      {recentFolders.length === 0 ? (
                        <Box px="12px" py="8px">
                          <Text fontSize="11px" color="slateDark.9">No recent folders</Text>
                        </Box>
                      ) : (
                        recentFolders.map((item) => (
                          <Menu.Item
                            key={item.path}
                            value={item.path}
                            {...menuItemProps}
                            onClick={() => onOpenRecentFolder?.(item.path)}
                          >
                            <LuFolder size={13} style={{ marginRight: 6, flexShrink: 0, color: '#f59e0b' }} />
                            <Box flex="1" overflow="hidden">
                              <Text
                                fontSize="12px"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {item.name}
                              </Text>
                              <Text
                                fontSize="9px"
                                color="slateDark.9"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {item.path}
                              </Text>
                            </Box>
                          </Menu.Item>
                        ))
                      )}
                      {recentFolders.length > 0 && (
                        <>
                          <Menu.Separator borderColor="slateDark.5" my="3px" />
                          <Menu.Item
                            value="clear-recent-folders"
                            {...menuItemProps}
                            onClick={() => onClearRecent?.('folders')}
                          >
                            <LuTrash2 size={13} style={{ marginRight: 6, color: '#f87171' }} />
                            <Text fontSize="11px" color="redDark.11">Clear Folder History</Text>
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>

              {/* Submenu: Open Recent Workspace */}
              <Menu.Root positioning={{ placement: 'right-start', gutter: 2 }}>
                <Menu.TriggerItem {...menuItemProps}>
                  <LuLayers size={14} style={{ marginRight: 8 }} />
                  <Text flex="1">Open Recent Workspace</Text>
                  <LuChevronRight size={14} />
                </Menu.TriggerItem>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content {...menuContentProps} minW="260px">
                      {recentWorkspaces.length === 0 ? (
                        <Box px="12px" py="8px">
                          <Text fontSize="11px" color="slateDark.9">No recent workspaces</Text>
                        </Box>
                      ) : (
                        recentWorkspaces.map((ws) => (
                          <Menu.Item
                            key={ws.id || ws.name}
                            value={ws.id || ws.name}
                            {...menuItemProps}
                            onClick={() => onOpenRecentWorkspace?.(ws)}
                          >
                            <LuLayers size={13} style={{ marginRight: 6, flexShrink: 0, color: '#10b981' }} />
                            <Box flex="1" overflow="hidden">
                              <Text
                                fontSize="12px"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {ws.name}
                              </Text>
                              <Text
                                fontSize="9px"
                                color="slateDark.9"
                                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {ws.folders?.length || 0} folder(s)
                              </Text>
                            </Box>
                          </Menu.Item>
                        ))
                      )}
                      {recentWorkspaces.length > 0 && (
                        <>
                          <Menu.Separator borderColor="slateDark.5" my="3px" />
                          <Menu.Item
                            value="clear-recent-workspaces"
                            {...menuItemProps}
                            onClick={() => onClearRecent?.('workspaces')}
                          >
                            <LuTrash2 size={13} style={{ marginRight: 6, color: '#f87171' }} />
                            <Text fontSize="11px" color="redDark.11">Clear Workspace History</Text>
                          </Menu.Item>
                        </>
                      )}
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>

              <Menu.Separator borderColor="slateDark.5" my="3px" />

              <Menu.Item value="save" {...menuItemProps}>
                <LuSave size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Save State</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+S</Text>
              </Menu.Item>

              <Menu.Separator borderColor="slateDark.5" my="3px" />

              <Menu.Item value="exit" {...menuItemProps} onClick={handleExit}>
                <LuLogOut size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Exit</Text>
                <Text fontSize="10px" color="slateDark.9">Alt+F4</Text>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {/* Edit Menu */}
      <Menu.Root positioning={{ placement: 'bottom-start', gutter: 4 }}>
        <Menu.Trigger asChild>
          <Button {...menuBtnProps}>Edit</Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content {...menuContentProps}>
              <Menu.Item value="undo" {...menuItemProps}>
                <LuUndo2 size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Undo</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+Z</Text>
              </Menu.Item>
              <Menu.Item value="redo" {...menuItemProps}>
                <LuRedo2 size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Redo</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+Y</Text>
              </Menu.Item>
              <Menu.Separator borderColor="slateDark.5" my="3px" />
              <Menu.Item value="cut" {...menuItemProps}>
                <LuScissors size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Cut</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+X</Text>
              </Menu.Item>
              <Menu.Item value="copy" {...menuItemProps}>
                <LuCopy size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Copy</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+C</Text>
              </Menu.Item>
              <Menu.Item value="paste" {...menuItemProps}>
                <LuClipboardPaste size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Paste</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+V</Text>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {/* View Menu */}
      <Menu.Root positioning={{ placement: 'bottom-start', gutter: 4 }}>
        <Menu.Trigger asChild>
          <Button {...menuBtnProps}>View</Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content {...menuContentProps}>
              <Menu.Item value="zoom-in" {...menuItemProps}>
                <LuZoomIn size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Zoom In</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+=</Text>
              </Menu.Item>
              <Menu.Item value="zoom-out" {...menuItemProps}>
                <LuZoomOut size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Zoom Out</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+-</Text>
              </Menu.Item>
              <Menu.Item value="reset-zoom" {...menuItemProps}>
                <LuMaximize size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Reset Zoom (100%)</Text>
                <Text fontSize="10px" color="slateDark.9">Ctrl+0</Text>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      {/* Help Menu */}
      <Menu.Root positioning={{ placement: 'bottom-start', gutter: 4 }}>
        <Menu.Trigger asChild>
          <Button {...menuBtnProps}>Help</Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content {...menuContentProps}>
              <Menu.Item value="treesitter" {...menuItemProps} onClick={onOpenTreeSitterTest}>
                <LuBinary size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Tree-Sitter Status...</Text>
              </Menu.Item>
              <Menu.Item value="docs" {...menuItemProps}>
                <LuCircleHelp size={14} style={{ marginRight: 8 }} />
                <Text flex="1">Documentation</Text>
              </Menu.Item>
              <Menu.Separator borderColor="slateDark.5" my="3px" />
              <Menu.Item value="about" {...menuItemProps} onClick={onOpenAbout}>
                <LuInfo size={14} style={{ marginRight: 8 }} />
                <Text flex="1">About Knot</Text>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </HStack>
  )
}
