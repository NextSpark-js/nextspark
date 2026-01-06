#!/usr/bin/env python3
"""
Add Translation Script

Adds a translation key to both EN and ES locales.
Supports both core messages and theme messages.

Usage:
    python add-translation.py --key KEY --en VALUE --es VALUE [--theme THEME]

Options:
    --key KEY       Dot-notation key (e.g., "settings.profile.title")
    --en VALUE      English translation value
    --es VALUE      Spanish translation value
    --theme THEME   Add to theme messages instead of core
    --namespace NS  Core namespace file (e.g., "dashboard", "common")
    --dry-run       Preview without writing files
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def load_json_file(file_path: Path) -> dict:
    """Load JSON file and return dict."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        print(f"  Error: Invalid JSON in {file_path}: {e}")
        sys.exit(1)


def save_json_file(file_path: Path, data: dict, dry_run: bool = False) -> None:
    """Save dict to JSON file with proper formatting."""
    if dry_run:
        print(f"  Would write to: {file_path}")
        return

    # Ensure parent directory exists
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')  # Add trailing newline


def set_nested_value(data: dict, key_path: str, value: Any) -> dict:
    """Set a value in a nested dict using dot notation."""
    keys = key_path.split('.')
    current = data

    # Navigate to the parent of the target key
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        elif not isinstance(current[key], dict):
            # Key exists but is not a dict, cannot proceed
            raise ValueError(f"Cannot set '{key_path}': '{key}' is not an object")
        current = current[key]

    # Set the final value
    current[keys[-1]] = value
    return data


def get_nested_value(data: dict, key_path: str) -> Any:
    """Get a value from a nested dict using dot notation."""
    keys = key_path.split('.')
    current = data

    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]

    return current


def infer_namespace(key: str) -> str:
    """Infer namespace from key path."""
    # First part of key is typically the namespace
    parts = key.split('.')
    if len(parts) >= 1:
        return parts[0]
    return 'common'


def add_to_core(key: str, en_value: str, es_value: str, namespace: str, dry_run: bool) -> bool:
    """Add translation to core messages."""
    # Determine file paths
    en_path = Path(f'core/messages/en/{namespace}.json')
    es_path = Path(f'core/messages/es/{namespace}.json')

    # Load existing data
    en_data = load_json_file(en_path)
    es_data = load_json_file(es_path)

    # Remove namespace prefix from key if it matches
    key_without_ns = key
    if key.startswith(f'{namespace}.'):
        key_without_ns = key[len(namespace) + 1:]

    # Check if key already exists
    if get_nested_value(en_data, key_without_ns) is not None:
        print(f"  Warning: Key '{key}' already exists in EN")

    # Set values
    en_data = set_nested_value(en_data, key_without_ns, en_value)
    es_data = set_nested_value(es_data, key_without_ns, es_value)

    # Save files
    save_json_file(en_path, en_data, dry_run)
    save_json_file(es_path, es_data, dry_run)

    return True


def add_to_theme(key: str, en_value: str, es_value: str, theme: str, dry_run: bool) -> bool:
    """Add translation to theme messages."""
    en_path = Path(f'contents/themes/{theme}/messages/en.json')
    es_path = Path(f'contents/themes/{theme}/messages/es.json')

    # Check if theme exists
    theme_path = Path(f'contents/themes/{theme}')
    if not theme_path.exists():
        print(f"  Error: Theme '{theme}' not found at {theme_path}")
        return False

    # Load existing data
    en_data = load_json_file(en_path)
    es_data = load_json_file(es_path)

    # Check if key already exists
    if get_nested_value(en_data, key) is not None:
        print(f"  Warning: Key '{key}' already exists in EN")

    # Set values
    en_data = set_nested_value(en_data, key, en_value)
    es_data = set_nested_value(es_data, key, es_value)

    # Save files
    save_json_file(en_path, en_data, dry_run)
    save_json_file(es_path, es_data, dry_run)

    return True


def main():
    parser = argparse.ArgumentParser(description='Add translation key')
    parser.add_argument('--key', required=True, help='Dot-notation key path')
    parser.add_argument('--en', required=True, help='English value')
    parser.add_argument('--es', required=True, help='Spanish value')
    parser.add_argument('--theme', default=None, help='Add to theme instead of core')
    parser.add_argument('--namespace', default=None, help='Core namespace file')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')

    args = parser.parse_args()

    print(f"\n{'=' * 60}")
    print(f"ADDING TRANSLATION")
    print(f"{'=' * 60}")
    print(f"Key: {args.key}")
    print(f"EN: {args.en}")
    print(f"ES: {args.es}")

    if args.theme:
        print(f"Target: Theme ({args.theme})")
    else:
        namespace = args.namespace or infer_namespace(args.key)
        print(f"Target: Core (namespace: {namespace})")

    print(f"Dry run: {args.dry_run}")
    print(f"{'=' * 60}\n")

    try:
        if args.theme:
            # Add to theme messages
            success = add_to_theme(args.key, args.en, args.es, args.theme, args.dry_run)
        else:
            # Add to core messages
            namespace = args.namespace or infer_namespace(args.key)
            success = add_to_core(args.key, args.en, args.es, namespace, args.dry_run)

        if success:
            if args.dry_run:
                print("  DRY RUN: No files were modified")
            else:
                print("  Translation added successfully!")

            print(f"\n{'=' * 60}")
            print("USAGE IN COMPONENT:")
            print("=" * 60)

            # Show usage example
            namespace = args.namespace or infer_namespace(args.key)
            key_parts = args.key.split('.')
            if len(key_parts) > 1:
                t_namespace = key_parts[0]
                t_key = '.'.join(key_parts[1:])
            else:
                t_namespace = namespace
                t_key = args.key

            print(f"""
  // Client component
  import {{ useTranslations }} from 'next-intl'

  const t = useTranslations('{t_namespace}')
  <span>{{t('{t_key}')}}</span>

  // Server component
  import {{ getTranslations }} from 'next-intl/server'

  const t = await getTranslations('{t_namespace}')
  <span>{{t('{t_key}')}}</span>
""")
            print("=" * 60 + "\n")
            return 0
        else:
            return 1

    except ValueError as e:
        print(f"  Error: {e}")
        return 1
    except Exception as e:
        print(f"  Unexpected error: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
