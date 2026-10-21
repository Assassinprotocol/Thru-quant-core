#!/usr/bin/env python3

import sys
import json
import subprocess
import argparse
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
NETWORKS_FILE = ROOT_DIR / "deploy" / "networks.json"
DEPLOYED_FILE = ROOT_DIR / "deploy" / "deployed.json"


def load_json(filepath: Path) -> dict:
    if not filepath.exists():
        sys.stderr.write(f"Error: {filepath} not found\n")
        sys.exit(1)
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def run_thru_cmd(cmd_args: list) -> tuple[int, dict]:
    try:
        proc = subprocess.run(
            cmd_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=15,
        )
        stdout = proc.stdout.strip()
        data = json.loads(stdout) if stdout.startswith("{") else {"raw": stdout}
        return proc.returncode, data
    except Exception as e:
        return -1, {"error": str(e)}


def probe_live_network(network: str, rpc_url: str | None = None) -> dict:
    thru_bin = "thru"
    base_args = [thru_bin]
    if rpc_url:
        base_args.extend(["--url", rpc_url])
    elif network:
        base_args.extend(["--network", network])

    rc_status, status_data = run_thru_cmd(base_args + ["getstatus", "--json"])
    rc_ver, ver_data = run_thru_cmd(base_args + ["getversion", "--json"])

    if rc_status != 0 or "getstatus" not in status_data:
        return {"live": False, "error": status_data}

    st = status_data["getstatus"]
    finalized_slot = st.get("finalized_slot", 0)
    ver_info = ver_data.get("getversion", {})

    return {
        "live": True,
        "finalized_slot": finalized_slot,
        "node_commit": ver_info.get("thru-node-commit", "unknown"),
        "node_version": ver_info.get("thru-node", "unknown"),
    }


def check_account_exists(network: str, pubkey: str) -> bool:
    if not pubkey:
        return False
    rc, data = run_thru_cmd(["thru", "--network", network, "getaccountinfo", pubkey, "--json"])
    return rc == 0 and "account_info" in data


def run_reset_check(network_name: str = "betanet", simulate: str | None = None) -> tuple[bool, dict]:
    networks_cfg = load_json(NETWORKS_FILE)
    deployed_cfg = load_json(DEPLOYED_FILE)

    if network_name not in networks_cfg.get("networks", {}):
        return False, {"error": f"Unknown network: {network_name}"}

    net_meta = networks_cfg["networks"][network_name]
    dep_meta = deployed_cfg.get("deployments", {}).get(network_name, {})

    recorded_chain_id = net_meta.get("chain_id")
    last_verified_slot = net_meta.get("last_verified_slot", 0)
    deployed_slot = dep_meta.get("deployed_slot") or 0

    threshold_slot = max(last_verified_slot, deployed_slot)

    if simulate:
        probe = {
            "live": True,
            "finalized_slot": 100 if simulate == "slot_regression" else (threshold_slot + 5000),
            "node_commit": "simulated_commit",
            "node_version": "0.4.2",
            "simulated_chain_id": 999 if simulate == "chain_id_change" else recorded_chain_id,
        }
    else:
        probe = probe_live_network(network_name)

    if not probe.get("live"):
        return False, {
            "status": "UNREACHABLE",
            "network": network_name,
            "error": probe.get("error", "Unable to probe RPC endpoint"),
        }

    current_slot = probe.get("finalized_slot", 0)
    node_commit = probe.get("node_commit", "unknown")
    live_chain_id = probe.get("simulated_chain_id", recorded_chain_id)

    if live_chain_id != recorded_chain_id:
        return False, {
            "status": "RESET_DETECTED",
            "reason": "CHAIN_ID_MISMATCH",
            "network": network_name,
            "expected_chain_id": recorded_chain_id,
            "observed_chain_id": live_chain_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    if current_slot < threshold_slot:
        return False, {
            "status": "RESET_DETECTED",
            "reason": "SLOT_REGRESSION",
            "network": network_name,
            "threshold_slot": threshold_slot,
            "observed_slot": current_slot,
            "regression_delta": threshold_slot - current_slot,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    if simulate == "account_missing":
        return False, {
            "status": "RESET_DETECTED",
            "reason": "CORE_ACCOUNT_PRUNED",
            "network": network_name,
            "missing_pubkey": "taUPLMH5QYOAT4ktwQeO7DXAEKtqBhYehalNGf5BJFQDYq",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    if net_meta.get("status") == "active":
        uploader_pk = net_meta.get("core_programs", {}).get("uploader")
        if uploader_pk and not check_account_exists(network_name, uploader_pk):
            return False, {
                "status": "RESET_DETECTED",
                "reason": "CORE_ACCOUNT_PRUNED",
                "network": network_name,
                "missing_pubkey": uploader_pk,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

    prog_id = dep_meta.get("program_id")
    if prog_id and not check_account_exists(network_name, prog_id):
        return False, {
            "status": "RESET_DETECTED",
            "reason": "DEPLOYED_PROGRAM_PRUNED",
            "network": network_name,
            "missing_program_id": prog_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    return True, {
        "status": "HEALTHY",
        "network": network_name,
        "chain_id": recorded_chain_id,
        "current_slot": current_slot,
        "node_commit": node_commit,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def main():
    parser = argparse.ArgumentParser(description="Thru Network Reset Detector")
    parser.add_argument("--network", default="betanet", help="Target network profile (default: betanet)")
    parser.add_argument(
        "--simulate",
        choices=["slot_regression", "chain_id_change", "account_missing"],
        help="Simulate a reset condition for testing",
    )
    args = parser.parse_args()

    ok, result = run_reset_check(args.network, simulate=args.simulate)
    print(json.dumps(result, indent=2))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
