#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    "README.md",
    "AGENTS.md",
    "docs/timeweb-cloud-plugin.md",
    "docs/devops-cycle.md",
    "scripts/verify_repo.py",
    "tools/dev/check",
    ".github/workflows/ci.yml",
    "tests/test_repo_contract.py",
]

SECRET_PATTERNS = {
    "OpenAI-style key": re.compile(r"\\bsk-[A-Za-z0-9_-]{20,}\\b"),
    "GitHub classic token": re.compile(r"\\bghp_[A-Za-z0-9]{20,}\\b"),
    "GitHub fine-grained token": re.compile(r"\\bgithub_pat_[A-Za-z0-9_]{20,}\\b"),
    "AWS access key": re.compile(r"\\bAKIA[0-9A-Z]{16}\\b"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "literal bearer token": re.compile(r"Authorization:\\s*Bearer\\s+(?![<$])[A-Za-z0-9._~+/=-]{24,}"),
}

TEXT_SUFFIXES = {".md", ".py", ".sh", ".yml", ".yaml", ".json", ".toml", ".txt"}


def fail(message: str) -> None:
    raise SystemExit(f"REPO_VERIFY_FAIL: {message}")


def iter_text_files():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if ".git" in path.parts or "__pycache__" in path.parts:
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {"AGENTS.md", "README.md"}:
            continue
        yield path


def main() -> None:
    for rel in REQUIRED:
        if not (ROOT / rel).is_file():
            fail(f"missing required file: {rel}")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    if "Private infrastructure" in readme:
        fail("README still claims repository is private")
    if "docs/timeweb-cloud-plugin.md" not in readme:
        fail("README does not link management plugin documentation")

    plugin_doc = (ROOT / "docs/timeweb-cloud-plugin.md").read_text(encoding="utf-8")
    provenance = "https://github.com/TeaShaman-cyber/theseus-local-lab/issues/36"
    if provenance not in plugin_doc:
        fail("management plugin provenance link missing")

    for path in iter_text_files():
        content = path.read_text(encoding="utf-8")
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(content):
                fail(f"{label} pattern found in {path.relative_to(ROOT)}")

    print("REPO_VERIFY_PASS")


if __name__ == "__main__":
    main()
