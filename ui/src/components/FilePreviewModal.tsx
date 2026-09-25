import React, { useEffect, useState } from 'react'
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  IconButton,
  Spinner,
} from '@chakra-ui/react'
import { LuX, LuFile, LuCopy, LuCheck } from 'react-icons/lu'
import { ReadFileContent } from '@/lib/github.com/raitucarp/knot/internal/workspace/service'

interface FilePreviewModalProps {
  filePath: string | null
  onClose: () => void
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ filePath, onClose }) => {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<boolean>(false)

  useEffect(() => {
    if (!filePath) {
      setContent('')
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    ReadFileContent(filePath)
      .then((data) => {
        setContent(data || '')
      })
      .catch((err) => {
        setError(String(err) || 'Failed to read file')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [filePath])

  if (!filePath) return null

  const fileName = filePath.split(/[/\\]/).pop() || filePath

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Box
      position="fixed"
      bottom="36px"
      right="24px"
      width="480px"
      maxHeight="520px"
      bg="slateDark.2"
      borderColor="slateDark.6"
      borderWidth="1px"
      borderRadius="lg"
      boxShadow="0 12px 36px rgba(0,0,0,0.6)"
      zIndex={1000}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      animation="slideUp 0.2s ease"
    >
      {/* Header */}
      <HStack
        px="14px"
        py="10px"
        bg="slateDark.3"
        borderBottomWidth="1px"
        borderColor="slateDark.6"
        justifyContent="space-between"
        alignItems="center"
      >
        <HStack gap="8px" minWidth="0">
          <Box color="cyanDark.9">
            <LuFile size={16} />
          </Box>
          <VStack align="flex-start" gap="0" minWidth="0">
            <Text
              fontSize="12px"
              fontWeight="bold"
              color="slateDark.12"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {fileName}
            </Text>
            <Text
              fontSize="10px"
              color="slateDark.10"
              fontFamily="mono"
              title={filePath}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {filePath}
            </Text>
          </VStack>
        </HStack>

        <HStack gap="4px">
          <Button
            size="2xs"
            variant="ghost"
            onClick={handleCopy}
            color="slateDark.11"
            _hover={{ bg: 'slateDark.5', color: 'slateDark.12' }}
          >
            {copied ? <LuCheck size={12} style={{ marginRight: 4 }} /> : <LuCopy size={12} style={{ marginRight: 4 }} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <IconButton
            aria-label="Close preview"
            size="2xs"
            variant="ghost"
            onClick={onClose}
            color="slateDark.11"
            _hover={{ bg: 'slateDark.5', color: 'slateDark.12' }}
          >
            <LuX size={14} />
          </IconButton>
        </HStack>
      </HStack>

      {/* Body */}
      <Box flex="1" p="12px" overflowY="auto" maxHeight="420px" bg="slateDark.1">
        {loading && (
          <HStack justify="center" py="40px" gap="8px">
            <Spinner size="sm" color="amberDark.9" />
            <Text fontSize="12px" color="slateDark.10">Loading file content...</Text>
          </HStack>
        )}

        {error && (
          <Box p="10px" bg="redDark.2" borderColor="redDark.6" borderWidth="1px" borderRadius="md">
            <Text fontSize="12px" color="redDark.11">{error}</Text>
          </Box>
        )}

        {!loading && !error && (
          <Text
            as="pre"
            fontSize="11px"
            fontFamily="mono"
            color="slateDark.11"
            whiteSpace="pre-wrap"
            wordBreak="break-all"
            lineHeight="1.5"
          >
            {content || '(Empty file)'}
          </Text>
        )}
      </Box>
    </Box>
  )
}
