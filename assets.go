package knot

import "embed"

// Assets embeds the production web application files from the ui/dist directory.
//
//go:embed all:ui/dist
var Assets embed.FS
