//go:build production

package main

// browserArgs is empty in a production build: see debug_port.go.
func browserArgs() []string {
	return nil
}
