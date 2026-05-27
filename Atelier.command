#!/usr/bin/env bash
# Double-cliquable (macOS) : ouvre le menu de l'atelier dans ce terminal.
cd "$(dirname "$0")" || exit 1
exec ./bin/lab menu
