import { useState, useEffect, useCallback } from 'react'
import { Box, Flex, Dialog, Button, Text, HStack, VStack, Badge } from '@chakra-ui/react'
import { TitleBar } from '@/components/TitleBar'
import { MainCanvas } from '@/components/MainCanvas'
import { StatusBar } from '@/components/StatusBar'
import { LuNetwork, LuBinary, LuCircleCheck } from 'react-icons/lu'
import { GetAppInfo } from '@/lib/github.com/raitucarp/knot/internal/app/service'
import {
  OpenDirectoryDialog,
  OpenFileDialog,
  GetAppState,
  AddRecentFile,
  AddRecentFolder,
  AddRecentWorkspace,
  ClearRecent,
} from '@/lib/github.com/raitucarp/knot/internal/workspace/service'
import type { AppInfo } from '@/lib/github.com/raitucarp/knot/internal/app/models'
import type { RecentItem, WorkspaceConfig, AppState } from '@/types/workspace'

export function App() {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [treeSitterOpen, setTreeSitterOpen] = useState(false)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  // Workspace & Canvas State
  const [currentFolders, setCurrentFolders] = useState<string[]>([])
  const [workspaceName, setWorkspaceName] = useState<string>('')
  const [stats, setStats] = useState({ totalNodes: 0, totalEdges: 0 })

  // Persistent Recent State
  const [appState, setAppState] = useState<AppState>({
    recentFiles: [],
    recentFolders: [],
    recentWorkspaces: [],
  })

  // Load app info and initial state
  useEffect(() => {
    GetAppInfo()
      .then(setAppInfo)
      .catch(() => {})

    GetAppState()
      .then((state) => {
        if (state) {
          setAppState({
            recentFiles: (state.recentFiles || []) as RecentItem[],
            recentFolders: (state.recentFolders || []) as RecentItem[],
            recentWorkspaces: (state.recentWorkspaces || []) as WorkspaceConfig[],
            lastWorkspace: state.lastWorkspace as WorkspaceConfig | null,
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load initial app state:', err)
      })
  }, [])

  const refreshAppState = useCallback(async () => {
    try {
      const state = await GetAppState()
      if (state) {
        setAppState({
          recentFiles: (state.recentFiles || []) as RecentItem[],
          recentFolders: (state.recentFolders || []) as RecentItem[],
          recentWorkspaces: (state.recentWorkspaces || []) as WorkspaceConfig[],
          lastWorkspace: state.lastWorkspace as WorkspaceConfig | null,
        })
      }
    } catch (err) {
      console.error('Failed to refresh app state:', err)
    }
  }, [])

  // Open single file
  const handleOpenFile = useCallback(async () => {
    try {
      const path = await OpenFileDialog()
      if (path) {
        const parentDir = path.replace(/[/\\][^/\\]+$/, '')
        if (parentDir) {
          setCurrentFolders((prev) => (prev.includes(parentDir) ? prev : [...prev, parentDir]))
        }
        await AddRecentFile(path)
        await refreshAppState()
      }
    } catch (err) {
      console.error('Error opening file dialog:', err)
    }
  }, [refreshAppState])

  // Open directory
  const handleOpenDirectory = useCallback(async () => {
    try {
      const path = await OpenDirectoryDialog()
      if (path) {
        const folderName = path.split(/[/\\]/).pop() || path
        setCurrentFolders([path])
        setWorkspaceName(folderName)
        await refreshAppState()
      }
    } catch (err) {
      console.error('Error opening directory dialog:', err)
    }
  }, [refreshAppState])

  // Add folder to workspace
  const handleAddFolderToWorkspace = useCallback(async () => {
    try {
      const path = await OpenDirectoryDialog()
      if (path) {
        let updated: string[] = []
        if (currentFolders.includes(path)) {
          updated = currentFolders
        } else {
          updated = [...currentFolders, path]
        }
        setCurrentFolders(updated)

        const wsName = workspaceName || (path.split(/[/\\]/).pop() + ' Workspace')
        setWorkspaceName(wsName)
        await AddRecentWorkspace(wsName, updated)
        await refreshAppState()
      }
    } catch (err) {
      console.error('Error adding folder to workspace:', err)
    }
  }, [currentFolders, workspaceName, refreshAppState])

  // Open recent file
  const handleOpenRecentFile = useCallback(async (path: string) => {
    const parentDir = path.replace(/[/\\][^/\\]+$/, '')
    if (parentDir) {
      setCurrentFolders((prev) => (prev.includes(parentDir) ? prev : [...prev, parentDir]))
    }
    await AddRecentFile(path)
    await refreshAppState()
  }, [refreshAppState])

  // Open recent folder
  const handleOpenRecentFolder = useCallback(async (path: string) => {
    const folderName = path.split(/[/\\]/).pop() || path
    setCurrentFolders([path])
    setWorkspaceName(folderName)
    await AddRecentFolder(path)
    await refreshAppState()
  }, [refreshAppState])

  // Open recent workspace
  const handleOpenRecentWorkspace = useCallback(async (ws: WorkspaceConfig) => {
    if (ws.folders && ws.folders.length > 0) {
      setCurrentFolders(ws.folders)
      setWorkspaceName(ws.name)
      await AddRecentWorkspace(ws.name, ws.folders)
      await refreshAppState()
    }
  }, [refreshAppState])

  // Clear recent history
  const handleClearRecent = useCallback(async (category: string) => {
    try {
      await ClearRecent(category)
      await refreshAppState()
    } catch (err) {
      console.error('Error clearing recent history:', err)
    }
  }, [refreshAppState])

  const handleFileSelect = useCallback((path: string) => {
    AddRecentFile(path).then(refreshAppState).catch(() => {})
  }, [refreshAppState])

  const handleStatsChange = useCallback((newStats: { totalNodes: number; totalEdges: number }) => {
    setStats((prev) => {
      if (prev.totalNodes === newStats.totalNodes && prev.totalEdges === newStats.totalEdges) {
        return prev
      }
      return newStats
    })
  }, [])

  // Format title bar string
  const activeTitle = currentFolders.length === 1
    ? `Knot — ${workspaceName || currentFolders[0]} (Directory)`
    : currentFolders.length > 1
    ? `Knot — ${workspaceName} (${currentFolders.length} Folders Workspace)`
    : 'Knot — Untitled Project'

  return (
    <Flex
      direction="column"
      height="100vh"
      width="100vw"
      overflow="hidden"
      bg="slateDark.1"
      color="slateDark.12"
    >
      {/* Top Unified Title Bar */}
      <TitleBar
        activeTitle={activeTitle}
        onOpenFile={handleOpenFile}
        onOpenDirectory={handleOpenDirectory}
        onAddFolderToWorkspace={handleAddFolderToWorkspace}
        onOpenRecentFile={handleOpenRecentFile}
        onOpenRecentFolder={handleOpenRecentFolder}
        onOpenRecentWorkspace={handleOpenRecentWorkspace}
        onClearRecent={handleClearRecent}
        recentFiles={appState.recentFiles}
        recentFolders={appState.recentFolders}
        recentWorkspaces={appState.recentWorkspaces}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenTreeSitterTest={() => setTreeSitterOpen(true)}
      />

      {/* Main Content (Canvas Viewport) */}
      <Box flex="1" position="relative" width="100%" overflow="hidden">
        <MainCanvas
          currentFolders={currentFolders}
          workspaceName={workspaceName}
          onOpenDirectoryPrompt={handleOpenDirectory}
          onOpenWorkspacePrompt={handleAddFolderToWorkspace}
          onFileSelect={handleFileSelect}
          onStatsChange={handleStatsChange}
        />
      </Box>

      {/* Bottom Status Bar */}

      {/* Bottom Status Bar */}
      <StatusBar
        totalNodes={stats.totalNodes}
        totalEdges={stats.totalEdges}
        activeName={currentFolders.length > 0 ? (currentFolders.length === 1 ? currentFolders[0] : `${workspaceName} (${currentFolders.length} roots)`) : undefined}
      />

      {/* About Knot Dialog */}
      <Dialog.Root open={aboutOpen} onOpenChange={(e) => setAboutOpen(e.open)}>
        <Dialog.Backdrop bg="rgba(0,0,0,0.6)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg="slateDark.2"
            borderColor="slateDark.6"
            borderWidth="1px"
            borderRadius="lg"
            p="20px"
            maxW="420px"
            boxShadow="0 16px 40px rgba(0,0,0,0.7)"
          >
            <Dialog.Header pb="12px">
              <HStack gap="10px">
                <Box color="amberDark.9">
                  <LuNetwork size={22} />
                </Box>
                <Dialog.Title fontSize="16px" fontWeight="bold" color="slateDark.12">
                  About Knot IDE
                </Dialog.Title>
              </HStack>
            </Dialog.Header>
            <Dialog.Body py="10px">
              <VStack align="flex-start" gap="8px" fontSize="13px" color="slateDark.11">
                <Text>
                  <strong>Knot</strong> adalah IDE desktop eksperimental berbasis node editor yang terinspirasi oleh alur kerja Blender.
                </Text>
                {appInfo && (
                  <Box
                    bg="slateDark.3"
                    p="8px 12px"
                    borderRadius="md"
                    fontSize="11px"
                    width="100%"
                    fontFamily="mono"
                    color="slateDark.11"
                  >
                    OS: {appInfo.os} ({appInfo.arch})<br />
                    Go Runtime: {appInfo.goVersion}<br />
                    Version: {appInfo.version}
                  </Box>
                )}
                <HStack gap="8px" pt="6px" wrap="wrap">
                  <Badge bg="amberDark.3" color="amberDark.11" px="6px">Wails v3</Badge>
                  <Badge bg="violetDark.3" color="violetDark.11" px="6px">Chakra UI v3</Badge>
                  <Badge bg="blueDark.3" color="blueDark.11" px="6px">React Flow</Badge>
                  <Badge bg="jadeDark.3" color="jadeDark.11" px="6px">PureGo Tree-Sitter</Badge>
                </HStack>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer pt="16px">
              <Button
                size="sm"
                variant="outline"
                borderColor="slateDark.6"
                color="slateDark.11"
                _hover={{ bg: 'slateDark.4', color: 'slateDark.12' }}
                onClick={() => setAboutOpen(false)}
              >
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Tree-Sitter Status Dialog */}
      <Dialog.Root open={treeSitterOpen} onOpenChange={(e) => setTreeSitterOpen(e.open)}>
        <Dialog.Backdrop bg="rgba(0,0,0,0.6)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg="slateDark.2"
            borderColor="slateDark.6"
            borderWidth="1px"
            borderRadius="lg"
            p="20px"
            maxW="480px"
            boxShadow="0 16px 40px rgba(0,0,0,0.7)"
          >
            <Dialog.Header pb="12px">
              <HStack gap="10px">
                <Box color="jadeDark.9">
                  <LuBinary size={22} />
                </Box>
                <Dialog.Title fontSize="16px" fontWeight="bold" color="slateDark.12">
                  Tree-Sitter Engine Status
                </Dialog.Title>
              </HStack>
            </Dialog.Header>
            <Dialog.Body py="10px">
              <VStack align="flex-start" gap="10px" fontSize="13px" color="slateDark.11">
                <HStack gap="8px">
                  <LuCircleCheck color="#30a46c" size={16} />
                  <Text fontWeight="semibold" color="slateDark.12">
                    Dynamic Grammar Loader Active
                  </Text>
                </HStack>
                <Text fontSize="12px">
                  Grammar di-load secara dinamis pada runtime menggunakan <code>purego</code> dari shared library (<code>.dll</code> di Windows / <code>.so</code> di Linux).
                </Text>
                <Box
                  bg="slateDark.3"
                  p="10px"
                  borderRadius="md"
                  fontFamily="mono"
                  fontSize="11px"
                  width="100%"
                  color="amberDark.11"
                >
                  ParserService.LoadGrammar(libPath, langName)<br />
                  ParserService.ParseCode(langName, sourceCode)
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer pt="16px">
              <Button
                size="sm"
                variant="outline"
                borderColor="slateDark.6"
                color="slateDark.11"
                _hover={{ bg: 'slateDark.4', color: 'slateDark.12' }}
                onClick={() => setTreeSitterOpen(false)}
              >
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Flex>
  )
}

export default App
