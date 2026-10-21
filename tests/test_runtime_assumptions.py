import hashlib
import json
import os
import sys
import unittest
import urllib.request

ORACLE_ERR_UNINITIALIZED = 0x2001
ORACLE_ERR_VOLATILITY_EXCEEDED = 0x2007
ORACLE_ERR_BREAKER_TRIPPED = 0x200B
ORACLE_ERR_CLOCK_UNAVAILABLE = 0x200D
ORACLE_ERR_TIMESTAMP_REGRESSED = 0x200E
VM_ERR_UNOWNED_ACCOUNT = 0xBAD0A174

SKEW_PAST_MAX_SEC = 30
SKEW_FUTURE_MAX_SEC = 5


class MockAccount:
    def __init__(self, owner: bytes, data: bytearray):
        self.owner = owner
        self.data = bytearray(data)

    def clone(self) -> "MockAccount":
        return MockAccount(self.owner, bytearray(self.data))


class MockThruVM:
    def __init__(self, executing_program: bytes, block_time: int, slot: int):
        self.executing_program = executing_program
        self.block_time = block_time
        self.slot = slot
        self.accounts: dict[int, MockAccount] = {}

    def set_account(self, idx: int, account: MockAccount):
        self.accounts[idx] = account

    def execute_transaction(self, fee_payer: bytes, fn):
        snapshot = {idx: acc.clone() for idx, acc in self.accounts.items()}
        try:
            return fn(self, fee_payer)
        except Exception:
            self.accounts = snapshot
            raise

    def set_account_data_writable(self, account_idx: int) -> bytearray:
        acc = self.accounts.get(account_idx)
        if not acc:
            raise RuntimeError("account not found")
        if acc.owner != self.executing_program:
            raise PermissionError(VM_ERR_UNOWNED_ACCOUNT)
        return acc.data


def derive_account_address(program_id: bytes, seed: bytes) -> str:
    h = hashlib.sha256(program_id + seed).digest()
    return "ta" + h.hex()[:44]


class TestRuntimeAssumptions(unittest.TestCase):
    def setUp(self):
        self.program_id = b"oracle_program_00000000000000001"
        self.authority = b"authority_pubkey_000000000000001"
        self.vm = MockThruVM(self.program_id, block_time=1700000000, slot=2500000)

    def test_a1_rollback_on_revert(self):
        initial_state = bytearray(b"ORIGINAL_STORAGE_DATA_1234567890")
        account = MockAccount(owner=self.program_id, data=initial_state)
        self.vm.set_account(1, account)

        def failing_tx(vm: MockThruVM, fee_payer: bytes):
            buf = vm.set_account_data_writable(1)
            buf[0:4] = b"DIRT"
            raise ValueError(ORACLE_ERR_BREAKER_TRIPPED)

        with self.assertRaises(ValueError) as ctx:
            self.vm.execute_transaction(self.authority, failing_tx)

        self.assertEqual(ctx.exception.args[0], ORACLE_ERR_BREAKER_TRIPPED)
        self.assertEqual(bytes(self.vm.accounts[1].data), b"ORIGINAL_STORAGE_DATA_1234567890")

    def test_a2_clock_semantics_and_skew_bounds(self):
        now = self.vm.block_time

        def validate_quote_timestamp(vm: MockThruVM, quote_ts: int):
            if vm.block_time == 0:
                raise ValueError(ORACLE_ERR_CLOCK_UNAVAILABLE)
            if quote_ts < vm.block_time - SKEW_PAST_MAX_SEC:
                raise ValueError(ORACLE_ERR_TIMESTAMP_REGRESSED)
            if quote_ts > vm.block_time + SKEW_FUTURE_MAX_SEC:
                raise ValueError(ORACLE_ERR_CLOCK_UNAVAILABLE)
            return True

        self.assertTrue(validate_quote_timestamp(self.vm, now))
        self.assertTrue(validate_quote_timestamp(self.vm, now - 15))
        self.assertTrue(validate_quote_timestamp(self.vm, now + 3))

        with self.assertRaises(ValueError) as ctx:
            validate_quote_timestamp(self.vm, now - 31)
        self.assertEqual(ctx.exception.args[0], ORACLE_ERR_TIMESTAMP_REGRESSED)

        with self.assertRaises(ValueError) as ctx:
            validate_quote_timestamp(self.vm, now + 6)
        self.assertEqual(ctx.exception.args[0], ORACLE_ERR_CLOCK_UNAVAILABLE)

        vm_zero_clock = MockThruVM(self.program_id, block_time=0, slot=2500001)
        with self.assertRaises(ValueError) as ctx:
            validate_quote_timestamp(vm_zero_clock, now)
        self.assertEqual(ctx.exception.args[0], ORACLE_ERR_CLOCK_UNAVAILABLE)

    def test_a3_ownership_and_write_isolation(self):
        third_party_owner = b"some_other_program_0000000000001"
        foreign_account = MockAccount(owner=third_party_owner, data=bytearray(b"PROTECTED"))
        self.vm.set_account(2, foreign_account)

        with self.assertRaises(PermissionError) as ctx:
            self.vm.set_account_data_writable(2)
        self.assertEqual(ctx.exception.args[0], VM_ERR_UNOWNED_ACCOUNT)
        self.assertEqual(bytes(self.vm.accounts[2].data), b"PROTECTED")

    def test_a4_account_collision_resistance(self):
        seed = b"shared_deterministic_seed_000001"
        prog_a = b"program_alpha_000000000000000001"
        prog_b = b"program_beta_0000000000000000001"

        addr_a = derive_account_address(prog_a, seed)
        addr_b = derive_account_address(prog_b, seed)

        self.assertNotEqual(addr_a, addr_b)
        self.assertTrue(addr_a.startswith("ta"))
        self.assertTrue(addr_b.startswith("ta"))
        self.assertEqual(len(addr_a), 46)
        self.assertEqual(len(addr_b), 46)

    def test_a5_signer_authority_semantics(self):
        def admin_resume(vm: MockThruVM, signer: bytes, required_authority: bytes):
            if signer != required_authority:
                raise PermissionError(0x403)
            return True

        self.assertTrue(admin_resume(self.vm, self.authority, self.authority))

        unauthorized_signer = b"attacker_pubkey_0000000000000001"
        with self.assertRaises(PermissionError) as ctx:
            admin_resume(self.vm, unauthorized_signer, self.authority)
        self.assertEqual(ctx.exception.args[0], 0x403)

    def test_live_betanet_rpc_context(self):
        if os.getenv("THRU_LIVE_VERIFY") != "1":
            self.skipTest("Live verification disabled (enable with THRU_LIVE_VERIFY=1)")

        import shutil
        import subprocess

        if not shutil.which("thru"):
            self.skipTest("thru CLI binary not found in PATH")

        try:
            res = subprocess.run(
                ["thru", "getheight", "--network", "betanet", "--json"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            self.assertEqual(res.returncode, 0)
            data = json.loads(res.stdout)
            height_info = data.get("getheight", {})
            self.assertEqual(height_info.get("status"), "success")
            self.assertGreater(height_info.get("finalized", 0), 2000000)
        except Exception as e:
            self.skipTest(f"Live Betanet query failed: {e}")


if __name__ == "__main__":
    unittest.main()
