package parser

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/raitucarp/knot/internal/schemastore"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

// ASTSummary represents the simplified AST result sent to frontend
type ASTSummary struct {
	Language  string `json:"language"`
	RootType  string `json:"rootType"`
	NodeCount int    `json:"nodeCount"`
	HasErrors bool   `json:"hasErrors"`
	SExpr     string `json:"sexpr"`
}

// ASTNodeData represents an individual AST node for the visual canvas
type ASTNodeData struct {
	ID          string        `json:"id"`
	Kind        string        `json:"kind"`
	Type        string        `json:"type"` // "string", "number", "boolean", "string_array", "array", "object", "function", "variable", "import", "other"
	Key         string        `json:"key"`
	Value       any           `json:"value"`
	RawText     string        `json:"rawText"`
	Description string        `json:"description,omitempty"`
	StartLine   int           `json:"startLine"`
	EndLine     int           `json:"endLine"`
	StartByte   uint32        `json:"startByte"`
	EndByte     uint32        `json:"endByte"`
	Children    []ASTNodeData `json:"children,omitempty"`
}

// FileASTResult is the complete parsed AST response for a file
type FileASTResult struct {
	FilePath         string            `json:"filePath"`
	Language         string            `json:"language"`
	RootKind         string            `json:"rootKind"`
	Nodes            []ASTNodeData     `json:"nodes"`
	Description      string            `json:"description,omitempty"`
	SchemaName       string            `json:"schemaName,omitempty"`
	SchemaURL        string            `json:"schemaUrl,omitempty"`
	SchemaProperties map[string]string `json:"schemaProperties,omitempty"`
	Error            string            `json:"error,omitempty"`
}

// ParserService provides AST parsing via Tree-sitter for Wails v3
type ParserService struct {
	loader *GrammarLoader
	parser *tree_sitter.Parser
}

// NewParserService creates a new ParserService
func NewParserService() *ParserService {
	return &ParserService{
		loader: NewGrammarLoader(),
		parser: tree_sitter.NewParser(),
	}
}

// LoadGrammar loads a shared library grammar (.dll/.so/.dylib) dynamically via purego
func (s *ParserService) LoadGrammar(libPath string, langName string) (bool, error) {
	_, err := s.loader.LoadGrammar(libPath, langName)
	if err != nil {
		return false, err
	}
	return true, nil
}

// ParseCode parses source code with a loaded language grammar
func (s *ParserService) ParseCode(langName string, sourceCode string) (*ASTSummary, error) {
	lang, err := s.loader.GetOrLoadGrammar(langName)
	if err != nil {
		return nil, fmt.Errorf("failed to get or load language grammar %q: %w", langName, err)
	}

	err = s.parser.SetLanguage(lang)
	if err != nil {
		return nil, fmt.Errorf("failed to set language %q on parser: %w", langName, err)
	}

	tree := s.parser.Parse([]byte(sourceCode), nil)
	if tree == nil {
		return nil, errors.New("failed to parse code: parser returned nil tree")
	}
	defer tree.Close()

	root := tree.RootNode()
	if root == nil {
		return nil, errors.New("root node is nil")
	}

	summary := &ASTSummary{
		Language:  langName,
		RootType:  root.Kind(),
		NodeCount: int(root.ChildCount()),
		HasErrors: root.HasError(),
		SExpr:     root.ToSexp(),
	}

	return summary, nil
}

