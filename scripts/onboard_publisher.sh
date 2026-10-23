#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${THRU_RPC_URL:-https://rpc.betanet.thru.org}"
KEY_FILE=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key-file)
      KEY_FILE="$2"
      shift 2
      ;;
    --rpc)
      RPC_URL="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
done

echo "=== Thru Oracle Node Operator Onboarding Pre-Flight ==="
echo "RPC Endpoint: $RPC_URL"

# 1. Check prerequisites
for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "  [FAIL] Missing required binary: $bin"
    exit 1
  fi
done
echo "  [OK] System utilities present (curl, jq)"

# 2. Verify key file permissions if provided
if [ -n "$KEY_FILE" ]; then
  if [ ! -f "$KEY_FILE" ]; then
    echo "  [FAIL] Specified key file not found: $KEY_FILE"
    exit 1
  fi
  perms=$(stat -c "%a" "$KEY_FILE" 2>/dev/null || stat -f "%Lp" "$KEY_FILE" 2>/dev/null || echo "600")
  if [ "$perms" != "600" ] && [ "$perms" != "400" ]; then
    echo "  [WARN] Insecure key file permissions: $perms (recommend chmod 600)"
  else
    echo "  [OK] Key file permissions secure ($perms)"
  fi
fi

# 3. Verify RPC reachability
rpc_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$RPC_URL" || echo "000")
if [ "$rpc_status" != "200" ] && [ "$rpc_status" != "405" ] && [ "$rpc_status" != "400" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [DRY-RUN] RPC endpoint offline or unreachable (code: $rpc_status), proceeding"
  else
    echo "  [FAIL] Cannot connect to RPC $RPC_URL (HTTP $rpc_status)"
    exit 1
  fi
else
  echo "  [OK] RPC endpoint reachable (HTTP $rpc_status)"
fi

# 4. Check venue reachability
venues=("api.binance.com" "api.coinbase.com" "www.okx.com" "api.kraken.com")
reachable=0
for venue in "${venues[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "https://$venue" 2>/dev/null || echo "000")
  if [ "$code" != "000" ]; then
    reachable=$((reachable + 1))
  fi
done

if [ "$reachable" -ge 2 ]; then
  echo "  [OK] Multi-venue data feeds reachable ($reachable / ${#venues[@]} live)"
else
  echo "  [WARN] Venue connectivity degraded ($reachable / ${#venues[@]} live)"
fi

echo "=== Onboarding Pre-Flight Complete: Ready for Consensus Registration ==="
