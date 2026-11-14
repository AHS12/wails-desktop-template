# Common tasks. Run `make` to list them.

FRONTEND := frontend

# Vitest and Vite need a newer Node than 20.18, so tests fetch and use their own.
VITEST := cd $(FRONTEND) && pnpm dlx node@22 node_modules/vitest/vitest.mjs

DIST := build/dist

ifeq ($(OS),Windows_NT)
    # From PowerShell or cmd there is no Unix shell or rm, mkdir and cp, so use Git's.
    SHELL := C:/Program Files/Git/bin/bash.exe
    export PATH := C:\Program Files\Git\usr\bin;$(PATH)
endif

# Who the app is lives in appconfig/app.config.json. It's read after PATH is set
# above, because PowerShell has no sed.
APP_CONFIG := appconfig/app.config.json
APP_ID := $(shell sed -n 's/^  "id": "\([^"]*\)".*/\1/p' $(APP_CONFIG))
VERSION := $(shell sed -n 's/^  "version": "\([^"]*\)".*/\1/p' $(APP_CONFIG))

ifeq ($(OS),Windows_NT)
    APP := bin/$(APP_ID).exe
else
    APP := bin/$(APP_ID).app/Contents/MacOS/$(APP_ID)
endif

.DEFAULT_GOAL := help

.PHONY: help install hooks dev web build build-frontend build-check installer mac dmg release run test test-go test-frontend test-watch typecheck lint lint-go lint-frontend check check-app version rename clean

help: ## List the tasks
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

install: hooks ## Install the frontend packages and the git hooks
	pnpm --dir $(FRONTEND) install

hooks: ## Run the checks in .githooks before each commit and push
	git config core.hooksPath .githooks

dev: ## Run the desktop app with hot reload
	wails3 dev -config ./build/config.yml

web: ## Run only the frontend, in a browser
	pnpm --dir $(FRONTEND) dev

build: ## Build the desktop app into bin
	wails3 build

build-frontend: ## Type-check and bundle only the frontend
	pnpm --dir $(FRONTEND) build

# NSIS does not add itself to PATH when it installs, so the recipe adds it.
installer: ## Build the Windows installer into build/dist (Windows, needs NSIS)
	PATH="/c/Program Files (x86)/NSIS:$$PATH" wails3 task windows:package
	mkdir -p $(DIST)
	cp bin/$(APP_ID)-amd64-installer.exe $(DIST)/$(APP_ID)-$(VERSION)-windows-amd64-setup.exe
	@echo Created $(DIST)/$(APP_ID)-$(VERSION)-windows-amd64-setup.exe

mac: ## Build the universal Mac app into bin, signed for this Mac only (Mac only)
	wails3 task darwin:package:universal

dmg: mac ## Build the Mac disk image and update zip into build/dist (Mac only)
	./build/darwin/make_dmg.sh $(APP_ID) $(VERSION)
	ditto -c -k --norsrc --noextattr --noqtn --keepParent bin/$(APP_ID).app $(DIST)/$(APP_ID)-$(VERSION)-mac-universal.zip

release: ## Build the installers this computer can make, and skip the rest
ifeq ($(OS),Windows_NT)
	$(MAKE) installer
	@echo Skipped the Mac DMG: it can only be built on a Mac.
else ifeq ($(shell uname -s),Darwin)
	$(MAKE) dmg
	@echo Skipped the Windows installer: it is only built on Windows.
else
	@echo Skipped the Windows installer and the Mac DMG: they need Windows and a Mac.
endif

run: build ## Build the desktop app and open it
	./$(APP)

test: test-go test-frontend ## Run every test

# The main package embeds the frontend build, so it's left to build-check.
test-go: ## Run the Go tests
	go test ./appconfig/... ./backend/... ./tools/...

test-frontend: ## Run the frontend tests
	$(VITEST) run

test-watch: ## Run the frontend tests on every change
	$(VITEST)

typecheck: ## Check the TypeScript types
	pnpm --dir $(FRONTEND) typecheck

lint: typecheck lint-frontend lint-go ## Run every lint

lint-frontend: ## Lint the frontend
	pnpm --dir $(FRONTEND) lint

# The Go code embeds the frontend, so it won't compile until that has been built once.
lint-go: $(FRONTEND)/dist/index.html ## Lint the Go code (needs golangci-lint)
	@command -v golangci-lint >/dev/null || { echo "Install golangci-lint: https://golangci-lint.run/"; exit 1; }
	golangci-lint run ./...

$(FRONTEND)/dist/index.html:
	pnpm --dir $(FRONTEND) build

build-check: build-frontend ## Check that the frontend and the Go code build
	go build -tags production ./...

check: check-app lint test build-check ## Run every lint, test and build check

check-app: ## Check that every build file agrees with appconfig/app.config.json
	go run ./tools/appinfo check

version: ## Set the version everywhere, as in: make version V=1.2.3
	@test -n "$(V)" || { echo "Say which version, as in: make version V=1.2.3"; exit 1; }
	go run ./tools/appinfo version $(V)

# NAME is what people see, ID names files, BUNDLE is com.you.app, REPO is owner/name.
rename: ## Rename the app, as in: make rename NAME="My App" ID=my-app BUNDLE=com.me.myapp REPO=me/my-app
	go run ./tools/appinfo rename $(if $(NAME),-name "$(NAME)") $(if $(ID),-id "$(ID)") $(if $(BUNDLE),-bundle "$(BUNDLE)") $(if $(REPO),-repo "$(REPO)")

clean: ## Delete build output
	rm -rf bin $(DIST) $(FRONTEND)/dist