// ParseFile reads and parses a source file into structured AST nodes for Knot canvas
func (s *ParserService) ParseFile(filePath string) (*FileASTResult, error) {
	cleanPath := filepath.Clean(filePath)
	sourceBytes, err := os.ReadFile(cleanPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %q: %w", cleanPath, err)
	}

	langName := detectLanguage(cleanPath)
	lang, err := s.loader.GetOrLoadGrammar(langName)
	if err != nil {
		return nil, fmt.Errorf("failed to load tree-sitter grammar for %q (%s): %w", cleanPath, langName, err)
	}

	if err := s.parser.SetLanguage(lang); err != nil {
		return nil, fmt.Errorf("failed to set language %q on parser: %w", langName, err)
	}

	tree := s.parser.Parse(sourceBytes, nil)
	if tree == nil {
		return nil, errors.New("tree-sitter parser returned nil tree")
	}
	defer tree.Close()

	root := tree.RootNode()
	if root == nil {
		return nil, errors.New("root node is nil")
	}

	var nodes []ASTNodeData
	var fileDesc string
	var schemaName string
	var schemaURL string
	var schemaProps map[string]string

	switch langName {
	case "json":
		schemaInfo := schemastore.GetService().MatchFileSchema(cleanPath, sourceBytes)
		if schemaInfo != nil {
			fileDesc = schemaInfo.Description
			schemaName = schemaInfo.SchemaName
			schemaURL = schemaInfo.URL
			schemaProps = schemaInfo.Properties
		}
		nodes = extractJSONAST(cleanPath, root, sourceBytes, schemaProps)
	case "javascript", "typescript":
		nodes = extractJavaScriptAST(cleanPath, root, sourceBytes)
	default:
		nodes = extractGenericAST(cleanPath, root, sourceBytes)
	}

	return &FileASTResult{
		FilePath:         cleanPath,
		Language:         langName,
		RootKind:         root.Kind(),
		Nodes:            nodes,
		Description:      fileDesc,
		SchemaName:       schemaName,
		SchemaURL:        schemaURL,
		SchemaProperties: schemaProps,
	}, nil
}

// GetPropertyDescription looks up the schema description for a given key path in a file
func (s *ParserService) GetPropertyDescription(filePath string, keyPath []string) string {
	cleanPath := filepath.Clean(filePath)
	schemaInfo := schemastore.GetService().GetCachedSchemaInfo(cleanPath)
	if schemaInfo == nil || schemaInfo.Properties == nil {
		return ""
	}
	path := strings.Join(keyPath, "/")
	return lookupSchemaDescription(schemaInfo.Properties, path)
}

// SaveFileContent writes updated content back to the physical file on disk
func (s *ParserService) SaveFileContent(filePath string, content string) error {
	cleanPath := filepath.Clean(filePath)
	return os.WriteFile(cleanPath, []byte(content), 0644)
}

// Close cleans up resources
func (s *ParserService) Close() {
	if s.parser != nil {
		s.parser.Close()
	}
	if s.loader != nil {
		s.loader.Close()
	}
}

// Helper functions

func detectLanguage(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".json":
		return "json"
	case ".js", ".mjs", ".cjs":
		return "javascript"
	case ".ts", ".tsx":
		return "typescript"
	case ".go":
		return "go"
	case ".py":
		return "python"
	case ".html":
		return "html"
	case ".c", ".h":
		return "c"
	case ".cpp", ".cc", ".hpp":
		return "cpp"
	default:
		return strings.TrimPrefix(ext, ".")
	}
}

var nonAlphaNum = regexp.MustCompile(`[^a-zA-Z0-9_-]`)

func sanitizeID(input string) string {
	return nonAlphaNum.ReplaceAllString(input, "_")
}

var arrayIndexRegex = regexp.MustCompile(`/?\[\d+\]`)

func lookupSchemaDescription(schemaProps map[string]string, keyPath string) string {
	if schemaProps == nil || keyPath == "" {
		return ""
	}
	if desc, ok := schemaProps[keyPath]; ok && desc != "" {
		return desc
	}
	normalized := arrayIndexRegex.ReplaceAllString(keyPath, "")
	normalized = strings.Trim(normalized, "/")
	if desc, ok := schemaProps[normalized]; ok && desc != "" {
		return desc
	}
	return ""
}

