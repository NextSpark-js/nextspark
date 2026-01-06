#!/usr/bin/env python3
"""
Create Session Script

Creates a new development session folder with all 8 template files.
Part of the session-management skill.

Usage:
    python create-session.py --name "feature-name" [--version 1]
    python create-session.py -n "user-authentication" -v 2
"""

import argparse
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path


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


def validate_name(name: str) -> str:
    """Validate and normalize session name."""
    # Convert to lowercase and replace spaces with hyphens
    normalized = name.lower().strip().replace(" ", "-").replace("_", "-")

    # Remove any characters that aren't alphanumeric or hyphens
    cleaned = "".join(c for c in normalized if c.isalnum() or c == "-")

    # Remove consecutive hyphens
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")

    # Remove leading/trailing hyphens
    cleaned = cleaned.strip("-")

    if not cleaned:
        print("Error: Invalid session name. Must contain alphanumeric characters.")
        sys.exit(1)

    return cleaned


def create_session(name: str, version: int = 1) -> None:
    """Create a new session folder with all template files."""
    project_root = get_project_root()
    templates_dir = project_root / ".claude" / "tools" / "sessions" / "templates"
    sessions_dir = project_root / ".claude" / "sessions"

    # Validate templates exist
    if not templates_dir.is_dir():
        print(f"Error: Templates directory not found: {templates_dir}")
        sys.exit(1)

    # Generate session name
    date_str = datetime.now().strftime("%Y-%m-%d")
    validated_name = validate_name(name)
    session_name = f"{date_str}-{validated_name}-v{version}"
    session_path = sessions_dir / session_name

    # Check if session already exists
    if session_path.exists():
        print(f"Error: Session already exists: {session_path}")
        print(f"Hint: Use --version {version + 1} to create a new version")
        sys.exit(1)

    # Create session directory
    session_path.mkdir(parents=True, exist_ok=True)
    print(f"Created session: {session_name}")

    # Expected template files
    template_files = [
        "requirements.md",
        "clickup_task.md",
        "scope.json",
        "plan.md",
        "progress.md",
        "context.md",
        "tests.md",
        "pendings.md",
    ]

    # Copy templates
    copied_count = 0
    for template_file in template_files:
        src = templates_dir / template_file
        dst = session_path / template_file

        if src.exists():
            shutil.copy2(src, dst)

            # Replace placeholders in the copied file
            if dst.suffix in [".md", ".json"]:
                content = dst.read_text()
                content = content.replace("YYYY-MM-DD", date_str)
                content = content.replace("[Feature Name]", name.title())
                content = content.replace("feature-name", validated_name)
                content = content.replace("feature-name-v1", session_name)
                dst.write_text(content)

            copied_count += 1
            print(f"  ✓ {template_file}")
        else:
            print(f"  ✗ {template_file} (template not found)")

    print(f"\nSession created with {copied_count}/{len(template_files)} files")
    print(f"\nSession path: {session_path}")
    print("\nNext steps:")
    print("  1. Edit requirements.md with business requirements")
    print("  2. Configure scope.json with file permissions")
    print("  3. Run /task:plan to create technical plan")


def main():
    parser = argparse.ArgumentParser(
        description="Create a new development session folder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create-session.py --name "user-authentication"
  python create-session.py -n "scheduled-actions" -v 2
  python create-session.py --name "billing integration"
        """
    )

    parser.add_argument(
        "-n", "--name",
        required=True,
        help="Session name (will be normalized to kebab-case)"
    )

    parser.add_argument(
        "-v", "--version",
        type=int,
        default=1,
        help="Session version number (default: 1)"
    )

    args = parser.parse_args()

    if args.version < 1:
        print("Error: Version must be a positive integer")
        sys.exit(1)

    create_session(args.name, args.version)


if __name__ == "__main__":
    main()
