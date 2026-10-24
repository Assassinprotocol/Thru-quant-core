#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_FILE="docs/audit/sbom.json"
mkdir -p "docs/audit"

echo "=== Generating Thru Quant Core Software Bill of Materials (SBOM) ==="

GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'v1.0.0')"
GIT_BRANCH="main"
BUILD_TIMESTAMP="2026-10-24T00:00:00Z"

cat << EOF > "$OUTPUT_FILE"
{
  "\$schema": "http://cyclonedx.org/schema/bom-1.5.json",
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:thru-quant-core-${GIT_COMMIT:0:8}",
  "version": 1,
  "metadata": {
    "timestamp": "$BUILD_TIMESTAMP",
    "component": {
      "type": "application",
      "name": "thru_quant_core",
      "version": "1.0.0",
      "description": "Deterministic sovereign quantitative oracle and risk engine on Thru Network",
      "properties": [
        { "name": "git:commit", "value": "$GIT_COMMIT" },
        { "name": "git:branch", "value": "$GIT_BRANCH" },
        { "name": "target:architecture", "value": "riscv64imc" }
      ]
    }
  },
  "components": [
    {
      "type": "framework",
      "name": "thru_math",
      "version": "1.0.0",
      "scope": "required",
      "description": "Checked Q64.64 fixed-point math library with range reduction"
    },
    {
      "type": "framework",
      "name": "market_oracle_c",
      "version": "0.3.0",
      "scope": "required",
      "description": "On-chain core market oracle contract for ThruVM"
    },
    {
      "type": "library",
      "name": "@thru-quant/core-sdk",
      "version": "0.3.0",
      "purl": "pkg:npm/%40thru-quant/core-sdk@0.3.0"
    },
    {
      "type": "application",
      "name": "@thru-quant/indexer",
      "version": "0.1.0",
      "purl": "pkg:npm/%40thru-quant/indexer@0.1.0"
    },
    {
      "type": "application",
      "name": "@thru-quant/gateway-v2",
      "version": "0.2.0",
      "purl": "pkg:npm/%40thru-quant/gateway-v2@0.2.0"
    },
    {
      "type": "application",
      "name": "thru_quant_portal",
      "version": "0.1.0",
      "purl": "pkg:npm/thru_quant_portal@0.1.0"
    }
  ]
}
EOF

echo "  [OK] CycloneDX SBOM written to $OUTPUT_FILE"