func extractJSONAST(filePath string, root *tree_sitter.Node, sourceCode []byte, schemaProps map[string]string) []ASTNodeData {
	var nodes []ASTNodeData

	// Find the top-level object
	var obj *tree_sitter.Node
	if root.Kind() == "document" {
		for i := uint(0); i < root.NamedChildCount(); i++ {
			c := root.NamedChild(i)
			if c.Kind() == "object" {
				obj = c
				break
			}
		}
	} else if root.Kind() == "object" {
		obj = root
	}

	if obj == nil {
		return nodes
	}

	for i := uint(0); i < obj.NamedChildCount(); i++ {
		pair := obj.NamedChild(i)
		if pair.Kind() != "pair" {
			continue
		}

		keyNode := pair.ChildByFieldName("key")
		valNode := pair.ChildByFieldName("value")
		if keyNode == nil || valNode == nil {
			continue
		}

		rawKey := string(sourceCode[keyNode.StartByte():keyNode.EndByte()])
		key := strings.Trim(rawKey, "\"")
		curPath := key

		rawVal := string(sourceCode[valNode.StartByte():valNode.EndByte()])
		valKind := valNode.Kind()

		nodeType := "other"
		var val any = rawVal
		var subChildren []ASTNodeData

		switch valKind {
		case "string":
			nodeType = "string"
			var s string
			if err := json.Unmarshal([]byte(rawVal), &s); err == nil {
				val = s
			} else {
				val = strings.Trim(rawVal, "\"")
			}
		case "number":
			nodeType = "number"
			var num float64
			if err := json.Unmarshal([]byte(rawVal), &num); err == nil {
				val = num
			}
		case "true", "false":
			nodeType = "boolean"
			val = (valKind == "true")
		case "null":
			nodeType = "null"
			val = nil
		case "array":
			childCount := valNode.NamedChildCount()
			hasObjects := false
			if childCount > 0 {
				hasObjects = true
				for a := uint(0); a < childCount; a++ {
					if valNode.NamedChild(a).Kind() != "object" {
						hasObjects = false
						break
					}
				}
			}

			if hasObjects {
				nodeType = "object_array"
				var arr []any
				_ = json.Unmarshal([]byte(rawVal), &arr)
				val = arr

				for a := uint(0); a < childCount; a++ {
					elem := valNode.NamedChild(a)
					elemKey := fmt.Sprintf("[%d]", a)
					elemPath := fmt.Sprintf("%s/[%d]", curPath, a)
					rawElem := string(sourceCode[elem.StartByte():elem.EndByte()])
					var elemVal map[string]any
					_ = json.Unmarshal([]byte(rawElem), &elemVal)

					objChildren := extractJSONObjectPairs(filePath, elem, fmt.Sprintf("%s_%d", key, a), elemPath, sourceCode, schemaProps)
					elemNodeID := fmt.Sprintf("ast_%s_%s_%d", sanitizeID(filePath), sanitizeID(key), a)
					subChildren = append(subChildren, ASTNodeData{
						ID:          elemNodeID,
						Kind:        "object",
						Type:        "object",
						Key:         elemKey,
						Value:       elemVal,
						RawText:     rawElem,
						Description: lookupSchemaDescription(schemaProps, elemPath),
						StartLine:   int(elem.StartPosition().Row) + 1,
						EndLine:     int(elem.EndPosition().Row) + 1,
						StartByte:   uint32(elem.StartByte()),
						EndByte:     uint32(elem.EndByte()),
						Children:    objChildren,
					})
				}
			} else {
				nodeType = "array"
				var arr []any
				if err := json.Unmarshal([]byte(rawVal), &arr); err == nil {
					val = arr
				} else {
					val = []any{}
				}
			}
		case "object":
			nodeType = "object"
			var m map[string]any
			_ = json.Unmarshal([]byte(rawVal), &m)
			val = m
			subChildren = extractJSONObjectPairs(filePath, valNode, key, curPath, sourceCode, schemaProps)
		}

		nodeID := fmt.Sprintf("ast_%s_%s", sanitizeID(filePath), sanitizeID(key))
		nodes = append(nodes, ASTNodeData{
			ID:          nodeID,
			Kind:        valKind,
			Type:        nodeType,
			Key:         key,
			Value:       val,
			RawText:     rawVal,
			Description: lookupSchemaDescription(schemaProps, curPath),
			StartLine:   int(pair.StartPosition().Row) + 1,
			EndLine:     int(pair.EndPosition().Row) + 1,
			StartByte:   uint32(pair.StartByte()),
			EndByte:     uint32(pair.EndByte()),
			Children:    subChildren,
		})
	}

	return nodes
}

