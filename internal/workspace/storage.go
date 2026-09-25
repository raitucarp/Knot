package workspace

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const maxRecentItems = 15

// Storage handles reading and writing AppState to the local user directory.
type Storage struct {
	mu       sync.Mutex
	filePath string
}

// NewStorage initializes a new Storage instance pointing to ~/.config/Knot/state.json or %APPDATA%/Knot/state.json.
func NewStorage() (*Storage, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		home, homeErr := os.UserHomeDir()
		if homeErr != nil {
			return nil, fmt.Errorf("failed to get user home or config dir: %w", err)
		}
		configDir = filepath.Join(home, ".config")
	}

	appDir := filepath.Join(configDir, "Knot")
	if err := os.MkdirAll(appDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory %s: %w", appDir, err)
	}

	return &Storage{
		filePath: filepath.Join(appDir, "state.json"),
	}, nil
}

// Load reads and parses the AppState from disk.
func (s *Storage) Load() (*AppState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			defaultState := NewDefaultAppState()
			return defaultState, nil
		}
		return nil, fmt.Errorf("failed to read state file: %w", err)
	}

	var state AppState
	if err := json.Unmarshal(data, &state); err != nil {
		return NewDefaultAppState(), nil
	}

	if state.RecentFiles == nil {
		state.RecentFiles = make([]RecentItem, 0)
	}
	if state.RecentFolders == nil {
		state.RecentFolders = make([]RecentItem, 0)
	}
	if state.RecentWorkspaces == nil {
		state.RecentWorkspaces = make([]WorkspaceConfig, 0)
	}

	return &state, nil
}

// Save writes the AppState to disk.
func (s *Storage) Save(state *AppState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal state: %w", err)
	}

	tmpFile := s.filePath + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write tmp state file: %w", err)
	}

	if err := os.Rename(tmpFile, s.filePath); err != nil {
		_ = os.Remove(tmpFile)
		return fmt.Errorf("failed to replace state file: %w", err)
	}

	return nil
}

// AddRecentFile adds or moves a file to the top of recent files.
func (s *Storage) AddRecentFile(filePath string) (*AppState, error) {
	state, err := s.Load()
	if err != nil {
		return nil, err
	}

	cleanPath := filepath.Clean(filePath)
	name := filepath.Base(cleanPath)

	newItems := make([]RecentItem, 0, len(state.RecentFiles)+1)
	newItems = append(newItems, RecentItem{
		Path:      cleanPath,
		Name:      name,
		Timestamp: time.Now(),
	})

	for _, item := range state.RecentFiles {
		if filepath.Clean(item.Path) != cleanPath {
			newItems = append(newItems, item)
			if len(newItems) >= maxRecentItems {
				break
			}
		}
	}

	state.RecentFiles = newItems
	if err := s.Save(state); err != nil {
		return nil, err
	}
	return state, nil
}

// AddRecentFolder adds or moves a folder to the top of recent folders.
func (s *Storage) AddRecentFolder(dirPath string) (*AppState, error) {
	state, err := s.Load()
	if err != nil {
		return nil, err
	}

	cleanPath := filepath.Clean(dirPath)
	name := filepath.Base(cleanPath)

	newItems := make([]RecentItem, 0, len(state.RecentFolders)+1)
	newItems = append(newItems, RecentItem{
		Path:      cleanPath,
		Name:      name,
		Timestamp: time.Now(),
	})

	for _, item := range state.RecentFolders {
		if filepath.Clean(item.Path) != cleanPath {
			newItems = append(newItems, item)
			if len(newItems) >= maxRecentItems {
				break
			}
		}
	}

	state.RecentFolders = newItems
	if err := s.Save(state); err != nil {
		return nil, err
	}
	return state, nil
}

// AddRecentWorkspace adds or updates a workspace in the recent workspaces list.
func (s *Storage) AddRecentWorkspace(name string, folders []string) (*AppState, error) {
	state, err := s.Load()
	if err != nil {
		return nil, err
	}

	cleanedFolders := make([]string, 0, len(folders))
	for _, f := range folders {
		cleaned := filepath.Clean(f)
		if cleaned != "" {
			cleanedFolders = append(cleanedFolders, cleaned)
		}
	}

	if name == "" {
		if len(cleanedFolders) > 0 {
			name = filepath.Base(cleanedFolders[0]) + " Workspace"
		} else {
			name = "Untitled Workspace"
		}
	}

	ws := WorkspaceConfig{
		ID:        fmt.Sprintf("ws_%d", time.Now().UnixNano()),
		Name:      name,
		Folders:   cleanedFolders,
		Timestamp: time.Now(),
	}

	newWorkspaces := make([]WorkspaceConfig, 0, len(state.RecentWorkspaces)+1)
	newWorkspaces = append(newWorkspaces, ws)

	for _, existing := range state.RecentWorkspaces {
		if existing.Name != name {
			newWorkspaces = append(newWorkspaces, existing)
			if len(newWorkspaces) >= maxRecentItems {
				break
			}
		}
	}

	state.RecentWorkspaces = newWorkspaces
	state.LastWorkspace = &ws

	if err := s.Save(state); err != nil {
		return nil, err
	}
	return state, nil
}

// ClearRecent clears the specified category ("files", "folders", "workspaces", or "all").
func (s *Storage) ClearRecent(category string) (*AppState, error) {
	state, err := s.Load()
	if err != nil {
		return nil, err
	}

	switch category {
	case "files":
		state.RecentFiles = make([]RecentItem, 0)
	case "folders":
		state.RecentFolders = make([]RecentItem, 0)
	case "workspaces":
		state.RecentWorkspaces = make([]WorkspaceConfig, 0)
		state.LastWorkspace = nil
	case "all":
		state.RecentFiles = make([]RecentItem, 0)
		state.RecentFolders = make([]RecentItem, 0)
		state.RecentWorkspaces = make([]WorkspaceConfig, 0)
		state.LastWorkspace = nil
	}

	if err := s.Save(state); err != nil {
		return nil, err
	}
	return state, nil
}
