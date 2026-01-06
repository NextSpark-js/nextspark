#!/usr/bin/env python3
"""
Extract Missing Selectors Script

Finds interactive elements (buttons, inputs, links, forms) that are missing
data-cy attributes.

Usage:
    python extract-missing.py --path PATH [--output OUTPUT]

Options:
    --path PATH      Directory to scan
    --output OUTPUT  Output file for results (default: stdout)
    --format FORMAT  Output format: text, json, markdown (default: text)
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from typing import List, Dict, Set

# Interactive elements that should have data-cy
INTERACTIVE_ELEMENTS = [
    'button',
    'Button',
    'input',
    'Input',
    'select',
    'Select',
    'textarea',
    'Textarea',
    'form',
    'Form',
    'a',
    'Link',
]

# Pattern to find JSX elements
JSX_ELEMENT_PATTERN = re.compile(
    r'<(' + '|'.join(INTERACTIVE_ELEMENTS) + r')\s+([^>]*?)(?:/>|>)',
    re.IGNORECASE | re.DOTALL
)

# Pattern to check if data-cy exists
DATA_CY_PATTERN = re.compile(r'data-cy')


def find_tsx_files(path: str) -> List[Path]:
    """Find all TSX files in the given path."""
    root = Path(path)
    return list(root.rglob("*.tsx"))


def analyze_file(file_path: Path) -> Dict:
    """Find interactive elements missing data-cy."""
    missing = []
    has_selector = []

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    # Track line numbers
    for line_num, line in enumerate(lines, 1):
        for match in JSX_ELEMENT_PATTERN.finditer(line):
            element_type = match.group(1)
            attributes = match.group(2)

            element_info = {
                'line': line_num,
                'element': element_type,
                'attributes': attributes[:100] + '...' if len(attributes) > 100 else attributes,
                'context': line.strip()[:120]
            }

            if DATA_CY_PATTERN.search(attributes):
                has_selector.append(element_info)
            else:
                # Skip if it has onClick/onChange but might be internal
                if 'data-cy' not in line:
                    missing.append(element_info)

    return {
        'file': str(file_path),
        'missing': missing,
        'has_selector': has_selector,
        'coverage': len(has_selector) / (len(missing) + len(has_selector)) * 100 if (missing or has_selector) else 100
    }


def suggest_selector(element: str, attributes: str, file_path: str) -> str:
    """Suggest a selector name based on context."""
    # Extract common attributes that might give hints
    name_match = re.search(r'name=["\']([^"\']+)["\']', attributes)
    id_match = re.search(r'id=["\']([^"\']+)["\']', attributes)
    type_match = re.search(r'type=["\']([^"\']+)["\']', attributes)

    # Get component name from file path
    component = Path(file_path).stem.lower().replace('-', '.').replace('_', '.')

    if name_match:
        return f"{component}.{name_match.group(1)}"
    if id_match:
        return f"{component}.{id_match.group(1)}"
    if type_match:
        return f"{component}.{type_match.group(1)}.{element.lower()}"

    return f"{component}.{element.lower()}"


def print_text_report(results: List[Dict]):
    """Print plain text report."""
    total_missing = 0
    total_with = 0

    print("\n" + "=" * 70)
    print("MISSING DATA-CY ATTRIBUTES REPORT")
    print("=" * 70)

    for result in results:
        if result['missing']:
            print(f"\n{result['file']}")
            print(f"Coverage: {result['coverage']:.1f}%")
            print("-" * 50)

            for elem in result['missing']:
                total_missing += 1
                suggestion = suggest_selector(elem['element'], elem['attributes'], result['file'])
                print(f"  Line {elem['line']}: <{elem['element']}> missing data-cy")
                print(f"    Suggestion: data-cy={{sel('{suggestion}')}}")

        total_with += len(result['has_selector'])

    print("\n" + "=" * 70)
    print(f"SUMMARY")
    print("-" * 70)
    print(f"Files scanned: {len(results)}")
    print(f"Elements with data-cy: {total_with}")
    print(f"Elements missing data-cy: {total_missing}")

    if total_missing + total_with > 0:
        coverage = total_with / (total_missing + total_with) * 100
        print(f"Overall coverage: {coverage:.1f}%")
    print("=" * 70 + "\n")


def print_markdown_report(results: List[Dict]):
    """Print markdown report."""
    print("# Missing data-cy Attributes Report\n")

    total_missing = sum(len(r['missing']) for r in results)
    total_with = sum(len(r['has_selector']) for r in results)

    print(f"**Files scanned:** {len(results)}")
    print(f"**Elements with data-cy:** {total_with}")
    print(f"**Elements missing data-cy:** {total_missing}\n")

    for result in results:
        if result['missing']:
            print(f"## {result['file']}\n")
            print(f"Coverage: {result['coverage']:.1f}%\n")
            print("| Line | Element | Suggested Selector |")
            print("|------|---------|-------------------|")

            for elem in result['missing']:
                suggestion = suggest_selector(elem['element'], elem['attributes'], result['file'])
                print(f"| {elem['line']} | `<{elem['element']}>` | `{suggestion}` |")

            print("")


def print_json_report(results: List[Dict]):
    """Print JSON report."""
    output = {
        'summary': {
            'files_scanned': len(results),
            'total_missing': sum(len(r['missing']) for r in results),
            'total_with_selector': sum(len(r['has_selector']) for r in results),
        },
        'files': []
    }

    for result in results:
        if result['missing']:
            file_data = {
                'path': result['file'],
                'coverage': result['coverage'],
                'missing': []
            }
            for elem in result['missing']:
                file_data['missing'].append({
                    'line': elem['line'],
                    'element': elem['element'],
                    'suggestion': suggest_selector(elem['element'], elem['attributes'], result['file'])
                })
            output['files'].append(file_data)

    print(json.dumps(output, indent=2))


def main():
    parser = argparse.ArgumentParser(description='Find elements missing data-cy')
    parser.add_argument('--path', required=True, help='Directory to scan')
    parser.add_argument('--format', choices=['text', 'json', 'markdown'], default='text')
    parser.add_argument('--output', help='Output file (default: stdout)')

    args = parser.parse_args()

    # Find files
    files = find_tsx_files(args.path)

    if not files:
        print(f"No .tsx files found in {args.path}")
        return 1

    # Analyze files
    results = [analyze_file(f) for f in files]

    # Output
    if args.output:
        original_stdout = sys.stdout
        sys.stdout = open(args.output, 'w')

    if args.format == 'json':
        print_json_report(results)
    elif args.format == 'markdown':
        print_markdown_report(results)
    else:
        print_text_report(results)

    if args.output:
        sys.stdout.close()
        sys.stdout = original_stdout
        print(f"Report written to {args.output}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
