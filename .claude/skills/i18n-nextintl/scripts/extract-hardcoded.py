#!/usr/bin/env python3
"""
Extract Hardcoded Strings Script

Finds hardcoded user-facing strings in React/TypeScript components that should
be translated using next-intl.

Usage:
    python extract-hardcoded.py --path PATH [--dry-run]

Options:
    --path PATH     Path to scan for hardcoded strings
    --dry-run       Preview findings without file details
    --ignore-tests  Skip test files (*.test.*, *.spec.*, *.cy.*)
"""

import os
import re
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Tuple


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def should_ignore_file(file_path: str, ignore_tests: bool) -> bool:
    """Check if file should be ignored."""
    ignore_patterns = [
        'node_modules',
        '.next',
        'dist',
        '.git',
        '__pycache__',
        'messages/',  # Translation files themselves
        '.json',
        '.md',
        '.css',
        '.scss',
    ]

    if ignore_tests:
        ignore_patterns.extend(['.test.', '.spec.', '.cy.'])

    for pattern in ignore_patterns:
        if pattern in file_path:
            return True

    return False


def extract_jsx_strings(content: str, file_path: str) -> List[Dict]:
    """Extract potential hardcoded strings from JSX/TSX content."""
    findings = []

    # Pattern 1: Strings in JSX text content (between > and <)
    # Matches: >Hello World< but not >{variable}<
    jsx_text_pattern = r'>([A-Z][^<>{}\n]{2,})<'
    for match in re.finditer(jsx_text_pattern, content):
        text = match.group(1).strip()
        if text and not text.startswith('{') and len(text) > 2:
            line_num = content[:match.start()].count('\n') + 1
            findings.append({
                'type': 'jsx_text',
                'text': text[:80] + ('...' if len(text) > 80 else ''),
                'line': line_num,
                'file': file_path,
                'suggestion': suggest_key(text)
            })

    # Pattern 2: Hardcoded strings in common props (title, placeholder, label, etc.)
    prop_patterns = [
        (r'title=["\']([^"\']+)["\']', 'title_prop'),
        (r'placeholder=["\']([^"\']+)["\']', 'placeholder_prop'),
        (r'label=["\']([^"\']+)["\']', 'label_prop'),
        (r'alt=["\']([^"\']+)["\']', 'alt_prop'),
        (r'aria-label=["\']([^"\']+)["\']', 'aria_label_prop'),
        (r'description=["\']([^"\']+)["\']', 'description_prop'),
    ]

    for pattern, prop_type in prop_patterns:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            text = match.group(1).strip()
            # Skip if it looks like a variable or translation key
            if text and not text.startswith('{') and not is_likely_non_text(text):
                line_num = content[:match.start()].count('\n') + 1
                findings.append({
                    'type': prop_type,
                    'text': text[:60] + ('...' if len(text) > 60 else ''),
                    'line': line_num,
                    'file': file_path,
                    'suggestion': suggest_key(text)
                })

    # Pattern 3: String literals that look like user-facing text
    # This catches: const message = "Welcome back!"
    string_literal_pattern = r'(?:const|let|var)\s+\w+\s*=\s*["\']([A-Z][^"\']{5,})["\']'
    for match in re.finditer(string_literal_pattern, content):
        text = match.group(1).strip()
        if not is_likely_non_text(text):
            line_num = content[:match.start()].count('\n') + 1
            findings.append({
                'type': 'string_literal',
                'text': text[:60] + ('...' if len(text) > 60 else ''),
                'line': line_num,
                'file': file_path,
                'suggestion': suggest_key(text)
            })

    return findings


def is_likely_non_text(text: str) -> bool:
    """Check if string is likely NOT user-facing text."""
    # Skip URLs, paths, technical strings
    non_text_indicators = [
        text.startswith('http'),
        text.startswith('/'),
        text.startswith('@'),
        text.startswith('#'),
        '.com' in text,
        '.org' in text,
        text.isupper() and '_' in text,  # Constants like API_URL
        len(text.split()) == 1 and text.islower(),  # Single lowercase word
        re.match(r'^[a-z-]+$', text),  # kebab-case identifiers
        re.match(r'^[a-zA-Z]+\.[a-zA-Z.]+$', text),  # Dot notation
    ]
    return any(non_text_indicators)


def suggest_key(text: str) -> str:
    """Suggest a translation key based on the text."""
    # Take first few words, convert to camelCase
    words = re.sub(r'[^a-zA-Z\s]', '', text).lower().split()[:4]
    if not words:
        return 'common.text'

    # Convert to camelCase
    key = words[0] + ''.join(w.title() for w in words[1:])
    return f'common.{key}'


def scan_directory(path: str, ignore_tests: bool) -> List[Dict]:
    """Scan directory for hardcoded strings."""
    all_findings = []
    path_obj = Path(path)

    if path_obj.is_file():
        files = [path_obj]
    else:
        files = list(path_obj.rglob('*.tsx')) + list(path_obj.rglob('*.ts'))

    for file_path in files:
        str_path = str(file_path)
        if should_ignore_file(str_path, ignore_tests):
            continue

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Skip files that already use translations properly
            if 'useTranslations' in content or 'getTranslations' in content:
                # Still check for any remaining hardcoded strings
                pass

            findings = extract_jsx_strings(content, str_path)
            all_findings.extend(findings)

        except Exception as e:
            print(f"Warning: Could not read {file_path}: {e}")

    return all_findings


def main():
    parser = argparse.ArgumentParser(description='Find hardcoded strings')
    parser.add_argument('--path', required=True, help='Path to scan')
    parser.add_argument('--dry-run', action='store_true', help='Preview without details')
    parser.add_argument('--ignore-tests', action='store_true', help='Skip test files')

    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"Error: Path not found: {args.path}")
        return 1

    print(f"\n{'=' * 60}")
    print(f"SCANNING FOR HARDCODED STRINGS")
    print(f"{'=' * 60}")
    print(f"Path: {args.path}")
    print(f"Ignore tests: {args.ignore_tests}")
    print(f"{'=' * 60}\n")

    findings = scan_directory(args.path, args.ignore_tests)

    if not findings:
        print("No hardcoded strings found.")
        return 0

    # Group by file
    by_file: Dict[str, List[Dict]] = {}
    for finding in findings:
        file_path = finding['file']
        if file_path not in by_file:
            by_file[file_path] = []
        by_file[file_path].append(finding)

    print(f"Found {len(findings)} potential hardcoded strings in {len(by_file)} files:\n")

    if args.dry_run:
        # Summary only
        for file_path, file_findings in sorted(by_file.items()):
            rel_path = os.path.relpath(file_path)
            print(f"  {rel_path}: {len(file_findings)} findings")
    else:
        # Detailed output
        for file_path, file_findings in sorted(by_file.items()):
            rel_path = os.path.relpath(file_path)
            print(f"\n{'-' * 60}")
            print(f"FILE: {rel_path}")
            print(f"{'-' * 60}")

            for finding in file_findings:
                print(f"  Line {finding['line']}: [{finding['type']}]")
                print(f"    Text: \"{finding['text']}\"")
                print(f"    Suggested key: {finding['suggestion']}")
                print()

    print(f"\n{'=' * 60}")
    print(f"SUMMARY: {len(findings)} hardcoded strings in {len(by_file)} files")
    print(f"{'=' * 60}")
    print("\nTo fix:")
    print("  1. Import useTranslations: import { useTranslations } from 'next-intl'")
    print("  2. Add translations to core/messages/{locale}/ or theme messages")
    print("  3. Replace hardcoded text with t('key')")
    print()

    return 0


if __name__ == '__main__':
    sys.exit(main())
