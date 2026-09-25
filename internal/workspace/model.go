package workspace

import "time"

// FileEntry represents a file or folder in a directory.
type FileEntry struct {
	Name          string `json:"name"`
	Path          string `json:"path"`
	IsDir         bool   `json:"isDir"`
	Size          int64  `json:"size"`
	Extension     string `json:"extension"`
	ChildrenCount int    `json:"childrenCount"`
}

// RecentItem represents a recently opened file or folder.
type RecentItem struct {
	Path      string    `json:"path"`
	Name      string    `json:"name"`
	Timestamp time.Time `json:"timestamp"`
}

// WorkspaceConfig represents a workspace containing one or more directories.
type WorkspaceConfig struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Folders   []string  `json:"folders"`
	Timestamp time.Time `json:"timestamp"`
}

// AppState holds the persistent state for recent history and workspace memory.
type AppState struct {
	RecentFiles      []RecentItem      `json:"recentFiles"`
	RecentFolders    []RecentItem      `json:"recentFolders"`
	RecentWorkspaces []WorkspaceConfig `json:"recentWorkspaces"`
	LastWorkspace    *WorkspaceConfig  `json:"lastWorkspace,omitempty"`
}

// NewDefaultAppState creates an empty AppState.
func NewDefaultAppState() *AppState {
	return &AppState{
		RecentFiles:      make([]RecentItem, 0),
		RecentFolders:    make([]RecentItem, 0),
		RecentWorkspaces: make([]WorkspaceConfig, 0),
	}
}
