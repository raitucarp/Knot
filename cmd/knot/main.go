package main

import (
	"log"

	"github.com/raitucarp/knot"
	"github.com/raitucarp/knot/internal/app"
	"github.com/raitucarp/knot/internal/parser"
	"github.com/raitucarp/knot/internal/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func main() {
	appService := app.NewService(nil)
	parserService := parser.NewParserService()
	workspaceService := workspace.NewService(nil)
	defer parserService.Close()

	wailsApp := application.New(application.Options{
		Name:        "Knot",
		Description: "Knot Node-Based IDE",
		Services: []application.Service{
			application.NewService(appService),
			application.NewService(parserService),
			application.NewService(workspaceService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(knot.Assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// Inject wailsApp into services for window and dialog operations
	*appService = *app.NewService(wailsApp)
	workspaceService.SetApp(wailsApp)

	wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "Knot",
		Width:     1280,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		Frameless: true,
		Windows: application.WindowsWindow{
			Theme:                  application.Dark,
			NonClientRegionSupport: true,
		},
		Mac: application.MacWindow{
			Backdrop: application.MacBackdropTranslucent,
			TitleBar: application.MacTitleBarHidden,
		},
		BackgroundColour: application.NewRGB(17, 17, 19),
		URL:              "/",
	})

	err := wailsApp.Run()
	if err != nil {
		log.Fatal(err)
	}
}
