#!/usr/bin/env python3
"""
Validate Translations Script

Compares translation files between locales to find missing keys.
Validates EN and ES translation completeness.

Usage:
    python validate-translations.py [--theme THEME] [--strict]

Options:
    --theme THEME   Theme to validate (default: from NEXT_PUBLIC_ACTIVE_THEME or 'default')
    --strict        Exit with error if missing keys found
    --core-only     Only validate core messages
    --theme-only    Only validate theme messages
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Set, Tuple


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def flatten_keys(obj: dict, prefix: str = '') -> Set[str]:
    """Flatten nested dict to set of dot-notation keys."""
    keys = set()
    for key, value in obj.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            keys.update(flatten_keys(value, full_key))
        else:
            keys.add(full_key)
    return keys


def load_json_file(file_path: Path) -> dict:
    """Load JSON file and return dict."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        print(f"  Warning: Invalid JSON in {file_path}: {e}")
        return {}


def load_core_messages(locale: str) -> dict:
    """Load core messages for a locale by combining all JSON files."""
    core_path = Path(f'core/messages/{locale}')
    if not core_path.exists():
        return {}

    combined = {}
    for json_file in core_path.glob('*.json'):
        data = load_json_file(json_file)
        # Use filename (without extension) as namespace
        namespace = json_file.stem
        if namespace == 'index':
            continue
        combined[namespace] = data

    return combined


def load_theme_messages(theme: str, locale: str) -> dict:
    """Load theme messages for a locale."""
    theme_path = Path(f'contents/themes/{theme}/messages/{locale}.json')
    return load_json_file(theme_path)


def compare_translations(
    en_keys: Set[str],
    es_keys: Set[str],
    source_name: str
) -> Tuple[Set[str], Set[str]]:
    """Compare EN and ES keys, return missing in each."""
    missing_in_es = en_keys - es_keys
    missing_in_en = es_keys - en_keys
    return missing_in_es, missing_in_en


def validate_core_messages() -> Tuple[int, int]:
    """Validate core messages between EN and ES."""
    print("\n" + "=" * 60)
    print("VALIDATING CORE MESSAGES")
    print("=" * 60)

    en_messages = load_core_messages('en')
    es_messages = load_core_messages('es')

    if not en_messages:
        print("  Warning: No English core messages found at core/messages/en/")
        return 0, 0

    en_keys = flatten_keys(en_messages)
    es_keys = flatten_keys(es_messages)

    print(f"  EN keys: {len(en_keys)}")
    print(f"  ES keys: {len(es_keys)}")

    missing_in_es, missing_in_en = compare_translations(en_keys, es_keys, "core")

    total_missing = len(missing_in_es) + len(missing_in_en)

    if missing_in_es:
        print(f"\n  Missing in ES ({len(missing_in_es)}):")
        for key in sorted(missing_in_es)[:20]:
            print(f"    - {key}")
        if len(missing_in_es) > 20:
            print(f"    ... and {len(missing_in_es) - 20} more")

    if missing_in_en:
        print(f"\n  Extra in ES (not in EN) ({len(missing_in_en)}):")
        for key in sorted(missing_in_en)[:10]:
            print(f"    - {key}")
        if len(missing_in_en) > 10:
            print(f"    ... and {len(missing_in_en) - 10} more")

    if total_missing == 0:
        print("\n  Core messages: COMPLETE")

    return len(missing_in_es), len(missing_in_en)


def validate_theme_messages(theme: str) -> Tuple[int, int]:
    """Validate theme messages between EN and ES."""
    print("\n" + "=" * 60)
    print(f"VALIDATING THEME MESSAGES: {theme}")
    print("=" * 60)

    en_messages = load_theme_messages(theme, 'en')
    es_messages = load_theme_messages(theme, 'es')

    if not en_messages:
        print(f"  Warning: No English theme messages found for theme '{theme}'")
        return 0, 0

    en_keys = flatten_keys(en_messages)
    es_keys = flatten_keys(es_messages)

    print(f"  EN keys: {len(en_keys)}")
    print(f"  ES keys: {len(es_keys)}")

    missing_in_es, missing_in_en = compare_translations(en_keys, es_keys, f"theme-{theme}")

    total_missing = len(missing_in_es) + len(missing_in_en)

    if missing_in_es:
        print(f"\n  Missing in ES ({len(missing_in_es)}):")
        for key in sorted(missing_in_es)[:20]:
            print(f"    - {key}")
        if len(missing_in_es) > 20:
            print(f"    ... and {len(missing_in_es) - 20} more")

    if missing_in_en:
        print(f"\n  Extra in ES (not in EN) ({len(missing_in_en)}):")
        for key in sorted(missing_in_en)[:10]:
            print(f"    - {key}")
        if len(missing_in_en) > 10:
            print(f"    ... and {len(missing_in_en) - 10} more")

    if total_missing == 0:
        print("\n  Theme messages: COMPLETE")

    return len(missing_in_es), len(missing_in_en)


def check_custom_roles_in_core() -> List[str]:
    """Check if custom roles are incorrectly defined in core messages."""
    print("\n" + "=" * 60)
    print("CHECKING CUSTOM ROLES POLICY")
    print("=" * 60)

    core_en = load_core_messages('en')
    violations = []

    # Custom roles that should NEVER be in core
    forbidden_roles = ['editor', 'moderator', 'contributor', 'reviewer', 'publisher']

    # Check teams.roles namespace
    teams_roles = core_en.get('teams', {}).get('roles', {})
    for role in forbidden_roles:
        if role in teams_roles:
            violations.append(f"teams.roles.{role}")

    if violations:
        print(f"\n  VIOLATION: Custom roles found in core/messages/")
        print(f"  These should be in theme messages only:")
        for v in violations:
            print(f"    - {v}")
    else:
        print("\n  Custom roles policy: OK")

    return violations


def main():
    parser = argparse.ArgumentParser(description='Validate translations')
    parser.add_argument('--theme', default=None, help='Theme to validate')
    parser.add_argument('--strict', action='store_true', help='Exit with error if issues found')
    parser.add_argument('--core-only', action='store_true', help='Only validate core messages')
    parser.add_argument('--theme-only', action='store_true', help='Only validate theme messages')

    args = parser.parse_args()

    theme = args.theme or get_active_theme()

    print(f"\n{'=' * 60}")
    print(f"TRANSLATION VALIDATION")
    print(f"{'=' * 60}")
    print(f"Theme: {theme}")
    print(f"Strict mode: {args.strict}")
    print(f"{'=' * 60}")

    total_issues = 0

    # Validate core messages
    if not args.theme_only:
        missing_es, extra_es = validate_core_messages()
        total_issues += missing_es

        # Check custom roles policy
        role_violations = check_custom_roles_in_core()
        total_issues += len(role_violations)

    # Validate theme messages
    if not args.core_only:
        missing_es, extra_es = validate_theme_messages(theme)
        total_issues += missing_es

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    if total_issues == 0:
        print("  All translations are complete!")
        print("=" * 60 + "\n")
        return 0
    else:
        print(f"  Total issues found: {total_issues}")
        print("=" * 60 + "\n")

        if args.strict:
            print("Strict mode: Exiting with error due to missing translations")
            return 1

        return 0


if __name__ == '__main__':
    sys.exit(main())
