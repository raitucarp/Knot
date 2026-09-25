package parser

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unsafe"

	"github.com/ebitengine/purego"
	tree_sitter "github.com/tree-sitter/go-tree-sitter"
)

// GrammarLoader handles dynamic loading of tree-sitter grammars from shared libraries (.dll, .so, .dylib)
type GrammarLoader struct {
	mu      sync.RWMutex
	handles map[string]uintptr
	langs   map[string]*tree_sitter.Language
}

// NewGrammarLoader creates a new GrammarLoader.
func NewGrammarLoader() *GrammarLoader {
	return &GrammarLoader{
		handles: make(map[string]uintptr),
		langs:   make(map[string]*tree_sitter.Language),
	}
}

// LoadGrammar loads a tree-sitter grammar from a shared library at runtime via purego.
// libPath: path to shared library (e.g. "grammars/tree-sitter-go.dll")
// langName: language name (e.g. "go", "json", "python") which maps to symbol "tree_sitter_<langName>"
func (g *GrammarLoader) LoadGrammar(libPath string, langName string) (*tree_sitter.Language, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if lang, exists := g.langs[langName]; exists {
		return lang, nil
	}

	handle, err := openSharedLibrary(libPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open grammar shared library %q: %w", libPath, err)
	}

	symbolName := "tree_sitter_" + strings.ReplaceAll(langName, "-", "_")

	var fn func() unsafe.Pointer
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("symbol %s not found in %s: %v", symbolName, libPath, r)
		}
	}()

	purego.RegisterLibFunc(&fn, handle, symbolName)
	if fn == nil {
		return nil, errors.New("failed to register symbol function")
	}

	ptr := fn()
	if ptr == nil {
		return nil, fmt.Errorf("symbol function %s returned nil pointer", symbolName)
	}

	lang := tree_sitter.NewLanguage(ptr)
	if lang == nil {
		return nil, fmt.Errorf("failed to create tree_sitter.Language from pointer")
	}

	g.handles[langName] = handle
	g.langs[langName] = lang
	return lang, nil
}

// FindGrammarPath searches standard candidate locations for tree-sitter shared libraries.
func FindGrammarPath(langName string) (string, error) {
	normName := strings.ToLower(langName)
	libName := fmt.Sprintf("tree-sitter-%s.dll", normName)

	candidates := []string{
		filepath.Join("grammars", libName),
		filepath.Join("bin", "grammars", libName),
		libName,
	}

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		candidates = append(candidates,
			filepath.Join(exeDir, "grammars", libName),
			filepath.Join(exeDir, libName),
			filepath.Join(exeDir, "..", "grammars", libName),
		)
	}

	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p, nil
		}
	}

	return "", fmt.Errorf("grammar shared library for %q not found (searched %v)", langName, candidates)
}

// GetOrLoadGrammar retrieves an already loaded grammar or automatically locates and loads it.
func (g *GrammarLoader) GetOrLoadGrammar(langName string) (*tree_sitter.Language, error) {
	if lang, ok := g.GetLanguage(langName); ok {
		return lang, nil
	}

	path, err := FindGrammarPath(langName)
	if err != nil {
		return nil, err
	}

	return g.LoadGrammar(path, langName)
}

// GetLanguage returns a previously loaded language grammar.
func (g *GrammarLoader) GetLanguage(langName string) (*tree_sitter.Language, bool) {
	g.mu.RLock()
	defer g.mu.RUnlock()
	lang, ok := g.langs[langName]
	return lang, ok
}

// Close closes all loaded shared libraries.
func (g *GrammarLoader) Close() {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, handle := range g.handles {
		_ = closeSharedLibrary(handle)
	}
	g.handles = make(map[string]uintptr)
	g.langs = make(map[string]*tree_sitter.Language)
}
