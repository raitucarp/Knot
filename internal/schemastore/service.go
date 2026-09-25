package schemastore

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

//go:embed all:embedded
var embeddedFS embed.FS

// CatalogEntry represents a schema entry in SchemaStore catalog.json
type CatalogEntry struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	FileMatch   []string `json:"fileMatch"`
	URL         string   `json:"url"`
}

// Catalog represents the SchemaStore catalog root structure
type Catalog struct {
	Schemas []CatalogEntry `json:"schemas"`
}

// FileSchemaInfo contains metadata and mapped property descriptions for a matched file
type FileSchemaInfo struct {
	SchemaName  string            `json:"schemaName"`
	Description string            `json:"description"`
	URL         string            `json:"url"`
	Properties  map[string]string `json:"properties"` // path ("compilerOptions/declaration") -> description
}

// Service manages SchemaStore matching, resolution, and caching
type Service struct {
	mu           sync.RWMutex
	catalog      *Catalog
	schemaCache  map[string]map[string]any // urlOrName -> raw schema object
	infoCache    map[string]*FileSchemaInfo
	cacheDir     string
	httpClient   *http.Client
}

var (
	globalService *Service
	once          sync.Once
)

// GetService returns the singleton SchemaStore service
func GetService() *Service {
	once.Do(func() {
		globalService = NewService()
	})
	return globalService
}

// NewService creates a new SchemaStore Service
func NewService() *Service {
	homeDir, err := os.UserHomeDir()
	var cacheDir string
	if err == nil {
		cacheDir = filepath.Join(homeDir, ".knot", "schemastore")
		_ = os.MkdirAll(cacheDir, 0755)
	}

	s := &Service{
		schemaCache: make(map[string]map[string]any),
		infoCache:   make(map[string]*FileSchemaInfo),
		cacheDir:    cacheDir,
		httpClient: &http.Client{
			Timeout: 4 * time.Second,
		},
	}

	s.loadCatalog()
	return s
}

func (s *Service) loadCatalog() {
	data, err := embeddedFS.ReadFile("embedded/catalog.json")
	if err != nil {
		fmt.Printf("[SchemaStore] Warning: failed to read embedded catalog: %v\n", err)
		return
	}

	var cat Catalog
	if err := json.Unmarshal(data, &cat); err != nil {
		fmt.Printf("[SchemaStore] Warning: failed to parse catalog: %v\n", err)
		return
	}

	s.catalog = &cat
}

var schemaRegex = regexp.MustCompile(`"\$schema"\s*:\s*"([^"]+)"`)

// GetCachedSchemaInfo returns schema information if already matched/cached
func (s *Service) GetCachedSchemaInfo(filePath string) *FileSchemaInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.infoCache[filePath]
}

// MatchFileSchema inspects a file name and optional content to find a matching JSON Schema
func (s *Service) MatchFileSchema(filePath string, sourceCode []byte) *FileSchemaInfo {
	s.mu.RLock()
	if info, ok := s.infoCache[filePath]; ok {
		s.mu.RUnlock()
		return info
	}
	s.mu.RUnlock()

	fileName := filepath.Base(filePath)
	cleanFileName := strings.ToLower(fileName)

	var matchedURL string
	var matchedName string
	var matchedDesc string

	// 1. Check for explicit "$schema" in file content
	if len(sourceCode) > 0 {
		matches := schemaRegex.FindSubmatch(sourceCode)
		if len(matches) > 1 {
			matchedURL = string(matches[1])
			matchedName = fileName
		}
	}

	// 2. If no $schema, match against catalog.json
	if matchedURL == "" && s.catalog != nil {
		for _, item := range s.catalog.Schemas {
			for _, pattern := range item.FileMatch {
				patternLower := strings.ToLower(pattern)
				// Glob match
				if match, _ := filepath.Match(patternLower, cleanFileName); match {
					matchedURL = item.URL
					matchedName = item.Name
					matchedDesc = item.Description
					break
				}
				// Also check exact suffix match if pattern starts with *
				if strings.HasPrefix(patternLower, "*") && strings.HasSuffix(cleanFileName, strings.TrimPrefix(patternLower, "*")) {
					matchedURL = item.URL
					matchedName = item.Name
					matchedDesc = item.Description
					break
				}
			}
			if matchedURL != "" {
				break
			}
		}
	}

	if matchedURL == "" {
		return nil
	}

	// Load schema data
	rawSchema := s.loadSchema(matchedURL, matchedName, fileName)
	if rawSchema == nil {
		return nil
	}

	if matchedDesc == "" {
		if desc, ok := rawSchema["description"].(string); ok {
			matchedDesc = desc
		} else if title, ok := rawSchema["title"].(string); ok {
			matchedDesc = title
		}
	}

	// Flatten all property descriptions
	propMap := make(map[string]string)
	s.flattenSchemaProperties(rawSchema, rawSchema, "", propMap, make(map[string]bool), 0)

	info := &FileSchemaInfo{
		SchemaName:  matchedName,
		Description: cleanBannerDescription(matchedDesc),
		URL:         matchedURL,
		Properties:  propMap,
	}

	s.mu.Lock()
	s.infoCache[filePath] = info
	s.mu.Unlock()

	return info
}

