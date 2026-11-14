//go:build !production

package main

import (
	"os"
	"regexp"
)

// browserArgs lets a development build open WebView2's remote debugging port,
// so a script can drive the window the way a person would: set APP_DEBUG_PORT to
// a port number before starting it. A production build never has it, since
// whatever connects to that port controls the window.
func browserArgs() []string {
	port := os.Getenv("APP_DEBUG_PORT")

	if !regexp.MustCompile(`^[0-9]{2,5}$`).MatchString(port) {
		return nil
	}

	return []string{"--remote-debugging-port=" + port}
}
