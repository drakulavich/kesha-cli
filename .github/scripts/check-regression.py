#!/usr/bin/env python3
"""Check benchmark results for regression against previous results.

Usage: check-regression.py <current-summary.json> <benchmark.md> [--threshold=0.2]
Exit code 1 if parakeet_total degraded by more than threshold (default 20%).
"""

import json
import re
import sys


def extract_previous_total(benchmark_md, marker_start, marker_end):
    """Extract previous parakeet total from BENCHMARK.md between markers."""
    try:
        content = open(benchmark_md).read()
    except FileNotFoundError:
        return None

    pattern = f"({re.escape(marker_start)})(.+?)({re.escape(marker_end)})"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return None

    section = match.group(2)
    # Find "| **Total** | **Xs** | **Ys** |" and extract Y (parakeet total)
    total_match = re.search(r"\*\*Total\*\*.*?\*\*(\d+\.?\d*)s\*\*.*?\*\*(\d+\.?\d*)s\*\*", section)
    if not total_match:
        return None

    return float(total_match.group(2))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    threshold = 0.2
    for a in sys.argv[1:]:
        if a.startswith("--threshold="):
            threshold = float(a.split("=")[1])

    if len(args) < 2:
        print("Usage: check-regression.py <summary.json> <benchmark.md>", file=sys.stderr)
        sys.exit(1)

    summary_path, benchmark_path = args[0], args[1]

    current = json.load(open(summary_path))
    current_total = current["parakeet_total"]

    previous_total = extract_previous_total(
        benchmark_path, "<!-- CI-BENCHMARK-START -->", "<!-- CI-BENCHMARK-END -->"
    )

    if previous_total is None:
        print(f"No previous results found. Current: {current_total}s")
        sys.exit(0)

    if previous_total == 0:
        print(f"Previous total is 0, skipping regression check. Current: {current_total}s")
        sys.exit(0)

    degradation = (current_total - previous_total) / previous_total
    print(f"Previous: {previous_total}s | Current: {current_total}s | Change: {degradation:+.1%}")

    if degradation > threshold:
        print(f"REGRESSION: {degradation:+.1%} exceeds {threshold:.0%} threshold")
        sys.exit(1)

    print("OK: No significant regression.")


if __name__ == "__main__":
    main()
