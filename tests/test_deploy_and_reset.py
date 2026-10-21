import unittest
import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "scripts"))

import detect_reset


class TestDeployAndReset(unittest.TestCase):
    def setUp(self):
        self.networks_file = ROOT_DIR / "deploy" / "networks.json"
        self.deployed_file = ROOT_DIR / "deploy" / "deployed.json"

    def test_network_registry_defaults(self):
        self.assertTrue(self.networks_file.exists())
        with open(self.networks_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data.get("default_network"), "betanet")
        self.assertIn("betanet", data.get("networks", {}))
        self.assertIn("alphanet", data.get("networks", {}))
        self.assertEqual(data["networks"]["betanet"]["chain_id"], 2)
        self.assertEqual(data["networks"]["alphanet"]["status"], "archived_reset")

    def test_deployed_registry_defaults(self):
        self.assertTrue(self.deployed_file.exists())
        with open(self.deployed_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("betanet", data.get("deployments", {}))
        self.assertIn("alphanet", data.get("deployments", {}))
        self.assertEqual(data["deployments"]["betanet"]["status"], "uninitialized")
        self.assertEqual(data["deployments"]["alphanet"]["status"], "archived_reset")

    def test_reset_detector_slot_regression(self):
        ok, res = detect_reset.run_reset_check("betanet", simulate="slot_regression")
        self.assertFalse(ok)
        self.assertEqual(res.get("status"), "RESET_DETECTED")
        self.assertEqual(res.get("reason"), "SLOT_REGRESSION")

    def test_reset_detector_chain_id_mismatch(self):
        ok, res = detect_reset.run_reset_check("betanet", simulate="chain_id_change")
        self.assertFalse(ok)
        self.assertEqual(res.get("status"), "RESET_DETECTED")
        self.assertEqual(res.get("reason"), "CHAIN_ID_MISMATCH")

    def test_reset_detector_account_missing(self):
        ok, res = detect_reset.run_reset_check("betanet", simulate="account_missing")
        self.assertFalse(ok)
        self.assertEqual(res.get("status"), "RESET_DETECTED")
        self.assertEqual(res.get("reason"), "CORE_ACCOUNT_PRUNED")

    def test_deploy_dry_run_orchestration(self):
        import deploy
        res = deploy.deploy(network="betanet", dry_run=True)
        self.assertTrue(res["dry_run"])
        self.assertFalse(res["is_noop"])
        self.assertTrue(len(res["actions"]) == 3)
        self.assertEqual(res["actions"][0]["status"], "dry-run-created")
        self.assertEqual(res["actions"][1]["status"], "dry-run-registered")
        self.assertEqual(res["actions"][2]["status"], "dry-run-initialized")


if __name__ == "__main__":
    unittest.main()
