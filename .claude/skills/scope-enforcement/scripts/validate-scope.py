#!/usr/bin/env python3
"""
Validate Scope Script

Validates file modifications against session scope.json configuration.
Part of the scope-enforcement skill.

Usage:
    python validate-scope.py --session ".claude/sessions/2025-12-30-feature-v1"
    python validate-scope.py -s ".claude/sessions/2025-12-30-feature-v1" --files "core/lib/x.ts,app/api/y/route.ts"
    python validate-scope.py -s ".claude/sessions/2025-12-30-feature-v1" --git  # Check git changes
"""

import argparse
import fnmatch
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional


def get_project_root() -> Path:
    """Find the project root by looking for .claude directory."""
    current = Path(__file__).resolve()

    # Walk up the directory tree
    for parent in current.parents:
        if (parent / ".claude").is_dir():
            return parent

    # Fallback: check current working directory
    cwd = Path.cwd()
    if (cwd / ".claude").is_dir():
        return cwd

    print("Error: Could not find project root (.claude directory)")
    sys.exit(1)


def read_scope_config(session_path: Path) -> Dict[str, Any]:
    """Read and parse scope.json from session folder."""
    scope_file = session_path / "scope.json"

    if not scope_file.exists():
        print(f"Error: scope.json not found in {session_path}")
        sys.exit(1)

    try:
        with open(scope_file, "r") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in scope.json: {e}")
        sys.exit(1)


def build_allowed_paths(scope_config: Dict[str, Any]) -> List[str]:
    """Build list of allowed paths from scope configuration."""
    allowed_paths = [".claude/sessions/**/*"]

    scope = scope_config.get("scope", {})

    # Core paths
    if scope.get("core", False):
        allowed_paths.extend([
            "core/**/*",
            "app/**/*",
            "scripts/**/*",
            "migrations/**/*",
            "core/migrations/**/*"
        ])

    # Theme paths
    theme = scope.get("theme")
    if theme and theme != False:
        allowed_paths.append(f"contents/themes/{theme}/**/*")

    # Plugin paths
    plugins = scope.get("plugins")
    if isinstance(plugins, list):
        for plugin in plugins:
            allowed_paths.append(f"contents/plugins/{plugin}/**/*")

    # Exceptions
    exceptions = scope_config.get("exceptions", [])
    allowed_paths.extend(exceptions)

    # Also check allowedPaths if explicitly defined
    explicit_paths = scope_config.get("allowedPaths", [])
    allowed_paths.extend(explicit_paths)

    return allowed_paths


def matches_pattern(file_path: str, pattern: str) -> bool:
    """Check if file path matches glob pattern."""
    # Normalize paths
    file_path = file_path.replace("\\", "/")
    pattern = pattern.replace("\\", "/")

    # Handle ** patterns
    if "**" in pattern:
        # Split pattern into parts
        parts = pattern.split("**")
        if len(parts) == 2:
            prefix, suffix = parts
            prefix = prefix.rstrip("/")
            suffix = suffix.lstrip("/")

            # Check if file starts with prefix
            if prefix and not file_path.startswith(prefix):
                return False

            # If suffix is "*", match anything after prefix
            if suffix == "*" or suffix == "/*":
                return file_path.startswith(prefix)

            # Check if file ends with suffix pattern
            if suffix:
                remaining = file_path[len(prefix):].lstrip("/")
                return fnmatch.fnmatch(remaining, f"**/{suffix}") or fnmatch.fnmatch(remaining, suffix)

            return file_path.startswith(prefix)

    # Standard glob matching
    return fnmatch.fnmatch(file_path, pattern)


def validate_files(files: List[str], allowed_paths: List[str]) -> Dict[str, List[str]]:
    """Validate files against allowed paths."""
    valid_files = []
    violations = []

    for file_path in files:
        # Normalize path
        file_path = file_path.strip()
        if not file_path:
            continue

        # Check against all allowed patterns
        is_allowed = False
        for pattern in allowed_paths:
            if matches_pattern(file_path, pattern):
                is_allowed = True
                break

        if is_allowed:
            valid_files.append(file_path)
        else:
            violations.append(file_path)

    return {
        "valid": valid_files,
        "violations": violations
    }


def get_git_changed_files(project_root: Path) -> List[str]:
    """Get list of changed files from git."""
    try:
        # Get staged and unstaged changes
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            cwd=project_root,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            # Try without HEAD (for initial commits)
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=project_root,
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                print("Error: Could not get git changes")
                return []

            # Parse porcelain output
            files = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    # Format: XY filename
                    files.append(line[3:].strip())
            return files

        return [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]

    except FileNotFoundError:
        print("Error: git not found")
        return []


