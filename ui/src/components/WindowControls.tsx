import React, { useState, useEffect } from 'react'
import { HStack, IconButton } from '@chakra-ui/react'
import { VscChromeMinimize, VscChromeMaximize, VscChromeRestore, VscChromeClose } from 'react-icons/vsc'
import {
  MinimizeWindow,
  ToggleMaximizeWindow,
  CloseWindow,
  IsWindowMaximized,
} from '@/lib/github.com/raitucarp/knot/internal/app/service'

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    IsWindowMaximized()
      .then((maximized) => {
        setIsMaximized(maximized)
      })
      .catch(() => {})
  }, [])

  const handleMinimize = () => {
    MinimizeWindow().catch((e) => console.warn('Minimize error:', e))
  }

  const handleToggleMaximize = async () => {
    try {
      await ToggleMaximizeWindow()
      const maximized = await IsWindowMaximized()
      setIsMaximized(maximized)
    } catch (e) {
      console.warn('Toggle maximize error:', e)
    }
  }

  const handleClose = () => {
    CloseWindow().catch((e) => console.warn('Close error:', e))
  }

  return (
    <HStack
      gap={0}
      height="100%"
      className="wails-no-drag"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <IconButton
        aria-label="Minimize"
        variant="ghost"
        size="xs"
        height="100%"
        width="46px"
        borderRadius={0}
        color="slate.11"
        _hover={{ bg: 'slate.4', color: 'slate.12' }}
        onClick={handleMinimize}
      >
        <VscChromeMinimize size={14} />
      </IconButton>
      <IconButton
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        variant="ghost"
        size="xs"
        height="100%"
        width="46px"
        borderRadius={0}
        color="slate.11"
        _hover={{ bg: 'slate.4', color: 'slate.12' }}
        onClick={handleToggleMaximize}
      >
        {isMaximized ? <VscChromeRestore size={13} /> : <VscChromeMaximize size={13} />}
      </IconButton>
      <IconButton
        aria-label="Close"
        variant="ghost"
        size="xs"
        height="100%"
        width="46px"
        borderRadius={0}
        color="slate.11"
        _hover={{ bg: 'red.9', color: '#ffffff' }}
        onClick={handleClose}
      >
        <VscChromeClose size={14} />
      </IconButton>
    </HStack>
  )
}