func (s *Service) loadSchema(url, schemaName, fileName string) map[string]any {
	s.mu.RLock()
	if sObj, ok := s.schemaCache[url]; ok {
		s.mu.RUnlock()
		return sObj
	}
	s.mu.RUnlock()

	// 1. Try embedded schemas by filename / name
	candidates := []string{
		fileName,
		strings.ToLower(fileName),
		schemaName,
		strings.ToLower(schemaName),
		strings.TrimSuffix(strings.ToLower(fileName), ".json") + ".json",
	}

	if strings.Contains(strings.ToLower(fileName), "tsconfig") {
		candidates = append(candidates, "tsconfig.json")
	} else if strings.Contains(strings.ToLower(fileName), "package") {
		candidates = append(candidates, "package.json")
	} else if strings.Contains(strings.ToLower(fileName), "prettier") {
		candidates = append(candidates, "prettierrc.json")
	} else if strings.Contains(strings.ToLower(fileName), "eslint") {
		candidates = append(candidates, "eslintrc.json")
	}

	for _, cand := range candidates {
		if cand == "" {
			continue
		}
		embedPath := "embedded/schemas/" + cand
		data, err := embeddedFS.ReadFile(embedPath)
		if err == nil {
			var parsed map[string]any
			if err := json.Unmarshal(data, &parsed); err == nil {
				s.mu.Lock()
				s.schemaCache[url] = parsed
				s.mu.Unlock()
				return parsed
			}
		}
	}

	// 2. Try disk cache
	if s.cacheDir != "" {
		sanitized := sanitizeURLFilename(url)
		diskPath := filepath.Join(s.cacheDir, sanitized)
		if data, err := os.ReadFile(diskPath); err == nil {
			var parsed map[string]any
			if err := json.Unmarshal(data, &parsed); err == nil {
				s.mu.Lock()
				s.schemaCache[url] = parsed
				s.mu.Unlock()
				return parsed
			}
		}
	}

	// 3. Try HTTP GET if online
	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		resp, err := s.httpClient.Get(url)
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			data, err := io.ReadAll(resp.Body)
			if err == nil {
				var parsed map[string]any
				if err := json.Unmarshal(data, &parsed); err == nil {
					// Save to disk cache
					if s.cacheDir != "" {
						_ = os.WriteFile(filepath.Join(s.cacheDir, sanitizeURLFilename(url)), data, 0644)
					}
					s.mu.Lock()
					s.schemaCache[url] = parsed
					s.mu.Unlock()
					return parsed
				}
			}
		}
	}

	return nil
}

