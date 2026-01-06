#!/usr/bin/env python3
"""
Validate API Structure Script

Validates API routes for proper patterns, authentication, and response helpers.

Usage:
    python validate-api.py [--path PATH] [--fix]

Options:
    --path PATH    Directory to scan (default: app/api/v1/)
    --strict       Exit with error if violations found
    --json         Output results as JSON
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple


# Patterns to check
PATTERNS = {
    'has_auth': re.compile(r'authenticateRequest|hasRequiredScope'),
    'has_response_helper': re.compile(r'createApiResponse|createApiError'),
    'raw_next_response': re.compile(r'NextResponse\.json\('),
    'raw_error': re.compile(r'return.*error.*message', re.IGNORECASE),
    'deprecated_meta': re.compile(r'includeMeta'),
    'hardcoded_status': re.compile(r'status:\s*\d+'),
    'console_log': re.compile(r'console\.log\('),
    'has_zod': re.compile(r'from\s+[\'"]zod[\'""]|z\.object|z\.string'),
    'sql_concat': re.compile(r'\$\{.*\}.*SELECT|INSERT|UPDATE|DELETE', re.IGNORECASE),
    'cors_handler': re.compile(r'OPTIONS'),
    'pagination': re.compile(r'pagination|page|limit|offset'),
}

# HTTP methods to look for
HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']


def find_route_files(path: str) -> List[Path]:
    """Find all route.ts files in the API directory."""
    root = Path(path)
    return list(root.rglob("route.ts"))


def analyze_route(file_path: Path) -> Dict:
    """Analyze a single route file for patterns."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract exported methods
    methods = []
    for method in HTTP_METHODS:
        if re.search(rf'export\s+(async\s+)?function\s+{method}', content):
            methods.append(method)
        elif re.search(rf'export\s+const\s+{method}\s*=', content):
            methods.append(method)

    # Check patterns
    issues = []
    warnings = []
    info = []

    # Auth check
    has_auth = bool(PATTERNS['has_auth'].search(content))
    if not has_auth and methods:
        # Check if it's a public endpoint
        if '/auth/' not in str(file_path) and '(contents)' not in str(file_path):
            issues.append({
                'type': 'missing_auth',
                'message': 'No authentication found',
                'severity': 'error'
            })

    # Response helper check
    has_response_helper = bool(PATTERNS['has_response_helper'].search(content))
    if not has_response_helper and methods:
        issues.append({
            'type': 'missing_response_helper',
            'message': 'Not using createApiResponse/createApiError helpers',
            'severity': 'error'
        })

    # Raw NextResponse check
    if PATTERNS['raw_next_response'].search(content):
        issues.append({
            'type': 'raw_response',
            'message': 'Using raw NextResponse.json() instead of helpers',
            'severity': 'warning'
        })

    # Deprecated meta parameter
    if PATTERNS['deprecated_meta'].search(content):
        issues.append({
            'type': 'deprecated_param',
            'message': 'Using deprecated includeMeta parameter (use metas=all)',
            'severity': 'warning'
        })

    # Console.log in production code
    if PATTERNS['console_log'].search(content):
        warnings.append({
            'type': 'console_log',
            'message': 'console.log found - consider using proper logging',
            'severity': 'info'
        })

    # Input validation
    has_zod = bool(PATTERNS['has_zod'].search(content))
    if 'POST' in methods or 'PATCH' in methods or 'PUT' in methods:
        if not has_zod:
            warnings.append({
                'type': 'no_validation',
                'message': 'No Zod validation found for mutation endpoint',
                'severity': 'warning'
            })

    # SQL injection risk
    if PATTERNS['sql_concat'].search(content):
        issues.append({
            'type': 'sql_injection_risk',
            'message': 'Potential SQL injection - string interpolation in query',
            'severity': 'error'
        })

    # CORS handler
    has_cors = 'OPTIONS' in methods
    if methods and not has_cors:
        info.append({
            'type': 'no_cors',
            'message': 'No OPTIONS handler for CORS',
            'severity': 'info'
        })

    # Pagination for GET lists
    if 'GET' in methods and 'list' in str(file_path).lower():
        has_pagination = bool(PATTERNS['pagination'].search(content))
        if not has_pagination:
            warnings.append({
                'type': 'no_pagination',
                'message': 'List endpoint without pagination',
                'severity': 'warning'
            })

    return {
        'file': str(file_path),
        'methods': methods,
        'has_auth': has_auth,
        'has_response_helper': has_response_helper,
        'has_validation': has_zod,
        'issues': issues,
        'warnings': warnings,
        'info': info
    }


