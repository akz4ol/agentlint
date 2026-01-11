.PHONY: all build test lint clean install dev scan help

# Default target
all: build

# Install dependencies
install:
	npm ci

# Build the project
build:
	npm run build

# Run tests
test:
	npm test

# Run linter
lint:
	npm run lint

# Fix linting issues
lint-fix:
	npm run lint:fix

# Clean build artifacts
clean:
	rm -rf dist coverage node_modules/.cache

# Full clean including node_modules
distclean: clean
	rm -rf node_modules

# Development mode with watch
dev:
	npm run dev

# Run AgentLint on itself
scan:
	node dist/cli/index.js scan

# Run AgentLint on examples
scan-examples:
	node dist/cli/index.js scan examples/minimal
	node dist/cli/index.js scan examples/realistic || true

# Generate SARIF output
sarif:
	node dist/cli/index.js scan --format sarif --output agentlint.sarif

# List all rules
rules:
	node dist/cli/index.js rules list

# Show version
version:
	node dist/cli/index.js version

# Run all checks (CI equivalent)
ci: install build lint test scan

# Help
help:
	@echo "AgentLint Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  install       Install dependencies"
	@echo "  build         Build the project"
	@echo "  test          Run tests"
	@echo "  lint          Run linter"
	@echo "  lint-fix      Fix linting issues"
	@echo "  clean         Clean build artifacts"
	@echo "  distclean     Clean everything including node_modules"
	@echo "  dev           Development mode with watch"
	@echo "  scan          Run AgentLint on itself"
	@echo "  scan-examples Run AgentLint on example directories"
	@echo "  sarif         Generate SARIF output"
	@echo "  rules         List all rules"
	@echo "  version       Show version"
	@echo "  ci            Run all CI checks"
	@echo "  help          Show this help"
