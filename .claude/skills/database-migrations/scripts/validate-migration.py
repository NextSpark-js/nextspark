#!/usr/bin/env python3
"""
Validate Migration Script

Validates SQL migration files against project conventions.

Usage:
    python validate-migration.py --file PATH [--strict]
    python validate-migration.py --path DIR [--strict]

Options:
    --file PATH     Single migration file to validate
    --path DIR      Directory of migrations to validate
    --strict        Exit with error if issues found
"""

import os
import sys
import re
import argparse
from pathlib import Path
from typing import List, Dict, Tuple


class ValidationError:
    """Represents a validation issue."""
    def __init__(self, severity: str, message: str, line: int = None, context: str = None):
        self.severity = severity  # 'error', 'warning', 'info'
        self.message = message
        self.line = line
        self.context = context


def validate_timestamptz(content: str, errors: List[ValidationError]) -> None:
    """Check that all timestamps use TIMESTAMPTZ, not TIMESTAMP."""
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        # Skip comments
        if line.strip().startswith('--'):
            continue

        # Check for plain TIMESTAMP (not TIMESTAMPTZ)
        if re.search(r'\bTIMESTAMP\b(?!TZ)', line, re.IGNORECASE):
            errors.append(ValidationError(
                'error',
                'Use TIMESTAMPTZ instead of TIMESTAMP',
                i,
                line.strip()[:60]
            ))

        # Check for CURRENT_TIMESTAMP
        if 'CURRENT_TIMESTAMP' in line.upper():
            errors.append(ValidationError(
                'warning',
                'Use now() instead of CURRENT_TIMESTAMP',
                i,
                line.strip()[:60]
            ))


def validate_id_type(content: str, errors: List[ValidationError]) -> None:
    """Check that IDs use TEXT, not UUID type."""
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        if line.strip().startswith('--'):
            continue

        # Check for UUID PRIMARY KEY (should be TEXT)
        if re.search(r'\bid\s+UUID\s+PRIMARY\s+KEY', line, re.IGNORECASE):
            errors.append(ValidationError(
                'error',
                'Use TEXT PRIMARY KEY, not UUID (Better Auth uses TEXT)',
                i,
                line.strip()[:60]
            ))


def validate_field_ordering(content: str, errors: List[ValidationError]) -> None:
    """Check that fields follow the required ordering."""
    # Find CREATE TABLE blocks
    create_pattern = r'CREATE\s+TABLE[^;]+;'
    for match in re.finditer(create_pattern, content, re.IGNORECASE | re.DOTALL):
        table_def = match.group()

        # Extract field lines
        lines = table_def.split('\n')
        fields = []
        for line in lines:
            # Skip comments and empty lines
            stripped = line.strip()
            if not stripped or stripped.startswith('--') or stripped.startswith('CREATE') or stripped.startswith(')'):
                continue
            if stripped.startswith('CONSTRAINT'):
                continue
            fields.append(stripped)

        if not fields:
            continue

        # Check first field is 'id'
        if fields and not fields[0].strip().lower().startswith('id '):
            errors.append(ValidationError(
                'warning',
                'First field should be "id" (primary key)',
                context=fields[0][:50]
            ))

        # Check system fields are last
        system_fields = ['createdAt', 'updatedAt', 'status']
        found_system = False
        for field in fields:
            for sys_field in system_fields:
                if f'"{sys_field}"' in field or field.strip().startswith(sys_field):
                    found_system = True
                    break
            if found_system:
                # After finding a system field, no business fields should appear
                if not any(sf in field for sf in system_fields) and 'CONSTRAINT' not in field:
                    if re.match(r'^"\w+"\s+', field) and field.strip() != ')':
                        errors.append(ValidationError(
                            'info',
                            'System fields (createdAt, updatedAt) should be last',
                            context=field[:50]
                        ))


def validate_meta_fk_naming(content: str, errors: List[ValidationError]) -> None:
    """Check that meta tables use "entityId" not entity-specific names."""
    if '_metas' not in content.lower():
        return

    # Check for incorrect FK naming patterns
    wrong_patterns = [
        (r'"postId"\s+TEXT\s+NOT\s+NULL\s+REFERENCES', 'Use "entityId" instead of "postId"'),
        (r'"userId"\s+TEXT\s+NOT\s+NULL\s+REFERENCES.*metas', 'Use "entityId" instead of "userId" for meta table'),
        (r'"clientId"\s+TEXT\s+NOT\s+NULL\s+REFERENCES', 'Use "entityId" instead of "clientId"'),
        (r'"taskId"\s+TEXT\s+NOT\s+NULL\s+REFERENCES', 'Use "entityId" instead of "taskId"'),
    ]

    for pattern, message in wrong_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            errors.append(ValidationError(
                'error',
                message
            ))


