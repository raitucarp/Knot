package workspace

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Service provides workspace and filesystem operations to the frontend.
type Service struct {
	app     *application.App
	storage *Storage
}

// NewService creates a new Workspace Service instance.
func NewService(app *application.App) *Service {
	storage, err := NewStorage()
	if err != nil {
		fmt.Printf("[WorkspaceService] Warning initializing storage: %v\n", err)
	}
	return &Service{
		app:     app,
		storage: storage,
	}
}

// SetApp allows injecting or updating the Wails application reference.
func (s *Service) SetApp(app *application.App) {
	s.app = app
}

// OpenDirectoryDialog opens a native folder selection dialog and records recent history.
func (s *Service) OpenDirectoryDialog() (string, error) {
	if s.app == nil || s.app.Dialog == nil {
		return "", fmt.Errorf("dialog manager is not initialized")
	}

	dlg := s.app.Dialog.OpenFile()
	dlg.CanChooseDirectories(true)
	dlg.CanChooseFiles(false)
	dlg.SetTitle("Open Directory")

	if s.app.Window != nil && s.app.Window.Current() != nil {
		dlg.AttachToWindow(s.app.Window.Current())
	}

	path, err := dlg.PromptForSingleSelection()
	if err != nil {
		// User cancellation or dialog dismiss
		return "", nil
	}

	cleanPath := strings.TrimSpace(path)
	if cleanPath == "" {
		return "", nil
	}

	if s.storage != nil {
		_, _ = s.storage.AddRecentFolder(cleanPath)
	}

	return cleanPath, nil
}

// OpenFileDialog opens a native file selection dialog and records recent history.
func (s *Service) OpenFileDialog() (string, error) {
	if s.app == nil || s.app.Dialog == nil {
		return "", fmt.Errorf("dialog manager is not initialized")
	}

	dlg := s.app.Dialog.OpenFile()
	dlg.CanChooseDirectories(false)
	dlg.CanChooseFiles(true)
	dlg.SetTitle("Open File")

	if s.app.Window != nil && s.app.Window.Current() != nil {
		dlg.AttachToWindow(s.app.Window.Current())
	}

	path, err := dlg.PromptForSingleSelection()
	if err != nil {
		// User cancellation or dialog dismiss
		return "", nil
	}

	cleanPath := strings.TrimSpace(path)
	if cleanPath == "" {
		return "", nil
	}

	if s.storage != nil {
		_, _ = s.storage.AddRecentFile(cleanPath)
	}

	return cleanPath, nil
}

// ReadDirectory lists immediate child directories and files inside dirPath.
func (s *Service) ReadDirectory(dirPath string) ([]FileEntry, error) {
	cleanPath := filepath.Clean(dirPath)
	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory '%s': %w", cleanPath, err)
	}

	results := make([]FileEntry, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		// Filter out noisy meta directories like .git
		if name == ".git" {
			continue
		}

		fullPath := filepath.Join(cleanPath, name)
		isDir := entry.IsDir()
		var size int64
		ext := ""
		childrenCount := 0

		if isDir {
			// Quick shallow count of children for UI badge
			if subEntries, subErr := os.ReadDir(fullPath); subErr == nil {
				for _, se := range subEntries {
					if se.Name() != ".git" {
						childrenCount++
					}
				}
			}
		} else {
			ext = strings.ToLower(filepath.Ext(name))
			if info, err := entry.Info(); err == nil {
				size = info.Size()
			}
		}

		results = append(results, FileEntry{
			Name:          name,
			Path:          fullPath,
			IsDir:         isDir,
			Size:          size,
			Extension:     ext,
			ChildrenCount: childrenCount,
		})
	}

	// Sort: Directories first (A-Z), then Files (A-Z)
	sort.Slice(results, func(i, j int) bool {
		if results[i].IsDir != results[j].IsDir {
			return results[i].IsDir // directories first
		}
		return strings.ToLower(results[i].Name) < strings.ToLower(results[j].Name)
	})

	return results, nil
}

// ReadFileContent reads text content of a file (up to 1MB) for inspection/preview.
func (s *Service) ReadFileContent(filePath string) (string, error) {
	cleanPath := filepath.Clean(filePath)
	f, err := os.Open(cleanPath)
	if err != nil {
		return "", fmt.Errorf("failed to open file '%s': %w", cleanPath, err)
	}
	defer f.Close()

	// Read up to 1MB
	const maxBytes = 1024 * 1024
	lr := io.LimitReader(f, maxBytes)
	content, err := io.ReadAll(lr)
	if err != nil {
		return "", fmt.Errorf("failed to read file '%s': %w", cleanPath, err)
	}

	return string(content), nil
}

// GetAppState returns recent history and workspace memory from local persistent storage.
func (s *Service) GetAppState() (*AppState, error) {
	if s.storage == nil {
		return NewDefaultAppState(), nil
	}
	return s.storage.Load()
}

// AddRecentFolder adds a directory to recent folders.
func (s *Service) AddRecentFolder(dirPath string) (*AppState, error) {
	if s.storage == nil {
		return NewDefaultAppState(), nil
	}
	return s.storage.AddRecentFolder(dirPath)
}

// AddRecentFile adds a file to recent files.
func (s *Service) AddRecentFile(filePath string) (*AppState, error) {
	if s.storage == nil {
		return NewDefaultAppState(), nil
	}
	return s.storage.AddRecentFile(filePath)
}

// AddRecentWorkspace adds or updates a multi-folder workspace in recent history.
func (s *Service) AddRecentWorkspace(name string, folders []string) (*AppState, error) {
	if s.storage == nil {
		return NewDefaultAppState(), nil
	}
	return s.storage.AddRecentWorkspace(name, folders)
}

// ClearRecent clears a specific category from recent history.
func (s *Service) ClearRecent(category string) (*AppState, error) {
	if s.storage == nil {
		return NewDefaultAppState(), nil
	}
	return s.storage.ClearRecent(category)
}

// WriteFileContent writes or overwrites content to a physical file on disk.
func (s *Service) WriteFileContent(filePath string, content string) error {
	cleanPath := filepath.Clean(filePath)
	return os.WriteFile(cleanPath, []byte(content), 0644)
}

// RenamePath renames a file or directory on disk and updates storage if needed.
func (s *Service) RenamePath(oldPath string, newPath string) error {
	cleanOld := filepath.Clean(oldPath)
	cleanNew := filepath.Clean(newPath)

	if err := os.Rename(cleanOld, cleanNew); err != nil {
		return fmt.Errorf("failed to rename %q to %q: %w", cleanOld, cleanNew, err)
	}

	if s.storage != nil {
		state, err := s.storage.Load()
		if err == nil && state != nil {
			changed := false
			for i, f := range state.RecentFiles {
				if filepath.Clean(f.Path) == cleanOld {
					state.RecentFiles[i].Path = cleanNew
					state.RecentFiles[i].Name = filepath.Base(cleanNew)
					changed = true
				}
			}
			for i, d := range state.RecentFolders {
				if filepath.Clean(d.Path) == cleanOld {
					state.RecentFolders[i].Path = cleanNew
					state.RecentFolders[i].Name = filepath.Base(cleanNew)
					changed = true
				}
			}
			if changed {
				_ = s.storage.Save(state)
			}
		}
	}

	return nil
}

