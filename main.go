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

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	identity := appconfig.Current()
	service := backend.NewApp()

	dist, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}

	app := application.New(application.Options{
		Name:        identity.Name,
		Description: identity.Description,
		Services: []application.Service{
			application.NewService(service),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(dist),
			// Pictures of saved documents come from disk, not from the build.
			Middleware: func(next http.Handler) http.Handler {
				pictures := backend.PictureHandler(service)

				return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
					if strings.HasPrefix(request.URL.Path, backend.PicturePathPrefix) {
						pictures.ServeHTTP(writer, request)
						return
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
	})

	backend.OpenWindow(service, app, application.WebviewWindowOptions{
		Title:     identity.Name,
		MinWidth:  backend.MinWindowWidth,
		MinHeight: backend.MinWindowHeight,
		// The menu bar is the title bar, as in other modern desktop editors. A Mac
		// keeps its own window buttons, drawn over the bar by the inset title bar.
		Frameless:        runtime.GOOS != "darwin",
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