func extractJSONObjectPairs(filePath string, objNode *tree_sitter.Node, parentKey string, parentPath string, sourceCode []byte, schemaProps map[string]string) []ASTNodeData {
	var children []ASTNodeData
	for i := uint(0); i < objNode.NamedChildCount(); i++ {
		pair := objNode.NamedChild(i)
		if pair.Kind() != "pair" {
			continue
		}

		keyNode := pair.ChildByFieldName("key")
		valNode := pair.ChildByFieldName("value")
		if keyNode == nil || valNode == nil {
			continue
		}

		rawKey := string(sourceCode[keyNode.StartByte():keyNode.EndByte()])
		key := strings.Trim(rawKey, "\"")
		curPath := key
		if parentPath != "" {
			curPath = parentPath + "/" + key
		}

		rawVal := string(sourceCode[valNode.StartByte():valNode.EndByte()])
		valKind := valNode.Kind()

		nodeType := "other"
		var val any = rawVal
		var subChildren []ASTNodeData

		switch valKind {
		case "string":
			nodeType = "string"
			var s string
			if err := json.Unmarshal([]byte(rawVal), &s); err == nil {
				val = s
			} else {
				val = strings.Trim(rawVal, "\"")
			}
		case "number":
			nodeType = "number"
			var num float64
			if err := json.Unmarshal([]byte(rawVal), &num); err == nil {
				val = num
			}
		case "true", "false":
			nodeType = "boolean"
			val = (valKind == "true")
		case "null":
			nodeType = "null"
			val = nil
		case "array":
			childCount := valNode.NamedChildCount()
			hasObjects := false
			if childCount > 0 {
				hasObjects = true
				for a := uint(0); a < childCount; a++ {
					if valNode.NamedChild(a).Kind() != "object" {
						hasObjects = false
						break
					}
				}
			}

			if hasObjects {
				nodeType = "object_array"
				var arr []any
				_ = json.Unmarshal([]byte(rawVal), &arr)
				val = arr

				for a := uint(0); a < childCount; a++ {
					elem := valNode.NamedChild(a)
					elemKey := fmt.Sprintf("[%d]", a)
					elemPath := fmt.Sprintf("%s/[%d]", curPath, a)
					rawElem := string(sourceCode[elem.StartByte():elem.EndByte()])
					var elemVal map[string]any
					_ = json.Unmarshal([]byte(rawElem), &elemVal)

					objChildren := extractJSONObjectPairs(filePath, elem, fmt.Sprintf("%s_%s_%d", parentKey, key, a), elemPath, sourceCode, schemaProps)
					elemNodeID := fmt.Sprintf("ast_%s_%s_%s_%d", sanitizeID(filePath), sanitizeID(parentKey), sanitizeID(key), a)
					subChildren = append(subChildren, ASTNodeData{
						ID:          elemNodeID,
						Kind:        "object",
						Type:        "object",
						Key:         elemKey,
						Value:       elemVal,
						RawText:     rawElem,
						Description: lookupSchemaDescription(schemaProps, elemPath),
						StartLine:   int(elem.StartPosition().Row) + 1,
						EndLine:     int(elem.EndPosition().Row) + 1,
						StartByte:   uint32(elem.StartByte()),
						EndByte:     uint32(elem.EndByte()),
						Children:    objChildren,
					})
				}
			} else {
				nodeType = "array"
				var arr []any
				if err := json.Unmarshal([]byte(rawVal), &arr); err == nil {
					val = arr
				} else {
					val = []any{}
				}
			}
		case "object":
			nodeType = "object"
			var m map[string]any
			_ = json.Unmarshal([]byte(rawVal), &m)
			val = m
			subChildren = extractJSONObjectPairs(filePath, valNode, fmt.Sprintf("%s_%s", parentKey, key), curPath, sourceCode, schemaProps)
		}

		childID := fmt.Sprintf("ast_%s_%s_%s", sanitizeID(filePath), sanitizeID(parentKey), sanitizeID(key))
		children = append(children, ASTNodeData{
			ID:          childID,
			Kind:        valKind,
			Type:        nodeType,
			Key:         key,
			Value:       val,
			RawText:     rawVal,
			Description: lookupSchemaDescription(schemaProps, curPath),
			StartLine:   int(pair.StartPosition().Row) + 1,
			EndLine:     int(pair.EndPosition().Row) + 1,
			StartByte:   uint32(pair.StartByte()),
			EndByte:     uint32(pair.EndByte()),
			Children:    subChildren,
		})
	}
	return children
}

