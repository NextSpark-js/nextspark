#!/usr/bin/env python3
"""
Generate Sample Data Script

Generates coherent sample data for an entity based on its field configuration.

Usage:
    python generate-sample-data.py --entity ENTITY_NAME [--theme THEME] [--count COUNT]

Options:
    --entity ENTITY_NAME  Name of the entity (kebab-case)
    --theme THEME         Theme name (default: from NEXT_PUBLIC_ACTIVE_THEME or 'default')
    --count COUNT         Number of records to generate (default: 10)
    --output OUTPUT       Output file (default: migrations/sample_data.json)
    --format FORMAT       Output format: json, sql, csv (default: json)
"""

import os
import sys
import argparse
import json
import re
import random
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def to_snake_case(name: str) -> str:
    """Convert kebab-case to snake_case."""
    return name.replace('-', '_')


def to_camel_case(name: str) -> str:
    """Convert kebab-case to camelCase."""
    components = name.split('-')
    return components[0] + ''.join(x.title() for x in components[1:])


# Sample data generators
SAMPLE_TITLES = [
    "Important Project",
    "Client Meeting Notes",
    "Quarterly Review",
    "Budget Analysis",
    "Marketing Campaign",
    "Product Launch",
    "Team Building Event",
    "Research Report",
    "Strategic Planning",
    "Customer Feedback",
    "Sales Pipeline",
    "Development Sprint",
    "Quality Assurance",
    "Documentation Update",
    "Training Session",
]

SAMPLE_DESCRIPTIONS = [
    "This is a detailed description of the item with important information.",
    "Contains key insights and analysis for stakeholders.",
    "Requires immediate attention and follow-up actions.",
    "Comprehensive overview of the current situation.",
    "Summary of findings from the recent investigation.",
    "Action items and next steps outlined here.",
    "Overview of progress made and remaining tasks.",
    "Key deliverables and milestones listed.",
    "Critical information for decision making.",
    "Background context and historical data included.",
]

SAMPLE_TAGS = [
    "urgent", "important", "review", "pending", "completed",
    "high-priority", "low-priority", "in-progress", "blocked",
    "client", "internal", "external", "documentation", "feature",
    "bug", "enhancement", "research", "planning", "marketing"
]


