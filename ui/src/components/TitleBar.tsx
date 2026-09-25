import React from 'react'
import { HStack, Box, Text } from '@chakra-ui/react'
import { LuNetwork } from 'react-icons/lu'
import { MenuBar } from './MenuBar'
import { WindowControls } from './WindowControls'
import { RecentItem, WorkspaceConfig } from '../types/workspace'

interface TitleBarProps {
  activeTitle?: string
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

export const TitleBar: React.FC<TitleBarProps> = ({
  activeTitle = 'Knot — Untitled Project',
  onOpenFile,
  onOpenDirectory,
  onAddFolderToWorkspace,
  onOpenRecentFile,
  onOpenRecentFolder,
  onOpenRecentWorkspace,
  onClearRecent,
  recentFiles,
  recentFolders,
  recentWorkspaces,
  onOpenAbout,
  onOpenTreeSitterTest,
}) => {
  return (
    <HStack
      as="header"
      height="36px"
      width="100%"
      bg="slateDark.1"
      borderBottomWidth="1px"
      borderColor="slateDark.4"
      px={0}
      gap={0}
      justifyContent="space-between"
      alignItems="center"
      position="relative"
      zIndex={100}
    >
      {/* Left side: Logo & Menubar */}
      <HStack gap="6px" height="100%" pl="10px" flexShrink={0}>
        <HStack gap="6px" pr="6px">
          <Box color="amberDark.9">
            <LuNetwork size={16} />
          </Box>
          <Text
            fontSize="12px"
            fontWeight="bold"
            letterSpacing="0.05em"
            color="slateDark.12"
          >
            KNOT
          </Text>
        </HStack>

        <Box height="14px" width="1px" bg="slateDark.5" mx="2px" />

        <MenuBar
          onOpenFile={onOpenFile}
          onOpenDirectory={onOpenDirectory}
          onAddFolderToWorkspace={onAddFolderToWorkspace}
          onOpenRecentFile={onOpenRecentFile}
          onOpenRecentFolder={onOpenRecentFolder}
          onOpenRecentWorkspace={onOpenRecentWorkspace}
          onClearRecent={onClearRecent}
          recentFiles={recentFiles}
          recentFolders={recentFolders}
          recentWorkspaces={recentWorkspaces}
          onOpenAbout={onOpenAbout}
          onOpenTreeSitterTest={onOpenTreeSitterTest}
        />
      </HStack>

      {/* Middle: Draggable title region */}
      <Box
        flex="1"
        height="100%"
        display="flex"
        alignItems="center"
        justifyContent="center"
        cursor="default"
        className="wails-drag"
        style={{
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      >
        <Text
          fontSize="11px"
          color="slateDark.9"
          letterSpacing="0.02em"
          userSelect="none"
        >
          {activeTitle}
        </Text>
      </Box>

      {/* Right side: Custom Window Controls */}
      <HStack gap={0} height="100%" flexShrink={0}>
        <WindowControls />
      </HStack>
    </HStack>
  )
}
