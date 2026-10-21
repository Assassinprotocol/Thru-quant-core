#!/usr/bin/env python3

import sys
import json
import hashlib
import subprocess
import argparse
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "scripts"))

import detect_reset

NETWORKS_FILE = ROOT_DIR / "deploy" / "networks.json"
DEPLOYED_FILE = ROOT_DIR / "deploy" / "deployed.json"
BINARY_PATH = ROOT_DIR / "build" / "thruvm" / "bin" / "market_oracle_c.bin"
ABI_PATH = ROOT_DIR / "src" / "market_oracle.abi.yaml"


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def ensure_binary_built() -> str:
    if not BINARY_PATH.exists():
        proc = subprocess.run(["make", "build-rv64"], cwd=str(ROOT_DIR), capture_output=True, text=True)
        if proc.returncode != 0:
            sys.stderr.write(f"Build failed:\n{proc.stderr}\n")
            sys.exit(1)
    return compute_sha256(BINARY_PATH)


def deploy(network: str = "betanet", dry_run: bool = False, key_name: str = "0xhansen") -> dict:
    networks_cfg = detect_reset.load_json(NETWORKS_FILE)
    deployed_cfg = detect_reset.load_json(DEPLOYED_FILE)

    if network not in networks_cfg.get("networks", {}):
        raise ValueError(f"Unknown network: {network}")

    if not dry_run:
        healthy, check_res = detect_reset.run_reset_check(network)
        if not healthy:
            raise RuntimeError(f"Network pre-flight failed: {json.dumps(check_res)}")

    binary_hash = ensure_binary_built()
    dep_record = deployed_cfg.get("deployments", {}).get(network, {})

    actions_taken = []

    program_id = dep_record.get("program_id")
    recorded_hash = dep_record.get("program_sha256")

    if program_id and recorded_hash == binary_hash:
        actions_taken.append({"step": "program", "status": "no-op", "program_id": program_id})
    else:
        if dry_run:
            program_id = f"taMOCK_PROGRAM_{binary_hash[:8]}"
            actions_taken.append({"step": "program", "status": "dry-run-created", "program_id": program_id, "hash": binary_hash})
        else:
            seed = dep_record.get("program_seed", "market_oracle_v1")
            cmd = [
                "thru", "--network", network, "program", "create",
                seed, str(BINARY_PATH),
                "--fee-payer", key_name,
                "--json"
            ]
            rc, out = detect_reset.run_thru_cmd(cmd)
            if rc != 0:
                raise RuntimeError(f"Program deployment failed: {json.dumps(out)}")
            program_id = out.get("program_address") or out.get("account_address")
            actions_taken.append({"step": "program", "status": "created", "program_id": program_id, "hash": binary_hash})

    abi_id = dep_record.get("abi_id")
    if abi_id:
        actions_taken.append({"step": "abi", "status": "no-op", "abi_id": abi_id})
    else:
        if dry_run:
            abi_id = "taMOCK_ABI_ID"
            actions_taken.append({"step": "abi", "status": "dry-run-registered", "abi_id": abi_id})
        else:
            cmd = [
                "thru", "--network", network, "abi", "account", "create",
                str(ABI_PATH),
                "--fee-payer", key_name,
                "--json"
            ]
            rc, out = detect_reset.run_thru_cmd(cmd)
            if rc != 0:
                raise RuntimeError(f"ABI registration failed: {json.dumps(out)}")
            abi_id = out.get("abi_account") or out.get("account_address")
            actions_taken.append({"step": "abi", "status": "registered", "abi_id": abi_id})

    state_id = dep_record.get("state_account_id")
    if state_id:
        actions_taken.append({"step": "state", "status": "no-op", "state_account_id": state_id})
    else:
        if dry_run:
            state_id = "taMOCK_STATE_ACCOUNT"
            actions_taken.append({"step": "state", "status": "dry-run-initialized", "state_account_id": state_id})
        else:
            state_id = "taPENDING_WP05_ONCHAIN_INIT"
            actions_taken.append({"step": "state", "status": "pending_tx", "state_account_id": state_id})

    all_noop = all(a["status"] == "no-op" for a in actions_taken)
    if not dry_run and not all_noop:
        dep_record.update({
            "program_id": program_id,
            "program_sha256": binary_hash,
            "abi_id": abi_id,
            "state_account_id": state_id,
            "deployed_at": datetime.now(timezone.utc).isoformat(),
            "status": "deployed"
        })
        deployed_cfg["deployments"][network] = dep_record
        with open(DEPLOYED_FILE, "w", encoding="utf-8") as f:
            json.dump(deployed_cfg, f, indent=2)

    return {
        "network": network,
        "dry_run": dry_run,
        "is_noop": all_noop,
        "program_id": program_id,
        "abi_id": abi_id,
        "state_account_id": state_id,
        "binary_sha256": binary_hash,
        "actions": actions_taken
    }


def main():
    parser = argparse.ArgumentParser(description="Thru Quant Oracle Idempotent Deployer")
    parser.add_argument("--network", default="betanet", help="Target network (default: betanet)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate deployment without broadcasting tx")
    parser.add_argument("--key", default="0xhansen", help="Deployer key name from config (default: 0xhansen)")
    args = parser.parse_args()

    try:
        res = deploy(network=args.network, dry_run=args.dry_run, key_name=args.key)
        print(json.dumps(res, indent=2))
        sys.exit(0)
    except Exception as e:
        sys.stderr.write(f"Deployment error: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
