#!/bin/bash
# Helper script to start development server
# Run from anywhere inside the repo — it always serves from the repo root

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "Serving from: $SCRIPT_DIR"
echo "Open: http://localhost:9000/index.html"
python3 -m http.server 9000