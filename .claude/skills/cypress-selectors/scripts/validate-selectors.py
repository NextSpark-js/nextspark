#!/usr/bin/env python3
"""
Validate Selectors Script

Validates that all data-cy attributes in components use the sel() function
instead of hardcoded strings.

Usage:
    python validate-selectors.py [--path PATH] [--fix]

Options:
    --path PATH    Directory to scan (default: contents/themes/)
    --fix          Attempt to auto-fix simple violations
"""

import os
import re
import sys
import argparse
from pathlib import Path
from typing import List, Tuple, Dict

# Patterns
HARDCODED_DATA_CY = re.compile(r'data-cy=["\']([^"\']+)["\']')
VALID_SEL_PATTERN = re.compile(r'data-cy=\{sel\(["\']([^"\']+)["\']')
VALID_S_PATTERN = re.compile(r'data-cy=\{s\(["\']([^"\']+)["\']')


def find_tsx_files(path: str) -> List[Path]:
    """Find all TSX files in the given path."""
    root = Path(path)
    return list(root.rglob("*.tsx"))


def analyze_file(file_path: Path) -> Dict:
    """Analyze a single file for selector issues."""
    issues = []
    valid_count = 0

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    for line_num, line in enumerate(lines, 1):
        # Check for hardcoded data-cy
        hardcoded = HARDCODED_DATA_CY.findall(line)
        for selector in hardcoded:
            issues.append({
                'line': line_num,
                'type': 'hardcoded',
                'selector': selector,
                'context': line.strip()
            })

        # Count valid usages
        valid_sel = VALID_SEL_PATTERN.findall(line)
        valid_s = VALID_S_PATTERN.findall(line)
        valid_count += len(valid_sel) + len(valid_s)

    return {
        'file': str(file_path),
        'issues': issues,
        'valid_count': valid_count
    }


def print_report(results: List[Dict], verbose: bool = False) -> Tuple[int, int]:
    """Print validation report."""
    total_issues = 0
    total_valid = 0
    files_with_issues = []

    for result in results:
        total_valid += result['valid_count']
        if result['issues']:
            files_with_issues.append(result)
            total_issues += len(result['issues'])

    print("\n" + "=" * 60)
    print("CYPRESS SELECTORS VALIDATION REPORT")
    print("=" * 60)

    if files_with_issues:
        print(f"\n{'VIOLATIONS FOUND':^60}")
        print("-" * 60)

        for result in files_with_issues:
            print(f"\n{result['file']}")
            for issue in result['issues']:
                print(f"  Line {issue['line']}: {issue['type'].upper()}")
                print(f"    Selector: {issue['selector']}")
                if verbose:
                    print(f"    Context: {issue['context'][:80]}...")
                print(f"    Fix: Use sel('{convert_to_path(issue['selector'])}')")
    else:
        print(f"\n{'NO VIOLATIONS FOUND':^60}")

    print("\n" + "-" * 60)
    print(f"Total files scanned: {len(results)}")
    print(f"Valid sel() usages: {total_valid}")
    print(f"Violations found: {total_issues}")
    print("=" * 60 + "\n")

    return total_issues, total_valid


def convert_to_path(selector: str) -> str:
    """Convert a hardcoded selector to a sel() path suggestion."""
    # Split by common separators
    parts = re.split(r'[-_]', selector)

    # Try to create a reasonable path
    if len(parts) >= 2:
        return f"{parts[0]}.{'.'.join(parts[1:])}"
    return selector


def main():
    parser = argparse.ArgumentParser(description='Validate Cypress selectors')
    parser.add_argument('--path', default='contents/themes/', help='Directory to scan')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show context')
    parser.add_argument('--exit-code', action='store_true', help='Exit with error if violations found')

    args = parser.parse_args()

    # Find files
    files = find_tsx_files(args.path)

    if not files:
        print(f"No .tsx files found in {args.path}")
        return 0

    # Analyze files
    results = [analyze_file(f) for f in files]

    # Print report
    violations, valid = print_report(results, args.verbose)

    if args.exit_code and violations > 0:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