func extractJavaScriptAST(filePath string, root *tree_sitter.Node, sourceCode []byte) []ASTNodeData {
	var nodes []ASTNodeData

	for i := uint(0); i < root.NamedChildCount(); i++ {
		child := root.NamedChild(i)
		kind := child.Kind()
		rawText := string(sourceCode[child.StartByte():child.EndByte()])

		nodeType := "other"
		key := fmt.Sprintf("%s_%d", kind, i+1)

		switch kind {
		case "import_statement":
			nodeType = "import"
			key = "import"
			sourceNode := child.ChildByFieldName("source")
			if sourceNode != nil {
				key = fmt.Sprintf("import from %s", strings.Trim(string(sourceCode[sourceNode.StartByte():sourceNode.EndByte()]), `"'`))
			}
		case "function_declaration", "generator_function_declaration":
			nodeType = "function"
			nameNode := child.ChildByFieldName("name")
			if nameNode != nil {
				key = string(sourceCode[nameNode.StartByte():nameNode.EndByte()])
			}
		case "class_declaration":
			nodeType = "class"
			nameNode := child.ChildByFieldName("name")
			if nameNode != nil {
				key = string(sourceCode[nameNode.StartByte():nameNode.EndByte()])
			}
		case "lexical_declaration", "variable_declaration":
			nodeType = "variable"
			decl := child.NamedChild(0)
			if decl != nil && decl.Kind() == "variable_declarator" {
				nameNode := decl.ChildByFieldName("name")
				if nameNode != nil {
					key = string(sourceCode[nameNode.StartByte():nameNode.EndByte()])
				}
			}
		case "export_statement":
			nodeType = "export"
			key = "export"
		}

		nodeID := fmt.Sprintf("ast_%s_%s_%d", sanitizeID(filePath), sanitizeID(key), i)
		nodes = append(nodes, ASTNodeData{
			ID:        nodeID,
			Kind:      kind,
			Type:      nodeType,
			Key:       key,
			Value:     rawText,
			RawText:   rawText,
			StartLine: int(child.StartPosition().Row) + 1,
			EndLine:   int(child.EndPosition().Row) + 1,
			StartByte: uint32(child.StartByte()),
			EndByte:   uint32(child.EndByte()),
		})
	}

	return nodes
}

func extractGenericAST(filePath string, root *tree_sitter.Node, sourceCode []byte) []ASTNodeData {
	var nodes []ASTNodeData

	for i := uint(0); i < root.NamedChildCount(); i++ {
		child := root.NamedChild(i)
		rawText := string(sourceCode[child.StartByte():child.EndByte()])
		kind := child.Kind()
		nodeID := fmt.Sprintf("ast_%s_%d", sanitizeID(filePath), i)

		nodes = append(nodes, ASTNodeData{
			ID:        nodeID,
			Kind:      kind,
			Type:      "other",
			Key:       kind,
			Value:     rawText,
			RawText:   rawText,
			StartLine: int(child.StartPosition().Row) + 1,
			EndLine:   int(child.EndPosition().Row) + 1,
			StartByte: uint32(child.StartByte()),
			EndByte:   uint32(child.EndByte()),
		})
	}

	return nodes
}
