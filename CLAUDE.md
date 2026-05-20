# Gulugulu Claude Guide

This repository contains the Gulugulu Tauri desktop app.

When a user asks Claude to install Gulugulu from this repository:

1. Read `INSTALL.md`.
2. Prefer the latest published GitHub Release installer for the current operating system.
3. On Windows, run `scripts/install.ps1` or download the latest `.msi` / `.exe` asset.
4. On macOS or Linux, run `scripts/install.sh` or download the latest `.dmg`, `.AppImage`, or `.deb` asset.
5. Only build from source when no matching Release asset exists.

Do not default to source compilation for ordinary users. Source builds require Node.js, Rust, and Tauri system dependencies.

Project memory for development lives in `claude/`.
