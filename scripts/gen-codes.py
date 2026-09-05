#!/usr/bin/env python3
"""Generate redeem-code JSON entries to append to data/codes.json.

This is an operator helper for the static-site MVP allowlist. Codes are
checked in the browser; they are not a secure payment or auth system.

Example:
    python3 scripts/gen-codes.py --monthly 10 --quarterly 5
"""

from __future__ import annotations

import argparse
import json
import secrets
import string
import sys

ALPHABET = string.ascii_uppercase + string.digits
SUFFIX_LEN = 6
MONTHLY_PREFIX = "LLE-M"
QUARTERLY_PREFIX = "LLE-Q"


def random_suffix(length: int = SUFFIX_LEN) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def make_code(prefix: str, existing: set[str]) -> str:
    while True:
        code = f"{prefix}-{random_suffix()}"
        if code not in existing:
            existing.add(code)
            return code


def generate(monthly: int, quarterly: int, existing: set[str] | None = None) -> list[dict[str, str]]:
    seen = set(existing or [])
    entries: list[dict[str, str]] = []
    for _ in range(monthly):
        entries.append({"code": make_code(MONTHLY_PREFIX, seen), "plan": "monthly"})
    for _ in range(quarterly):
        entries.append({"code": make_code(QUARTERLY_PREFIX, seen), "plan": "quarterly"})
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print redeem-code JSON entries to append to data/codes.json."
    )
    parser.add_argument("--monthly", type=int, default=0, help="how many monthly codes to generate")
    parser.add_argument("--quarterly", type=int, default=0, help="how many quarterly codes to generate")
    args = parser.parse_args()

    if args.monthly < 0 or args.quarterly < 0:
        print("error: --monthly and --quarterly must be >= 0", file=sys.stderr)
        return 2
    if args.monthly == 0 and args.quarterly == 0:
        print("error: specify --monthly and/or --quarterly", file=sys.stderr)
        return 2

    print(json.dumps(generate(args.monthly, args.quarterly), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
