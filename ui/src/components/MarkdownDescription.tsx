import React, { memo, useState, useCallback } from 'react'
import { Box, HStack, Text, Button } from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useReactFlow } from '@xyflow/react'

interface MarkdownDescriptionProps {
  content: string
  nodeId?: string
  parentId?: string
}

export const MarkdownDescription: React.FC<MarkdownDescriptionProps> = memo(
  ({ content, nodeId, parentId }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const { getNode, setNodes } = useReactFlow()

    // Normalize escaped linebreaks if present
    const normalized = content
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .trim()

    // Determine if text is long enough to warrant a "Read more" collapse
    const isLong = normalized.length > 110 || normalized.includes('\n')

    const handleToggleExpand = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        const willExpand = !isExpanded

        // 1. Measure the current node's outer DOM element height BEFORE state update
        const nodeEl = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement
        const prevHeight = nodeEl ? nodeEl.getBoundingClientRect().height : 0

        // 2. Update state to expand or collapse
        setIsExpanded(willExpand)

        // 3. In the next frame after DOM has updated with the new height:
        requestAnimationFrame(() => {
          setTimeout(() => {
            const nextHeight = nodeEl ? nodeEl.getBoundingClientRect().height : 0
            const deltaH = nextHeight - prevHeight

            if (Math.abs(deltaH) > 4 && nodeId && parentId) {
              const currentNode = getNode(nodeId)
              if (!currentNode) return

              const curX = currentNode.position.x
              const curY = currentNode.position.y

              setNodes((allNodes) => {
                return allNodes.map((n) => {
                  // Only shift sibling nodes in the same parent group that are directly in the same column below this node
                  if (n.parentId === parentId && n.id !== nodeId) {
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

                  // Adjust parent container height so the bottom boundary expands/contracts smoothly
                  if (n.id === parentId) {
                    const curH = Number(n.style?.height) || (n.data as any)?.minHeight || 220
                    const requiredBottom = currentNode.position.y + nextHeight + 36
                    const newH = Math.max(140, Math.round(curH + deltaH), willExpand ? requiredBottom : 140)
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        minHeight: newH,
                      },
                      style: {
                        ...n.style,
                        height: newH,
                      },
                    }
                  }

                  return n
                })
              })
            }
          }, 40)
        })
      },
      [isExpanded, nodeId, parentId, getNode, setNodes],
    )

    return (
      <Box pt="4px" mt="2px">
        <Box
          maxH={isExpanded ? 'none' : isLong ? '44px' : 'none'}
          overflow="hidden"
          position="relative"
          transition="max-height 0.2s ease"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <Text
                  as="p"
                  fontSize="9.5px"
                  color="#a7f3d0"
                  fontStyle="italic"
                  lineHeight="1.42"
                  mb={isExpanded ? '6px' : '2px'}
                  _last={{ mb: 0 }}
                  userSelect="text"
                  whiteSpace="normal"
                  wordBreak="break-word"
                >
                  {children}
                </Text>
              ),
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-([a-zA-Z0-9_-]+)/.exec(className || '')
                const rawContent = String(children).replace(/\n$/, '')
                const isInline = inline ?? (!match && !rawContent.includes('\n'))

                if (isInline) {
                  return (
                    <Text
                      as="span"
                      bg="rgba(0, 0, 0, 0.45)"
                      color="#fef08a"
                      px="4px"
                      py="1px"
                      borderRadius="3px"
                      fontFamily="mono"
                      fontSize="8.5px"
                      fontStyle="normal"
                      border="1px solid rgba(255, 255, 255, 0.12)"
                      wordBreak="break-word"
                    >
                      {children}
                    </Text>
                  )
                }

                let lang = match ? match[1].toLowerCase() : 'typescript'
                if (lang === 'ts' || lang.includes('twoslash')) lang = 'typescript'
                if (lang === 'js') lang = 'javascript'

                return (
                  <Box
                    my="4px"
                    borderRadius="4px"
                    overflow="hidden"
                    border="1px solid rgba(255, 255, 255, 0.12)"
                    className="nodrag nowheel"
                  >
                    <SyntaxHighlighter
                      language={lang}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: '6px 8px',
                        backgroundColor: '#0c0d10',
                        fontSize: '8.5px',
                        fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                        lineHeight: '1.4',
                        maxHeight: '180px',
                        overflowX: 'auto',
                        overflowY: 'auto',
                      }}
                      codeTagProps={{
                        style: {
                          fontFamily: 'Consolas, Monaco, "Courier New", Courier, monospace',
                          fontSize: '8.5px',
                        },
                      }}
                    >
                      {rawContent}
                    </SyntaxHighlighter>
                  </Box>
                )
              },
              ul: ({ children }) => (
                <Box as="ul" pl="14px" my="4px" fontSize="9.5px" color="#a7f3d0" fontStyle="italic">
                  {children}
                </Box>
              ),
              ol: ({ children }) => (
                <Box as="ol" pl="14px" my="4px" fontSize="9.5px" color="#a7f3d0" fontStyle="italic">
                  {children}
                </Box>
              ),
              li: ({ children }) => (
                <Box as="li" mb="3px" lineHeight="1.35">
                  {children}
                </Box>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: '#38bdf8',
                    textDecoration: 'underline',
                    fontSize: '9.5px',
                    fontStyle: 'normal',
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag"
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong style={{ color: '#fde047', fontWeight: 600, fontStyle: 'normal' }}>
                  {children}
                </strong>
              ),
              em: ({ children }) => <em style={{ color: '#6ee7b7' }}>{children}</em>,
              blockquote: ({ children }) => (
                <Box
                  as="blockquote"
                  pl="8px"
                  my="4px"
                  borderLeft="2px solid #10b981"
                  color="rgba(167, 243, 208, 0.85)"
                  fontStyle="italic"
                >
                  {children}
                </Box>
              ),
            }}
          >
            {normalized}
          </ReactMarkdown>

          {/* Fade gradient overlay when collapsed */}
          {!isExpanded && isLong && (
            <Box
              position="absolute"
              bottom="0"
              left="0"
              right="0"
              height="20px"
              background="linear-gradient(to bottom, rgba(24, 25, 28, 0), rgba(24, 25, 28, 0.98))"
              pointerEvents="none"
            />
          )}
        </Box>

        {/* Read more / Show less toggle */}
        {isLong && (
          <HStack justifyContent="flex-start" mt="2px">
            <Button
              size="2xs"
              variant="plain"
              height="auto"
              p="0"
              fontSize="9px"
              fontWeight="600"
              color="#38bdf8"
              _hover={{ color: '#7dd3fc', textDecoration: 'underline' }}
              onClick={handleToggleExpand}
              className="nodrag"
            >
              {isExpanded ? 'Show less' : 'Read more...'}
            </Button>
          </HStack>
        )}
      </Box>
    )
  },
)

MarkdownDescription.displayName = 'MarkdownDescription'