def print_scope_summary(scope_config: Dict[str, Any]) -> None:
    """Print a summary of the scope configuration."""
    scope = scope_config.get("scope", {})

    print("\n" + "=" * 60)
    print("SCOPE CONFIGURATION")
    print("=" * 60)

    print(f"\nSession: {scope_config.get('session', 'Unknown')}")
    print(f"Defined by: {scope_config.get('definedBy', 'Unknown')}")
    print(f"Date: {scope_config.get('date', 'Unknown')}")

    print("\nScope Settings:")
    print(f"  Core:    {'ALLOWED' if scope.get('core') else 'DENIED'}")
    print(f"  Theme:   {scope.get('theme') or 'NONE'}")
    print(f"  Plugins: {scope.get('plugins') if isinstance(scope.get('plugins'), list) else 'NONE'}")

    exceptions = scope_config.get("exceptions", [])
    if exceptions:
        print(f"\nExceptions ({len(exceptions)}):")
        for exc in exceptions:
            print(f"  + {exc}")


def print_validation_result(result: Dict[str, List[str]], allowed_paths: List[str]) -> None:
    """Print validation results."""
    violations = result["violations"]
    valid_files = result["valid"]

    print("\n" + "=" * 60)
    print("VALIDATION RESULT")
    print("=" * 60)

    if violations:
        print("\n SCOPE VIOLATIONS DETECTED")
        print("-" * 40)
        for file in violations:
            print(f"  {file}")

        print("\nAllowed Paths:")
        for path in allowed_paths:
            print(f"  {path}")

        print("\nRequired Actions:")
        print("  1. Revert modifications to files outside scope")
        print("  2. OR request scope expansion via /task:scope-change")
        print("  3. OR move logic to an allowed path")
    else:
        print("\n All files are within scope")
        print(f"\nValidated {len(valid_files)} file(s)")

    if valid_files:
        print("\nValid Files:")
        for file in valid_files:
            print(f"  {file}")


def main():
    parser = argparse.ArgumentParser(
        description="Validate file modifications against session scope",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python validate-scope.py --session ".claude/sessions/2025-12-30-feature-v1"
  python validate-scope.py -s ".claude/sessions/2025-12-30-feature-v1" --files "core/lib/x.ts"
  python validate-scope.py -s ".claude/sessions/2025-12-30-feature-v1" --git
        """
    )

    parser.add_argument(
        "-s", "--session",
        required=True,
        help="Path to session folder (relative to project root)"
    )

    parser.add_argument(
        "-f", "--files",
        help="Comma-separated list of files to validate"
    )

    parser.add_argument(
        "-g", "--git",
        action="store_true",
        help="Validate git changed files instead of explicit list"
    )

    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Only output violations (exit code indicates result)"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )

    args = parser.parse_args()

    project_root = get_project_root()
    session_path = project_root / args.session

    # Validate session exists
    if not session_path.exists():
        print(f"Error: Session not found: {session_path}")
        sys.exit(1)

    # Read scope configuration
    scope_config = read_scope_config(session_path)

    # Build allowed paths
    allowed_paths = build_allowed_paths(scope_config)

    # Get files to validate
    if args.git:
        files = get_git_changed_files(project_root)
        if not files:
            if not args.quiet:
                print("No git changes detected")
            sys.exit(0)
    elif args.files:
        files = [f.strip() for f in args.files.split(",") if f.strip()]
    else:
        print("Error: Either --files or --git must be specified")
        sys.exit(1)

    # Validate files
    result = validate_files(files, allowed_paths)

    # Output results
    if args.json:
        output = {
            "session": str(session_path),
            "scope": scope_config.get("scope", {}),
            "allowedPaths": allowed_paths,
            "result": {
                "valid": len(result["violations"]) == 0,
                "validFiles": result["valid"],
                "violations": result["violations"]
            }
        }
        print(json.dumps(output, indent=2))
    elif args.quiet:
        if result["violations"]:
            for violation in result["violations"]:
                print(violation)
    else:
        print_scope_summary(scope_config)
        print_validation_result(result, allowed_paths)

    # Exit with appropriate code
    if result["violations"]:
        sys.exit(1)  # Violations found
    else:
        sys.exit(0)  # All valid


if __name__ == "__main__":
    main()
