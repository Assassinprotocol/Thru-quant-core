#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

command -v gcc >/dev/null 2>&1 || { echo "Error: gcc not found"; exit 1; }
command -v make >/dev/null 2>&1 || { echo "Error: make not found"; exit 1; }
command -v go >/dev/null 2>&1 || { echo "Error: go not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found"; exit 1; }

make test
make test-simulation
make test-hardening
make test-math-golden
make test-math-checked
make fuzz-math
make fuzz-contracts
make lint-c
make lint-claims
make verify-claims
make test-deploy
make coverage
make test-api
make build-api
make build-feeder
make build-sdk
make test-sdk
make run-example
make bench-math
make bench-api

if command -v thru >/dev/null 2>&1; then
    make codegen-abi
fi

if [ -d "${HOME}/.thru/sdk/toolchain" ]; then
    make build-rv64
fi

make clean-tests