// flattenSchemaProperties extracts property descriptions recursively into path -> description
func (s *Service) flattenSchemaProperties(rootSchema, currentSchema map[string]any, prefix string, out map[string]string, visitedRefs map[string]bool, depth int) {
	if currentSchema == nil || depth > 8 {
		return
	}

	// If current schema has a $ref, resolve it first
	if refVal, ok := currentSchema["$ref"].(string); ok {
		if visitedRefs[refVal] {
			return
		}
		visitedRefs[refVal] = true
		resolved := s.resolveRef(rootSchema, refVal)
		if resolved != nil {
			s.flattenSchemaProperties(rootSchema, resolved, prefix, out, visitedRefs, depth+1)
		}
	}

	// Handle allOf
	if allOf, ok := currentSchema["allOf"].([]any); ok {
		for _, item := range allOf {
			if itemMap, ok := item.(map[string]any); ok {
				s.flattenSchemaProperties(rootSchema, itemMap, prefix, out, visitedRefs, depth+1)
			}
		}
	}

	// Handle anyOf
	if anyOf, ok := currentSchema["anyOf"].([]any); ok {
		for _, item := range anyOf {
			if itemMap, ok := item.(map[string]any); ok {
				s.flattenSchemaProperties(rootSchema, itemMap, prefix, out, visitedRefs, depth+1)
			}
		}
	}

	// Handle oneOf
	if oneOf, ok := currentSchema["oneOf"].([]any); ok {
		for _, item := range oneOf {
			if itemMap, ok := item.(map[string]any); ok {
				s.flattenSchemaProperties(rootSchema, itemMap, prefix, out, visitedRefs, depth+1)
			}
		}
	}

	// Handle properties
	if props, ok := currentSchema["properties"].(map[string]any); ok {
		for propKey, propDefRaw := range props {
			propDef, ok := propDefRaw.(map[string]any)
			if !ok {
				continue
			}

			propPath := propKey
			if prefix != "" {
				propPath = prefix + "/" + propKey
			}

			// If propDef has a $ref, resolve it
			activeDef := propDef
			if refVal, ok := propDef["$ref"].(string); ok {
				if !visitedRefs[refVal] {
					visitedRefs[refVal] = true
					if resolved := s.resolveRef(rootSchema, refVal); resolved != nil {
						activeDef = resolved
					}
				}
			}

			// Extract description
			desc := ""
			if d, ok := propDef["description"].(string); ok && d != "" {
				desc = d
			} else if d, ok := propDef["markdownDescription"].(string); ok && d != "" {
				desc = d
			} else if d, ok := activeDef["description"].(string); ok && d != "" {
				desc = d
			} else if d, ok := activeDef["markdownDescription"].(string); ok && d != "" {
				desc = d
			}

			if desc != "" {
				out[propPath] = cleanDescription(desc)
			}

			// Recurse into child properties
			s.flattenSchemaProperties(rootSchema, activeDef, propPath, out, visitedRefs, depth+1)

			// Also check items (for array of objects)
			if items, ok := activeDef["items"].(map[string]any); ok {
				s.flattenSchemaProperties(rootSchema, items, propPath, out, visitedRefs, depth+1)
			}
		}
	}
}

// resolveRef resolves a local JSON Schema reference like "#/definitions/..."
func (s *Service) resolveRef(root map[string]any, ref string) map[string]any {
	if !strings.HasPrefix(ref, "#/") {
		return nil
	}
	parts := strings.Split(strings.TrimPrefix(ref, "#/"), "/")
	var current any = root
	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current = m[part]
		if current == nil {
			return nil
		}
	}
	res, _ := current.(map[string]any)
	return res
}

func sanitizeURLFilename(url string) string {
	r := strings.NewReplacer("https://", "", "http://", "", "/", "_", ":", "_", "?", "_", "&", "_", "=", "_")
	return r.Replace(url) + ".json"
}

// cleanBannerDescription collapses whitespace for single-line header banners
func cleanBannerDescription(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.ReplaceAll(s, "\r\n", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	fields := strings.Fields(s)
	return strings.Join(fields, " ")
}

// cleanDescription normalizes line endings and trims whitespace while preserving markdown formatting
func cleanDescription(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.ReplaceAll(s, "\r\n", "\n")
	if strings.Contains(s, `\n`) {
		s = strings.ReplaceAll(s, `\r\n`, "\n")
		s = strings.ReplaceAll(s, `\n`, "\n")
	}
	return s
}
