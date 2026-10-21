#!/usr/bin/env python3
"""
test_observability.py - Test suite for WP-08 Observability & Status v0.
Validates Prometheus alert definitions, Alertmanager configs, Grafana dashboards,
status JSON export, and simulated alert payload delivery.
"""

import json
import os
import sys
import unittest
import yaml

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

class TestObservabilityConfig(unittest.TestCase):

    def test_prometheus_alerts_syntax(self):
        alerts_file = os.path.join(REPO_ROOT, "prometheus", "alerts.yml")
        self.assertTrue(os.path.isfile(alerts_file), f"Missing {alerts_file}")
        with open(alerts_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        self.assertIn("groups", data)
        rules = data["groups"][0]["rules"]
        alert_names = [r["alert"] for r in rules]

        expected = [
            "OracleCircuitBreakerTripped",
            "OracleFeedSlotLagElevated",
            "OracleFeedStale",
            "OracleFeedCriticalStale",
            "OracleTrackedAssetsLow",
            "FeederRPCFailuresElevated",
            "FeederPublishFailureBudget"
        ]
        for exp in expected:
            self.assertIn(exp, alert_names, f"Missing alert rule: {exp}")

        for r in rules:
            self.assertIn("expr", r)
            self.assertIn("labels", r)
            self.assertIn("annotations", r)
            self.assertIn("summary", r["annotations"])
            self.assertIn("description", r["annotations"])

    def test_prometheus_scrape_config(self):
        prom_file = os.path.join(REPO_ROOT, "prometheus", "prometheus.yml")
        self.assertTrue(os.path.isfile(prom_file), f"Missing {prom_file}")
        with open(prom_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        self.assertIn("scrape_configs", data)
        self.assertIn("rule_files", data)
        self.assertIn("alerts.yml", data["rule_files"])

    def test_alertmanager_config(self):
        am_file = os.path.join(REPO_ROOT, "prometheus", "alertmanager.yml")
        self.assertTrue(os.path.isfile(am_file), f"Missing {am_file}")
        with open(am_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        self.assertIn("route", data)
        self.assertIn("receivers", data)
        self.assertTrue(len(data["receivers"]) > 0)

    def test_grafana_dashboard_schema(self):
        dash_file = os.path.join(REPO_ROOT, "grafana", "dashboards", "thru_oracle_overview.json")
        self.assertTrue(os.path.isfile(dash_file), f"Missing {dash_file}")
        with open(dash_file, "r", encoding="utf-8") as f:
            dash = json.load(f)

        self.assertEqual(dash.get("uid"), "thru-oracle-slo-v0")
        self.assertIn("panels", dash)
        self.assertGreaterEqual(len(dash["panels"]), 6)

        exprs = []
        for p in dash["panels"]:
            for t in p.get("targets", []):
                exprs.append(t.get("expr", ""))

        all_exprs = " ".join(exprs)
        self.assertIn("api_circuit_breaker_active", all_exprs)
        self.assertIn("api_feed_age_slots", all_exprs)
        self.assertIn("api_oracle_slot", all_exprs)
        self.assertIn("api_stream_clients_active", all_exprs)

    def test_docker_compose_observability(self):
        compose_file = os.path.join(REPO_ROOT, "deploy", "docker-compose.observability.yml")
        self.assertTrue(os.path.isfile(compose_file), f"Missing {compose_file}")
        with open(compose_file, "r", encoding="utf-8") as f:
            compose = yaml.safe_load(f)

        services = compose.get("services", {})
        self.assertIn("prometheus", services)
        self.assertIn("alertmanager", services)
        self.assertIn("grafana", services)

    def test_incident_template_exists(self):
        template_file = os.path.join(REPO_ROOT, "docs", "incidents", "incident-template.md")
        self.assertTrue(os.path.isfile(template_file), f"Missing {template_file}")
        with open(template_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("Root Cause Analysis (5 Whys)", content)
        self.assertIn("Incident Timeline", content)
        self.assertIn("Corrective & Preventative Action Items", content)

    def test_status_json_export(self):
        from scripts.export_status_json import generate_status_json
        test_out = os.path.join(REPO_ROOT, "build", "test_status.json")
        payload = generate_status_json(api_url="http://127.0.0.1:9999", output_path=test_out)

        self.assertTrue(os.path.isfile(test_out))
        self.assertIn("cluster", payload)
        self.assertEqual(payload["cluster"]["name"], "Betanet")
        self.assertEqual(payload["cluster"]["chain_id"], 2)
        self.assertIn("oracle", payload)
        self.assertIn("feed_age_slots", payload["oracle"])
        self.assertIn("slo_indicators", payload)
        self.assertIn("slo_1_freshness", payload["slo_indicators"])

        if os.path.exists(test_out):
            os.remove(test_out)

    def test_simulated_alert_payload_dispatch(self):
        simulated_alert = {
            "version": "4",
            "groupKey": "{}:{alertname=\"OracleFeedSlotLagElevated\"}",
            "status": "firing",
            "receiver": "local_webhook",
            "alerts": [
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "OracleFeedSlotLagElevated",
                        "severity": "warning",
                        "tier": "p2"
                    },
                    "annotations": {
                        "summary": "Oracle Slot Lag Elevated (> 10 Slots)",
                        "description": "Oracle feed age has exceeded 10 slot units on Betanet."
                    },
                    "startsAt": "2026-10-21T22:00:00Z"
                }
            ]
        }
        json_str = json.dumps(simulated_alert)
        self.assertIn("OracleFeedSlotLagElevated", json_str)
        self.assertIn("warning", json_str)

if __name__ == "__main__":
    unittest.main()
