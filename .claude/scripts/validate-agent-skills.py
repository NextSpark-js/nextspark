#!/usr/bin/env python3
"""
Validate agent-skill mapping completeness.
Checks that all agents have Required Skills section and skills exist.

Usage:
    python3 scripts/validate-agent-skills.py
    python3 scripts/validate-agent-skills.py --strict  # Exit with error if issues found
"""

import argparse
import re
import sys
from pathlib import Path

# Resolve paths relative to script location
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
AGENTS_DIR = PROJECT_ROOT / "agents"
SKILLS_DIR = PROJECT_ROOT / "skills"


def find_required_skills_section(content: str) -> list[str]:
    """Extract skill paths from Required Skills section."""
    pattern = r'## Required Skills.*?(?=\n## |\Z)'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return []

    section = match.group(0)
    skill_pattern = r'`\.claude/skills/([^/]+)/SKILL\.md`'
    return re.findall(skill_pattern, section)


def validate_agents() -> tuple[list[str], dict]:
    """Validate all agents have Required Skills and skills exist."""
    issues = []
    stats = {"total": 0, "with_skills": 0, "missing_skills": 0, "invalid_refs": 0}
    agent_skills = {}

    if not AGENTS_DIR.exists():
        print(f"Error: Agents directory not found: {AGENTS_DIR}")
        sys.exit(1)

    for agent_file in sorted(AGENTS_DIR.glob("*.md")):
        stats["total"] += 1
        content = agent_file.read_text()

        skills = find_required_skills_section(content)
        agent_skills[agent_file.name] = skills

        if not skills:
            issues.append(f"MISSING: {agent_file.name} has no Required Skills section")
            stats["missing_skills"] += 1
            continue

        stats["with_skills"] += 1

        # Verify skills exist
        for skill in skills:
            skill_path = SKILLS_DIR / skill / "SKILL.md"
            if not skill_path.exists():
                issues.append(f"INVALID: {agent_file.name} references non-existent skill: {skill}")
                stats["invalid_refs"] += 1

    return issues, stats, agent_skills


def print_report(issues: list[str], stats: dict, agent_skills: dict, verbose: bool = False):
    """Print validation report."""
    print(f"\n{'='*60}")
    print("Agent-Skill Validation Report")
    print(f"{'='*60}\n")

    coverage = stats['with_skills'] * 100 // stats['total'] if stats['total'] > 0 else 0

    print(f"Total agents: {stats['total']}")
    print(f"With Required Skills: {stats['with_skills']} ({coverage}%)")
    print(f"Missing Required Skills: {stats['missing_skills']}")
    print(f"Invalid skill references: {stats['invalid_refs']}")

    if issues:
        print(f"\n{'='*60}")
        print("Issues Found:")
        print(f"{'='*60}\n")
        for issue in issues:
            print(f"  - {issue}")

    if verbose:
        print(f"\n{'='*60}")
        print("Agent-Skill Mapping:")
        print(f"{'='*60}\n")
        for agent, skills in agent_skills.items():
            if skills:
                print(f"  {agent}:")
                for skill in skills:
                    print(f"    - {skill}")
            else:
                print(f"  {agent}: (no skills)")

    print()

    if not issues:
        print("All agents have valid Required Skills sections\n")


def main():
    parser = argparse.ArgumentParser(description="Validate agent-skill mapping")
    parser.add_argument("--strict", action="store_true", help="Exit with error code if issues found")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed mapping")
    args = parser.parse_args()

    issues, stats, agent_skills = validate_agents()
    print_report(issues, stats, agent_skills, args.verbose)

    if args.strict and issues:
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
