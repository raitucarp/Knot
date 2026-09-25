package app

import (
	"runtime"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// AppInfo contains metadata about the application and runtime environment.
type AppInfo struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	GoVersion string `json:"goVersion"`
}

// Service provides application-level operations and information to the frontend.
type Service struct {
	app *application.App
}

// NewService creates a new App service instance.
func NewService(app *application.App) *Service {
	return &Service{app: app}
}

// GetAppInfo returns system and application metadata.
func (s *Service) GetAppInfo() AppInfo {
	return AppInfo{
		Name:      "Knot",
		Version:   "0.1.0",
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		GoVersion: runtime.Version(),
	}
}

// MinimizeWindow minimizes the active application window.
func (s *Service) MinimizeWindow() {
	if s.app != nil && s.app.Window != nil {
		if win := s.app.Window.Current(); win != nil {
			win.Minimise()
		}
	}
}

// ToggleMaximizeWindow toggles between maximized and restored state.
func (s *Service) ToggleMaximizeWindow() {
	if s.app != nil && s.app.Window != nil {
		if win := s.app.Window.Current(); win != nil {
			win.ToggleMaximise()
		}
	}
}

// CloseWindow closes the active application window.
func (s *Service) CloseWindow() {
	if s.app != nil && s.app.Window != nil {
		if win := s.app.Window.Current(); win != nil {
			win.Close()
		}
	}
}

// IsWindowMaximized returns true if the active window is maximized.
func (s *Service) IsWindowMaximized() bool {
	if s.app != nil && s.app.Window != nil {
		if win := s.app.Window.Current(); win != nil {
			return win.IsMaximised()
		}
	}
	return false
}
