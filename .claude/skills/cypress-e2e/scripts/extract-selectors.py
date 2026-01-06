#!/usr/bin/env python3
"""
Extract Selectors Script

Scans React/TypeScript component files for data-cy attributes and generates
a report of selectors found. Useful for auditing selector coverage and
identifying missing selectors.

Usage:
    python extract-selectors.py --component PATH [--output-format FORMAT]

Options:
    --component PATH       Component file or directory to scan
    --output-format FORMAT Output format: json, md, or table (default: table)
    --recursive            Scan directories recursively
    --report-missing       Include analysis of potentially missing selectors
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path
from typing import List, Dict, Set, Optional
from collections import defaultdict


# Patterns for finding data-cy attributes
DATA_CY_PATTERNS = [
    r'data-cy=["\']([^"\']+)["\']',              # data-cy="selector"
    r'data-cy=\{[`"\']([^`"\']+)[`"\']\}',       # data-cy={`selector`}
    r'"data-cy":\s*["\']([^"\']+)["\']',         # "data-cy": "selector"
    r'data-cy=\{.*?\}',                           # Dynamic selectors (will flag for review)
]

# Patterns for potentially interactive elements missing selectors
INTERACTIVE_PATTERNS = [
    (r'<button\b(?![^>]*data-cy)', 'button'),
    (r'<input\b(?![^>]*data-cy)', 'input'),
    (r'<select\b(?![^>]*data-cy)', 'select'),
    (r'<textarea\b(?![^>]*data-cy)', 'textarea'),
    (r'<form\b(?![^>]*data-cy)', 'form'),
    (r'onClick=\{(?![^}]*data-cy)', 'onClick handler'),
    (r'onSubmit=\{(?![^}]*data-cy)', 'onSubmit handler'),
    (r'<Link\b(?![^>]*data-cy)', 'Link component'),
    (r'<a\b(?![^>]*data-cy)(?=[^>]*href)', 'anchor with href'),
]


def extract_selectors(content: str) -> List[Dict]:
    """Extract all data-cy selectors from file content."""
    selectors = []
    lines = content.split('\n')

    for line_num, line in enumerate(lines, 1):
        for pattern in DATA_CY_PATTERNS[:3]:  # Skip dynamic pattern for extraction
            matches = re.findall(pattern, line)
            for match in matches:
                selectors.append({
                    'selector': match,
                    'line': line_num,
                    'context': line.strip()[:100],
                    'is_dynamic': False
                })

        # Check for dynamic selectors
        if re.search(DATA_CY_PATTERNS[3], line):
            if not any(re.search(p, line) for p in DATA_CY_PATTERNS[:3]):
                selectors.append({
                    'selector': '(dynamic)',
                    'line': line_num,
                    'context': line.strip()[:100],
                    'is_dynamic': True
                })

    return selectors


def find_missing_selectors(content: str) -> List[Dict]:
    """Find potentially interactive elements missing data-cy selectors."""
    missing = []
    lines = content.split('\n')

    for line_num, line in enumerate(lines, 1):
        for pattern, element_type in INTERACTIVE_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                # Skip if line has data-cy elsewhere (might be on parent)
                if 'data-cy' not in line:
                    missing.append({
                        'element': element_type,
                        'line': line_num,
                        'context': line.strip()[:100]
                    })

    return missing


def analyze_selector_patterns(selectors: List[Dict]) -> Dict:
    """Analyze selector naming patterns."""
    patterns = defaultdict(int)
    prefixes = defaultdict(int)

    for sel in selectors:
        if sel['is_dynamic']:
            patterns['dynamic'] += 1
            continue

        selector = sel['selector']

        # Count prefixes
        parts = selector.split('.')
        if len(parts) > 1:
            prefixes[parts[0]] += 1

        # Count patterns
        if '-' in selector:
            patterns['kebab-case'] += 1
        if '.' in selector:
            patterns['dot-notation'] += 1
        if selector.startswith(('btn-', 'button-')):
            patterns['button-prefix'] += 1
        if selector.startswith(('form-', 'input-')):
            patterns['form-prefix'] += 1

    return {
        'patterns': dict(patterns),
        'prefixes': dict(prefixes)
    }


def scan_file(file_path: Path, report_missing: bool = False) -> Dict:
    """Scan a single file for selectors."""
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        return {'error': str(e), 'file': str(file_path)}

    selectors = extract_selectors(content)
    result = {
        'file': str(file_path),
        'selectors': selectors,
        'count': len(selectors),
        'dynamic_count': sum(1 for s in selectors if s['is_dynamic'])
    }

    if report_missing:
        missing = find_missing_selectors(content)
        result['missing'] = missing
        result['missing_count'] = len(missing)

    return result


def scan_directory(dir_path: Path, recursive: bool = True, report_missing: bool = False) -> List[Dict]:
    """Scan a directory for selectors in all TypeScript/React files."""
    results = []
    pattern = '**/*.tsx' if recursive else '*.tsx'

    for file_path in dir_path.glob(pattern):
        result = scan_file(file_path, report_missing)
        if result.get('count', 0) > 0 or result.get('missing_count', 0) > 0:
            results.append(result)

    # Also scan .ts files for utility functions
    ts_pattern = '**/*.ts' if recursive else '*.ts'
    for file_path in dir_path.glob(ts_pattern):
        if not file_path.name.endswith('.d.ts'):
            result = scan_file(file_path, report_missing)
            if result.get('count', 0) > 0:
                results.append(result)

    return results


def format_table(results: List[Dict]) -> str:
    """Format results as ASCII table."""
    lines = []
    lines.append("=" * 80)
    lines.append("SELECTOR EXTRACTION REPORT")
    lines.append("=" * 80)

    total_selectors = 0
    total_dynamic = 0
    total_missing = 0
    all_selectors = []

    for result in results:
        if 'error' in result:
            lines.append(f"\nERROR: {result['file']}: {result['error']}")
            continue

        lines.append(f"\n{'-' * 80}")
        lines.append(f"FILE: {result['file']}")
        lines.append(f"Selectors: {result['count']} | Dynamic: {result['dynamic_count']}")

        total_selectors += result['count']
        total_dynamic += result['dynamic_count']

        if result['selectors']:
            lines.append("\n  SELECTORS FOUND:")
            for sel in result['selectors']:
                marker = "[DYN]" if sel['is_dynamic'] else "     "
                lines.append(f"  {marker} Line {sel['line']:4d}: {sel['selector']}")
                all_selectors.append(sel['selector'])

        if result.get('missing'):
            total_missing += result['missing_count']
            lines.append(f"\n  POTENTIALLY MISSING ({result['missing_count']}):")
            for m in result['missing'][:10]:  # Limit to 10 per file
                lines.append(f"    Line {m['line']:4d}: {m['element']} - {m['context'][:60]}...")
            if result['missing_count'] > 10:
                lines.append(f"    ... and {result['missing_count'] - 10} more")

    # Summary
    lines.append("\n" + "=" * 80)
    lines.append("SUMMARY")
    lines.append("=" * 80)
    lines.append(f"Files scanned: {len(results)}")
    lines.append(f"Total selectors: {total_selectors}")
    lines.append(f"Dynamic selectors: {total_dynamic}")
    if total_missing > 0:
        lines.append(f"Potentially missing: {total_missing}")

    # Unique selectors
    unique = set(s for s in all_selectors if s != '(dynamic)')
    lines.append(f"Unique selectors: {len(unique)}")

    # Pattern analysis
    if all_selectors:
        analysis = analyze_selector_patterns([{'selector': s, 'is_dynamic': s == '(dynamic)'} for s in all_selectors])
        if analysis['prefixes']:
            lines.append("\nSelector prefixes:")
            for prefix, count in sorted(analysis['prefixes'].items(), key=lambda x: -x[1])[:5]:
                lines.append(f"  {prefix}: {count}")

    lines.append("=" * 80)

    return '\n'.join(lines)


def format_json(results: List[Dict]) -> str:
    """Format results as JSON."""
    output = {
        'results': results,
        'summary': {
            'files_scanned': len(results),
            'total_selectors': sum(r.get('count', 0) for r in results),
            'dynamic_selectors': sum(r.get('dynamic_count', 0) for r in results),
            'missing_selectors': sum(r.get('missing_count', 0) for r in results),
        }
    }

    # Collect all unique selectors
    all_selectors = []
    for r in results:
        for s in r.get('selectors', []):
            if not s['is_dynamic']:
                all_selectors.append(s['selector'])

    output['summary']['unique_selectors'] = list(set(all_selectors))

    return json.dumps(output, indent=2)


def format_markdown(results: List[Dict]) -> str:
    """Format results as Markdown."""
    lines = []
    lines.append("# Selector Extraction Report\n")

    # Summary table
    total_selectors = sum(r.get('count', 0) for r in results)
    total_dynamic = sum(r.get('dynamic_count', 0) for r in results)
    total_missing = sum(r.get('missing_count', 0) for r in results)

    lines.append("## Summary\n")
    lines.append("| Metric | Count |")
    lines.append("|--------|-------|")
    lines.append(f"| Files scanned | {len(results)} |")
    lines.append(f"| Total selectors | {total_selectors} |")
    lines.append(f"| Dynamic selectors | {total_dynamic} |")
    if total_missing > 0:
        lines.append(f"| Potentially missing | {total_missing} |")
    lines.append("")

    # Unique selectors list
    all_selectors = set()
    for r in results:
        for s in r.get('selectors', []):
            if not s['is_dynamic']:
                all_selectors.add(s['selector'])

    if all_selectors:
        lines.append("## Unique Selectors\n")
        lines.append("```")
        for sel in sorted(all_selectors):
            lines.append(sel)
        lines.append("```\n")

    # Per-file details
    lines.append("## File Details\n")
    for result in results:
        if 'error' in result:
            lines.append(f"### {result['file']}\n")
            lines.append(f"**Error:** {result['error']}\n")
            continue

        lines.append(f"### {result['file']}\n")
        lines.append(f"- **Selectors:** {result['count']}")
        lines.append(f"- **Dynamic:** {result['dynamic_count']}")
        if result.get('missing_count'):
            lines.append(f"- **Missing:** {result['missing_count']}")
        lines.append("")

        if result['selectors']:
            lines.append("| Line | Selector | Dynamic |")
            lines.append("|------|----------|---------|")
            for sel in result['selectors']:
                dyn = "Yes" if sel['is_dynamic'] else "No"
                lines.append(f"| {sel['line']} | `{sel['selector']}` | {dyn} |")
            lines.append("")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Extract data-cy selectors from components')
    parser.add_argument('--component', required=True, help='Component file or directory path')
    parser.add_argument('--output-format', default='table', choices=['json', 'md', 'table'],
                        help='Output format (default: table)')
    parser.add_argument('--recursive', action='store_true', default=True,
                        help='Scan directories recursively')
    parser.add_argument('--report-missing', action='store_true',
                        help='Report potentially missing selectors')
    parser.add_argument('--output', default=None, help='Output file path')

    args = parser.parse_args()

    path = Path(args.component)

    if not path.exists():
        print(f"ERROR: Path does not exist: {path}")
        return 1

    print(f"\n{'=' * 60}")
    print("EXTRACTING SELECTORS")
    print(f"{'=' * 60}")
    print(f"Path: {path}")
    print(f"Format: {args.output_format}")
    print(f"Report missing: {args.report_missing}")
    print(f"{'=' * 60}\n")

    # Scan files
    if path.is_file():
        results = [scan_file(path, args.report_missing)]
    else:
        results = scan_directory(path, args.recursive, args.report_missing)

    if not results:
        print("No files found with selectors.")
        return 0

    # Format output
    if args.output_format == 'json':
        output = format_json(results)
    elif args.output_format == 'md':
        output = format_markdown(results)
    else:
        output = format_table(results)

    # Write or print
    if args.output:
        output_path = Path(args.output)
        output_path.write_text(output, encoding='utf-8')
        print(f"Report written to: {output_path}")
    else:
        print(output)

    return 0


if __name__ == '__main__':
    sys.exit(main())
