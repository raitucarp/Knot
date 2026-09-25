package schemastore

import (
	"testing"
)

func TestSchemaStoreMatching(t *testing.T) {
	svc := NewService()

	// Test tsconfig.json matching
	info := svc.MatchFileSchema("c:/projects/test/tsconfig.json", nil)
	if info == nil {
		t.Fatalf("Expected tsconfig.json to match a schema")
	}

	if info.Description == "" {
		t.Errorf("Expected tsconfig.json schema to have a description, got empty")
	}

	t.Logf("tsconfig schema description: %s", info.Description)
	t.Logf("total properties indexed: %d", len(info.Properties))

	// Check compilerOptions
	if desc, ok := info.Properties["compilerOptions"]; !ok || desc == "" {
		t.Errorf("Expected compilerOptions to have description")
	} else {
		t.Logf("compilerOptions: %s", desc)
	}

	// Check compilerOptions/declaration
	if desc, ok := info.Properties["compilerOptions/declaration"]; !ok || desc == "" {
		t.Errorf("Expected compilerOptions/declaration to have description")
	} else {
		t.Logf("compilerOptions/declaration: %s", desc)
	}

	// Check package.json matching
	pkgInfo := svc.MatchFileSchema("package.json", nil)
	if pkgInfo == nil {
		t.Fatalf("Expected package.json to match a schema")
	}

	if desc, ok := pkgInfo.Properties["scripts"]; !ok || desc == "" {
		t.Errorf("Expected scripts to have description in package.json")
	} else {
		t.Logf("scripts: %s", desc)
	}
}
