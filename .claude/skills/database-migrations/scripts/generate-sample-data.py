#!/usr/bin/env python3
"""
Generate Sample Data Script

Generates SQL INSERT statements for sample/test data.

Usage:
    python generate-sample-data.py --entity ENTITY [--count COUNT]

Options:
    --entity ENTITY   Entity name (e.g., posts, tasks, products)
    --count COUNT     Number of records to generate (default: 20)
    --user-id ID      User ID for ownership (default: user-sample-1)
    --team-id ID      Team ID for team context (default: team-tmt-001)
    --dry-run         Preview without writing to file
    --output FILE     Output file path (default: core/migrations/XXX_entity_sample_data.sql)
"""

import os
import sys
import re
import random
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict


def to_pascal_case(name: str) -> str:
    """Convert kebab-case/snake_case to PascalCase."""
    return ''.join(x.title() for x in re.split(r'[-_]', name))


def to_camel_case(name: str) -> str:
    """Convert kebab-case/snake_case to camelCase."""
    parts = re.split(r'[-_]', name)
    return parts[0].lower() + ''.join(x.title() for x in parts[1:])


def get_next_migration_number(migrations_path: Path) -> str:
    """Get the next available migration number."""
    if not migrations_path.exists():
        return "020"

    existing = list(migrations_path.glob("*.sql"))
    if not existing:
        return "020"

    numbers = []
    for f in existing:
        match = re.match(r'^(\d+)_', f.name)
        if match:
            numbers.append(int(match.group(1)))

    if numbers:
        return str(max(numbers) + 1).zfill(3)
    return "020"


def generate_sample_titles(entity: str, count: int) -> List[str]:
    """Generate sample titles based on entity type."""
    templates = {
        'posts': [
            "Introduction to {topic}",
            "Understanding {topic}",
            "A Guide to {topic}",
            "Best Practices for {topic}",
            "Deep Dive into {topic}",
            "Mastering {topic}",
            "The Complete {topic} Guide",
            "Getting Started with {topic}",
            "{topic} Explained",
            "Why {topic} Matters",
        ],
        'tasks': [
            "Review {topic} implementation",
            "Fix {topic} issue",
            "Update {topic} documentation",
            "Test {topic} feature",
            "Refactor {topic} code",
            "Deploy {topic} to production",
            "Configure {topic} settings",
            "Analyze {topic} metrics",
            "Optimize {topic} performance",
            "Design {topic} system",
        ],
        'products': [
            "Premium {topic} Package",
            "Professional {topic} Suite",
            "Enterprise {topic} Solution",
            "Basic {topic} Plan",
            "Advanced {topic} Tools",
            "Essential {topic} Kit",
            "Ultimate {topic} Bundle",
            "Starter {topic} Pack",
            "{topic} Pro Edition",
            "{topic} Deluxe Version",
        ],
        'default': [
            "Sample {topic} Item",
            "Test {topic} Record",
            "{topic} Example",
            "Demo {topic} Entry",
            "New {topic} Data",
        ]
    }

    topics = [
        "React", "TypeScript", "Next.js", "PostgreSQL", "Authentication",
        "API Design", "Testing", "CI/CD", "Docker", "Kubernetes",
        "Performance", "Security", "Caching", "Database", "Frontend",
        "Backend", "DevOps", "Monitoring", "Logging", "Analytics"
    ]

    template_list = templates.get(entity, templates['default'])
    titles = []

    for i in range(count):
        template = template_list[i % len(template_list)]
        topic = topics[i % len(topics)]
        titles.append(template.format(topic=topic))

    return titles


def generate_slugs(titles: List[str]) -> List[str]:
    """Generate URL slugs from titles."""
    slugs = []
    for title in titles:
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'\s+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        slugs.append(slug.strip('-'))
    return slugs


def generate_sample_data(
    entity: str,
    count: int,
    user_id: str,
    team_id: str
) -> str:
    """Generate SQL INSERT statements for sample data."""

    table_name = to_camel_case(entity)
    titles = generate_sample_titles(entity, count)
    slugs = generate_slugs(titles)

    # Status options
    statuses = ['draft', 'active', 'published', 'archived']

    # Build SQL
    lines = [
        f"-- Migration: XXX_{entity}_sample_data.sql",
        f"-- Description: Sample data for {entity}",
        f"-- Date: {datetime.now().strftime('%Y-%m-%d')}",
        "",
        "-- ============================================",
        f"-- SAMPLE {entity.upper()}",
        "-- ============================================",
        f'INSERT INTO public."{table_name}" (',
        "  id,",
        '  "userId",',
    ]

    # Add teamId if provided
    if team_id:
        lines.append('  "teamId",')

    lines.extend([
        "  title,",
        "  slug,",
        "  description,",
        "  status,",
        '  "createdAt",',
        '  "updatedAt"',
        ") VALUES",
    ])

    # Generate records
    values = []
    base_date = datetime.now() - timedelta(days=30)

    for i in range(count):
        record_id = f'{entity[:4]}-sample-{i + 1}'
        created_at = base_date + timedelta(days=i, hours=random.randint(0, 23))
        updated_at = created_at + timedelta(days=random.randint(0, 5))
        status = statuses[i % len(statuses)]
        description = f"Sample description for {entity} #{i + 1}. This is test data for development."

        value_parts = [
            f"    '{record_id}'",
            f"    '{user_id}'",
        ]

        if team_id:
            value_parts.append(f"    '{team_id}'")

        value_parts.extend([
            f"    '{titles[i]}'",
            f"    '{slugs[i]}'",
            f"    '{description}'",
            f"    '{status}'",
            f"    '{created_at.strftime('%Y-%m-%d %H:%M:%S')}'::timestamptz",
            f"    '{updated_at.strftime('%Y-%m-%d %H:%M:%S')}'::timestamptz",
        ])

        values.append("  (\n" + ",\n".join(value_parts) + "\n  )")

    lines.append(",\n".join(values))
    lines.append("ON CONFLICT (id) DO NOTHING;")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description='Generate sample data')
    parser.add_argument('--entity', required=True, help='Entity name')
    parser.add_argument('--count', type=int, default=20, help='Number of records')
    parser.add_argument('--user-id', default='user-sample-1', help='User ID')
    parser.add_argument('--team-id', default='team-tmt-001', help='Team ID')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--output', help='Output file path')

    args = parser.parse_args()

    entity = args.entity.lower()

    print(f"\n{'=' * 60}")
    print("GENERATING SAMPLE DATA")
    print(f"{'=' * 60}")
    print(f"Entity: {entity}")
    print(f"Count: {args.count}")
    print(f"User ID: {args.user_id}")
    print(f"Team ID: {args.team_id}")
    print(f"{'=' * 60}\n")

    # Generate SQL
    sql_content = generate_sample_data(
        entity,
        args.count,
        args.user_id,
        args.team_id
    )

    if args.dry_run:
        print("DRY RUN - Generated SQL:\n")
        print("-" * 60)
        print(sql_content)
        print("-" * 60)
        print("\nRun without --dry-run to write to file.")
        return 0

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        migrations_path = Path('core/migrations')
        next_num = get_next_migration_number(migrations_path)
        output_path = migrations_path / f"{next_num}_{entity}_sample_data.sql"

    # Write file
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql_content)
        f.write('\n')

    print(f"Sample data written to: {output_path}")
    print(f"Records generated: {args.count}")
    print(f"\n{'=' * 60}")
    print("NEXT STEPS:")
    print("=" * 60)
    print(f"1. Review generated file: {output_path}")
    print("2. Adjust fields as needed for your entity schema")
    print("3. Run migration: pnpm db:migrate")
    print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