def parse_fields_file(fields_path: Path) -> List[Dict]:
    """Parse TypeScript fields file to extract field definitions."""
    fields = []

    if not fields_path.exists():
        print(f"Warning: Fields file not found: {fields_path}")
        return fields

    with open(fields_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find field blocks
    field_pattern = re.compile(
        r'\{[^}]*name:\s*[\'"](\w+)[\'"][^}]*type:\s*[\'"](\w+(?:-\w+)?)[\'"][^}]*\}',
        re.DOTALL
    )

    for match in field_pattern.finditer(content):
        name = match.group(1)
        field_type = match.group(2)

        # Skip system fields
        if name in ['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'userId', 'user_id']:
            continue

        field_def = {
            'name': name,
            'type': field_type,
        }

        # Extract default value
        default_pattern = re.compile(
            rf'name:\s*[\'"]{name}[\'"][^}}]*defaultValue:\s*[\'"]?(\w+)[\'"]?',
            re.DOTALL
        )
        default_match = default_pattern.search(content)
        if default_match:
            field_def['defaultValue'] = default_match.group(1)

        # Extract options for select fields
        if field_type == 'select':
            options_pattern = re.compile(
                rf'name:\s*[\'"]{name}[\'"][^}}]*options:\s*\[(.*?)\]',
                re.DOTALL
            )
            options_match = options_pattern.search(content)
            if options_match:
                options_str = options_match.group(1)
                values = re.findall(r'value:\s*[\'"](\w+(?:-\w+)?)[\'"]', options_str)
                field_def['options'] = values

        fields.append(field_def)

    return fields


def generate_value(field: Dict, index: int) -> Any:
    """Generate a sample value for a field."""
    field_type = field['type']
    name = field['name'].lower()

    # Title-like fields
    if name in ['title', 'name', 'subject']:
        base = random.choice(SAMPLE_TITLES)
        return f"{base} #{index + 1}"

    # Description-like fields
    if name in ['description', 'content', 'body', 'notes', 'summary']:
        return random.choice(SAMPLE_DESCRIPTIONS)

    # Select fields
    if field_type == 'select' and 'options' in field:
        return random.choice(field['options'])

    # Type-based generation
    if field_type == 'text':
        return f"Sample text value {index + 1}"

    elif field_type == 'textarea':
        return random.choice(SAMPLE_DESCRIPTIONS)

    elif field_type == 'number':
        return round(random.uniform(1, 100), 2)

    elif field_type == 'boolean':
        return random.choice([True, False])

    elif field_type == 'date':
        days_offset = random.randint(-30, 30)
        date = datetime.now() + timedelta(days=days_offset)
        return date.strftime('%Y-%m-%d')

    elif field_type == 'datetime':
        days_offset = random.randint(-30, 30)
        hours_offset = random.randint(0, 23)
        date = datetime.now() + timedelta(days=days_offset, hours=hours_offset)
        return date.isoformat()

    elif field_type == 'email':
        return f"user{index + 1}@example.com"

    elif field_type == 'url':
        return f"https://example.com/resource/{index + 1}"

    elif field_type == 'tags':
        num_tags = random.randint(1, 4)
        return random.sample(SAMPLE_TAGS, num_tags)

    elif field_type == 'multiselect' and 'options' in field:
        num_selections = random.randint(1, min(3, len(field['options'])))
        return random.sample(field['options'], num_selections)

    elif field_type == 'phone':
        return f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}"

    elif field_type == 'rating':
        return random.randint(1, 5)

    elif field_type == 'range':
        return round(random.uniform(0, 100), 1)

    elif field_type == 'json':
        return {"key": f"value_{index}", "nested": {"count": index}}

    elif field_type in ['relation', 'reference', 'user']:
        return str(uuid.uuid4())

    elif field_type in ['file', 'image', 'video', 'audio']:
        return {
            "url": f"https://storage.example.com/{field_type}/{index + 1}",
            "name": f"sample_{field_type}_{index + 1}",
            "size": random.randint(1000, 10000000)
        }

    elif field_type == 'currency':
        return random.choice(['USD', 'EUR', 'GBP', 'JPY', 'CAD'])

    elif field_type == 'country':
        return random.choice(['US', 'GB', 'CA', 'DE', 'FR', 'JP', 'AU'])

    elif field_type == 'timezone':
        return random.choice([
            'America/New_York', 'America/Los_Angeles', 'Europe/London',
            'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'
        ])

    elif field_type == 'address':
        return {
            "street": f"{random.randint(100, 9999)} Main Street",
            "city": random.choice(['New York', 'Los Angeles', 'Chicago', 'Houston']),
            "state": random.choice(['NY', 'CA', 'IL', 'TX']),
            "zip": f"{random.randint(10000, 99999)}",
            "country": "US"
        }

    # Default
    return f"value_{index + 1}"


def generate_sample_data(entity_slug: str, fields: List[Dict], count: int) -> List[Dict]:
    """Generate sample data records."""
    records = []

    for i in range(count):
        record = {
            "id": str(uuid.uuid4()),
            "userId": str(uuid.uuid4()),  # Placeholder - should be replaced with real user ID
        }

        for field in fields:
            # Use snake_case for database compatibility
            key = to_snake_case(field['name'])
            record[key] = generate_value(field, i)

        # Add timestamps
        created_days_ago = random.randint(0, 60)
        updated_days_ago = random.randint(0, created_days_ago)

        created_at = datetime.now() - timedelta(days=created_days_ago)
        updated_at = datetime.now() - timedelta(days=updated_days_ago)

        record["created_at"] = created_at.isoformat()
        record["updated_at"] = updated_at.isoformat()

        records.append(record)

    return records


def format_json(records: List[Dict]) -> str:
    """Format as JSON."""
    return json.dumps(records, indent=2)


def format_sql(entity_slug: str, records: List[Dict]) -> str:
    """Format as SQL INSERT statements."""
    table_name = to_snake_case(entity_slug)

    if not records:
        return "-- No records to insert"

    columns = list(records[0].keys())
    sql_lines = [f"-- Sample data for {table_name}", ""]

    for record in records:
        values = []
        for col in columns:
            val = record[col]
            if val is None:
                values.append("NULL")
            elif isinstance(val, bool):
                values.append("TRUE" if val else "FALSE")
            elif isinstance(val, (int, float)):
                values.append(str(val))
            elif isinstance(val, (list, dict)):
                json_str = json.dumps(val).replace("'", "''")
                values.append(f"'{json_str}'::jsonb")
            else:
                escaped = str(val).replace("'", "''")
                values.append(f"'{escaped}'")

        sql_lines.append(
            f'INSERT INTO "{table_name}" ({", ".join(f\'"{c}\'" for c in columns)}) '
            f'VALUES ({", ".join(values)});'
        )

    return "\n".join(sql_lines)


def format_csv(records: List[Dict]) -> str:
    """Format as CSV."""
    if not records:
        return ""

    columns = list(records[0].keys())
    lines = [",".join(columns)]

    for record in records:
        values = []
        for col in columns:
            val = record[col]
            if val is None:
                values.append("")
            elif isinstance(val, (list, dict)):
                json_str = json.dumps(val).replace('"', '""')
                values.append(f'"{json_str}"')
            elif isinstance(val, str) and (',' in val or '"' in val or '\n' in val):
                escaped = val.replace('"', '""')
                values.append(f'"{escaped}"')
            else:
                values.append(str(val))
        lines.append(",".join(values))

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description='Generate sample data for entity')
    parser.add_argument('--entity', required=True, help='Entity name (kebab-case)')
    parser.add_argument('--theme', default=None, help='Theme name')
    parser.add_argument('--count', type=int, default=10, help='Number of records')
    parser.add_argument('--output', help='Output file')
    parser.add_argument('--format', choices=['json', 'sql', 'csv'], default='json')
    parser.add_argument('--seed', type=int, help='Random seed for reproducibility')

    args = parser.parse_args()

    # Set seed for reproducibility
    if args.seed:
        random.seed(args.seed)

    theme = args.theme or get_active_theme()
    entity_slug = args.entity.lower()

    # Find fields file
    fields_path = Path(f'contents/themes/{theme}/entities/{entity_slug}/{entity_slug}.fields.ts')

    print(f"\nGenerating sample data for: {entity_slug}")
    print(f"Theme: {theme}")
    print(f"Count: {args.count}")
    print(f"Format: {args.format}")

    # Parse fields
    fields = parse_fields_file(fields_path)
    print(f"Found {len(fields)} fields")

    if not fields:
        print("\nWarning: No fields found. Generating minimal sample data.")
        fields = [
            {'name': 'title', 'type': 'text'},
            {'name': 'description', 'type': 'textarea'},
            {'name': 'status', 'type': 'select', 'options': ['draft', 'active', 'archived']},
        ]

    # Generate sample data
    records = generate_sample_data(entity_slug, fields, args.count)

    # Format output
    if args.format == 'json':
        output = format_json(records)
    elif args.format == 'sql':
        output = format_sql(entity_slug, records)
    elif args.format == 'csv':
        output = format_csv(records)
    else:
        output = format_json(records)

    # Write output
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"\nSample data written to: {output_path}")
    else:
        # Default output location
        default_output = Path(f'contents/themes/{theme}/entities/{entity_slug}/migrations/sample_data.json')
        if args.format != 'json':
            ext = args.format
            default_output = default_output.with_suffix(f'.{ext}')

        default_output.parent.mkdir(parents=True, exist_ok=True)
        with open(default_output, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"\nSample data written to: {default_output}")

    print(f"Generated {len(records)} records")

    return 0


if __name__ == '__main__':
    sys.exit(main())
