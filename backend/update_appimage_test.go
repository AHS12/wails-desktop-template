package backend

import (
	"os"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"testing"
)

func TestAnAppImageIsFoundOnlyFromTheProgramInsideIt(t *testing.T) {
	folder := t.TempDir()
	image := filepath.Join(folder, "wails-desktop-template.AppImage")
	mount := filepath.Join(folder, ".mount_wails-desktop-template")

	if err := os.WriteFile(image, []byte("appimage"), 0o755); err != nil {
		t.Fatal(err)
	}

	inside := filepath.Join(mount, "usr", "bin", "wails-desktop-template")

	for _, c := range []struct {
		name, executable, image, mount, want string
	}{
		{"running from the AppImage", inside, image, mount, image},
		{"installed from a package", "/usr/bin/wails-desktop-template", "", "", ""},
		{"started by an AppImage, but not in it", "/usr/bin/wails-desktop-template", image, mount, ""},
		{"an AppImage that has gone", inside, filepath.Join(folder, "gone.AppImage"), mount, ""},
		{"an AppImage path that is a folder", inside, folder, mount, ""},
	} {
		if got := appImageOf(c.executable, c.image, c.mount); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}

func TestLinuxIsToldOfAnUpdateByTheDebAndUpdatesFromTheAppImage(t *testing.T) {
	release := githubRelease{
		TagName: "v1.0.0",
		Assets: []githubAsset{
			{Name: updateAssetName("windows", "1.0.0")},
			{Name: updateAssetName("linux", "1.0.0")},
			{Name: appImageUpdateName("1.0.0")},
		},
	}

	info, asset := chooseUpdate(release, "0.1.0", "linux")
	if !info.Available || asset == nil || !strings.HasSuffix(asset.Name, ".deb") {
		t.Fatalf("got %+v, %+v", info, asset)
	}

	if findAsset(release, appImageUpdateName(info.Version)) == nil {
		t.Fatal("the AppImage to update from isn't found")
	}
}

func TestALinuxPackageIsPointedAtTheDownloadPage(t *testing.T) {
	if goruntime.GOOS != "linux" {
		t.Skip("this is how Linux answers a check")
	}

	t.Setenv("APPIMAGE", "")
	t.Setenv("APPDIR", "")

	app := &App{updateAPI: releaseServer(t, "v9.0.0", installerDigest()).URL + "/latest", updateRoot: t.TempDir()}

	info, err := app.CheckForUpdate("0.1.0")
	if err != nil {
		t.Fatal(err)
	}

	if !info.Available || info.CanInstall || info.ManualReason != manualPackageManager {
		t.Fatalf("got %+v", info)
	}
}