def validate_child_fk_naming(content: str, errors: List[ValidationError]) -> None:
    """Check that child tables use "parentId" not parent-specific names."""
    # Skip if it's a meta table
    if '_metas' in content.lower():
        return

    # Check for child table patterns (has FK but no userId directly)
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        if line.strip().startswith('--'):
            continue

        # Look for FK references in child tables that aren't "parentId"
        if re.search(r'"(clientId|orderId|productId)"\s+TEXT\s+NOT\s+NULL\s+REFERENCES', line, re.IGNORECASE):
            # Skip if it's the users table reference
            if 'public."users"' in line:
                continue
            errors.append(ValidationError(
                'info',
                'Consider using "parentId" for child entity FK',
                i,
                line.strip()[:60]
            ))


def validate_rls_enabled(content: str, errors: List[ValidationError]) -> None:
    """Check that RLS is enabled for tables."""
    # Find table names
    table_pattern = r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\."(\w+)"'
    tables = re.findall(table_pattern, content, re.IGNORECASE)

    for table in tables:
        # Check if RLS is enabled
        rls_pattern = rf'ALTER\s+TABLE\s+public\."{table}"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY'
        if not re.search(rls_pattern, content, re.IGNORECASE):
            errors.append(ValidationError(
                'warning',
                f'RLS not enabled for table "{table}"',
            ))


def validate_cascade_usage(content: str, errors: List[ValidationError]) -> None:
    """Check that main tables use DROP CASCADE."""
    # Find DROP TABLE statements
    drop_pattern = r'DROP\s+TABLE\s+IF\s+EXISTS\s+public\."(\w+)"'
    for match in re.finditer(drop_pattern, content, re.IGNORECASE):
        table = match.group(1)
        full_match = match.group(0)

        # Skip meta tables
        if '_metas' in table.lower():
            continue

        # Check if CASCADE is used
        line_end = content[match.end():match.end()+20]
        if 'CASCADE' not in line_end.upper():
            errors.append(ValidationError(
                'warning',
                f'Use "DROP TABLE IF EXISTS ... CASCADE" for main table "{table}"',
            ))


def validate_trigger_function(content: str, errors: List[ValidationError]) -> None:
    """Check that triggers use existing Better Auth function."""
    if 'set_updated_at' in content.lower():
        # Check for function redefinition
        if 'CREATE OR REPLACE FUNCTION' in content and 'set_updated_at' in content:
            errors.append(ValidationError(
                'error',
                'Do not redefine set_updated_at() - use existing Better Auth function',
            ))


def validate_file(file_path: Path) -> List[ValidationError]:
    """Validate a single migration file."""
    errors = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        errors.append(ValidationError('error', f'Could not read file: {e}'))
        return errors

    # Run all validations
    validate_timestamptz(content, errors)
    validate_id_type(content, errors)
    validate_field_ordering(content, errors)
    validate_meta_fk_naming(content, errors)
    validate_child_fk_naming(content, errors)
    validate_rls_enabled(content, errors)
    validate_cascade_usage(content, errors)
    validate_trigger_function(content, errors)

    return errors


def main():
    parser = argparse.ArgumentParser(description='Validate migration files')
    parser.add_argument('--file', help='Single migration file to validate')
    parser.add_argument('--path', help='Directory of migrations to validate')
    parser.add_argument('--strict', action='store_true', help='Exit with error if issues found')

    args = parser.parse_args()

    if not args.file and not args.path:
        args.path = 'core/migrations/'

    print(f"\n{'=' * 60}")
    print("MIGRATION VALIDATION")
    print(f"{'=' * 60}")

    files_to_check = []

    if args.file:
        files_to_check.append(Path(args.file))
    elif args.path:
        path = Path(args.path)
        if path.is_dir():
            files_to_check = list(path.glob('*.sql'))
        else:
            print(f"Error: Path not found: {args.path}")
            return 1

    print(f"Checking {len(files_to_check)} file(s)")
    print(f"{'=' * 60}\n")

    total_errors = 0
    total_warnings = 0
    files_with_issues = 0

    for file_path in sorted(files_to_check):
        errors = validate_file(file_path)

        if errors:
            files_with_issues += 1
            print(f"\n{file_path.name}:")
            print("-" * 40)

            for error in errors:
                if error.severity == 'error':
                    total_errors += 1
                    prefix = "  ERROR"
                elif error.severity == 'warning':
                    total_warnings += 1
                    prefix = "  WARN "
                else:
                    prefix = "  INFO "

                line_info = f" (line {error.line})" if error.line else ""
                print(f"{prefix}: {error.message}{line_info}")
                if error.context:
                    print(f"         → {error.context}")

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Files checked: {len(files_to_check)}")
    print(f"  Files with issues: {files_with_issues}")
    print(f"  Errors: {total_errors}")
    print(f"  Warnings: {total_warnings}")
    print(f"{'=' * 60}\n")

    if total_errors == 0 and total_warnings == 0:
        print("All migrations follow conventions.")
        return 0
    elif args.strict and total_errors > 0:
        print("Strict mode: Exiting with error due to validation issues.")
        return 1
    else:
        return 0


if __name__ == '__main__':
    sys.exit(main())
