from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class RepoContractTests(unittest.TestCase):
    def test_required_public_devops_files_exist(self):
        for rel in (
            "AGENTS.md",
            "docs/timeweb-cloud-plugin.md",
            "docs/devops-cycle.md",
            "scripts/verify_repo.py",
            "tools/dev/check",
            ".github/workflows/ci.yml",
        ):
            self.assertTrue((ROOT / rel).is_file(), rel)

    def test_readme_routes_both_timeweb_planes(self):
        text = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("Timeweb Cloud management", text)
        self.assertIn("Timeweb AI Gateway inference", text)
        self.assertIn("docs/timeweb-cloud-plugin.md", text)
        self.assertIn("tools/dev/check", text)

    def test_management_plugin_doc_preserves_provenance_and_boundary(self):
        text = (ROOT / "docs/timeweb-cloud-plugin.md").read_text(encoding="utf-8")
        self.assertIn(
            "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/36",
            text,
        )
        self.assertIn("MANAGEMENT_INTEGRATION_DONE", text)
        self.assertIn("a8e497a9faefdb394f1d5ec6b046c28344f40cde", text)
        self.assertIn("separate credential plane", text)

    def test_no_python_cache_artifacts_are_tracked(self):
        import subprocess
        tracked = subprocess.check_output(["git", "ls-files"], text=True).splitlines()
        bad = [p for p in tracked if "__pycache__/" in p or p.endswith(".pyc")]
        self.assertEqual(bad, [], bad)

    def test_devops_doc_records_exact_cycle_and_authority_boundary(self):
        text = (ROOT / "docs/devops-cycle.md").read_text(encoding="utf-8")
        for phrase in (
            "Issue -> branch -> local QA -> PR -> hosted QA -> exact-head merge -> remote-main readback",
            "tools/dev/check",
            "Branch protection",
            "explicit authority decision",
        ):
            self.assertIn(phrase, text)

if __name__ == "__main__":
    unittest.main()