def print_text_report(results: List[Dict]) -> Tuple[int, int, int]:
    """Print text report of findings."""
    total_errors = 0
    total_warnings = 0
    total_info = 0

    print("\n" + "=" * 70)
    print("API STRUCTURE VALIDATION REPORT")
    print("=" * 70)

    # Group by status
    files_with_errors = []
    files_with_warnings = []
    files_ok = []

    for result in results:
        if result['issues']:
            files_with_errors.append(result)
            total_errors += len(result['issues'])
        elif result['warnings']:
            files_with_warnings.append(result)
        else:
            files_ok.append(result)

        total_warnings += len(result['warnings'])
        total_info += len(result['info'])

    # Print errors
    if files_with_errors:
        print(f"\n{'ERRORS':^70}")
        print("-" * 70)
        for result in files_with_errors:
            print(f"\n{result['file']}")
            print(f"  Methods: {', '.join(result['methods']) or 'None'}")
            for issue in result['issues']:
                print(f"  [ERROR] {issue['message']}")

    # Print warnings
    if files_with_warnings:
        print(f"\n{'WARNINGS':^70}")
        print("-" * 70)
        for result in files_with_warnings:
            print(f"\n{result['file']}")
            for warning in result['warnings']:
                print(f"  [WARN] {warning['message']}")

    # Summary
    print("\n" + "-" * 70)
    print(f"{'SUMMARY':^70}")
    print("-" * 70)
    print(f"Files scanned: {len(results)}")
    print(f"Files with errors: {len(files_with_errors)}")
    print(f"Files with warnings: {len(files_with_warnings)}")
    print(f"Files OK: {len(files_ok)}")
    print(f"\nTotal errors: {total_errors}")
    print(f"Total warnings: {total_warnings}")
    print(f"Total info: {total_info}")

    # Coverage stats
    auth_count = sum(1 for r in results if r['has_auth'])
    helper_count = sum(1 for r in results if r['has_response_helper'])
    validation_count = sum(1 for r in results if r['has_validation'])

    print(f"\nAuthentication coverage: {auth_count}/{len(results)} ({auth_count/len(results)*100:.1f}%)")
    print(f"Response helper usage: {helper_count}/{len(results)} ({helper_count/len(results)*100:.1f}%)")
    print(f"Input validation usage: {validation_count}/{len(results)} ({validation_count/len(results)*100:.1f}%)")

    print("=" * 70 + "\n")

    return total_errors, total_warnings, total_info


def print_json_report(results: List[Dict]):
    """Print JSON report."""
    output = {
        'summary': {
            'files_scanned': len(results),
            'files_with_errors': sum(1 for r in results if r['issues']),
            'files_with_warnings': sum(1 for r in results if r['warnings']),
            'total_errors': sum(len(r['issues']) for r in results),
            'total_warnings': sum(len(r['warnings']) for r in results),
        },
        'results': results
    }
    print(json.dumps(output, indent=2))


def main():
    parser = argparse.ArgumentParser(description='Validate API structure')
    parser.add_argument('--path', default='app/api/v1/', help='Directory to scan')
    parser.add_argument('--strict', action='store_true', help='Exit with error if violations found')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    # Find route files
    files = find_route_files(args.path)

    if not files:
        print(f"No route.ts files found in {args.path}")
        return 0

    print(f"Scanning {len(files)} route files...")

    # Analyze files
    results = [analyze_route(f) for f in files]

    # Output report
    if args.json:
        print_json_report(results)
        errors = sum(len(r['issues']) for r in results)
    else:
        errors, warnings, info = print_text_report(results)

    # Exit code
    if args.strict and errors > 0:
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
