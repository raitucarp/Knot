//go:build windows

package parser

import "syscall"

func openSharedLibrary(path string) (uintptr, error) {
	h, err := syscall.LoadLibrary(path)
	if err != nil {
		return 0, err
	}
	return uintptr(h), nil
}

func closeSharedLibrary(handle uintptr) error {
	return syscall.FreeLibrary(syscall.Handle(handle))
}
