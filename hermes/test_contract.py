import json
import unittest
from pathlib import Path
from jsonschema import Draft7Validator, FormatChecker
from adrouter_collector.observer import filter_content

ROOT = Path(__file__).resolve().parents[1]


class ContractTests(unittest.TestCase):
    def test_shared_contract(self):
        validator = Draft7Validator(json.loads((ROOT / "contracts/event.schema.json").read_text()), format_checker=FormatChecker())
        for case in json.loads((ROOT / "fixtures/events.json").read_text()):
            with self.subTest(case=case["name"]):
                self.assertEqual(validator.is_valid(case["event"]), case["valid"])

    def test_privacy(self):
        self.assertIsNone(filter_content("x" * 3000 + " api_key=SYNTHETIC_SECRET"))
        self.assertEqual(filter_content("Contact fake@example.test at https://example.test/private"), "Contact [EMAIL] at [URL]")


if __name__ == "__main__":
    unittest.main()
