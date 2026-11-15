package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"

	"wails-desktop-template/appconfig"
	"wails-desktop-template/backend"
	"wails-desktop-template/backend/backup"
	"wails-desktop-template/backend/documents"
	"wails-desktop-template/backend/export"
	"wails-desktop-template/backend/secrets"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	identity := appconfig.Current()
	service := backend.NewApp()
	shell := backend.ShellOf(service)
	library := documents.New(shell)

	// Each optional feature is a service of its own, in its own folder. Leaving
	// one out means deleting its lines here and its folders: see
	// docs/removing-features.md.
	backups := backup.New(shell, library, secrets.Keychain{})
	exports := export.New()

	// Pictures are served from disk, not from the build, longest address first.
	pictures := []pictureRoute{
		{backup.HeldPicturePrefix, backup.HeldPictureHandler(backups)},
		{documents.PicturePathPrefix, documents.PictureHandler(library)},
	}

	dist, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	app := application.New(application.Options{
		Name:        identity.Name,
		Description: identity.Description,
		Services: []application.Service{
			application.NewService(service),
			application.NewService(library),
			application.NewService(backups),
			application.NewService(exports),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(dist),
			Middleware: func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
					for _, route := range pictures {
						if strings.HasPrefix(request.URL.Path, route.prefix) {
							route.handler.ServeHTTP(writer, request)
							return
						}
					}

					next.ServeHTTP(writer, request)
				})
			},
		},
		ShouldQuit: backend.QuitGuard(service),
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID:               singleInstanceID(identity),
			OnSecondInstanceLaunch: backend.SecondLaunch(service),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		Windows: application.WindowsOptions{
			AdditionalBrowserArgs: browserArgs(),
		},
		// The desktop matches this id to the menu entry, installed as <bundle id>.desktop,
		// to show the window's icon and name in the dock.
		Linux: application.LinuxOptions{
			ApplicationID: identity.BundleID,
		},
	})

	backend.OpenWindow(service, app, application.WebviewWindowOptions{
		Title:     identity.Name,
		MinWidth:  backend.MinWindowWidth,
		MinHeight: backend.MinWindowHeight,
		// On Windows the menu bar is the title bar, as in other modern desktop editors.
		// A Mac keeps its own window buttons, drawn over the bar by the inset title bar.
		// Linux keeps the system's title bar: GNOME and KDE draw their own, and a
		// frameless window there can't always be resized from its edges.
		Frameless:        runtime.GOOS == "windows",
		BackgroundColour: application.NewRGB(24, 25, 27),
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			Theme: application.SystemDefault,
		},
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

// singleInstanceID names the running app, so a second launch finds it. A
// development build gets its own name, so it opens next to an installed copy
// rather than bringing that copy forward.
func singleInstanceID(identity appconfig.Config) string {
	if os.Getenv("FRONTEND_DEVSERVER_URL") != "" {
		return identity.BundleID + ".dev"
	}

	return identity.BundleID
}

// pictureRoute sends requests under prefix to a feature's picture handler.
type pictureRoute struct {
	prefix  string
	handler http.Handler
}
