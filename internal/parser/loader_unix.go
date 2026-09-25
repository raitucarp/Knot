//go:build !windows

package parser

import "github.com/ebitengine/purego"

func openSharedLibrary(path string) (uintptr, error) {
	return purego.Dlopen(path, purego.RTLD_NOW|purego.RTLD_GLOBAL)
}

func closeSharedLibrary(handle uintptr) error {
	return purego.Dlclose(handle)
}
