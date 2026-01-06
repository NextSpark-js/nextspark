#!/usr/bin/env python3
"""
Generate Block Selectors Script

Generates BLOCK_SELECTORS entry for a new page builder block.

Usage:
    python generate-block-selectors.py --block BLOCK_NAME [--theme THEME]

Options:
    --block BLOCK_NAME  Name of the block (e.g., hero, faq-accordion)
    --theme THEME       Theme name (default: from NEXT_PUBLIC_ACTIVE_THEME or 'default')
    --analyze           Analyze existing block component for elements
    --full              Generate full example with component and test usage
    --dry-run           Print output without instructions
"""

import os
import re
import sys
import argparse
from pathlib import Path
from typing import List, Dict


def to_camel_case(name: str) -> str:
    """Convert kebab-case to camelCase."""
    components = name.split('-')
    return components[0] + ''.join(x.title() for x in components[1:])


def to_pascal_case(name: str) -> str:
    """Convert kebab-case to PascalCase."""
    return ''.join(x.title() for x in name.split('-'))


def get_active_theme() -> str:
    """Get active theme from environment or default."""
    return os.environ.get('NEXT_PUBLIC_ACTIVE_THEME', 'default')


def analyze_block_component(block_path: Path) -> List[Dict]:
    """Analyze a block component for interactive elements."""
    elements = []

    component_file = block_path / 'component.tsx'
    if not component_file.exists():
        return elements

    with open(component_file, 'r') as f:
        content = f.read()

    # Find interactive elements
    patterns = [
        (r'<button[^>]*>', 'button'),
        (r'<Button[^>]*>', 'button'),
        (r'<input[^>]*>', 'input'),
        (r'<Input[^>]*>', 'input'),
        (r'<a\s[^>]*>', 'link'),
        (r'<Link[^>]*>', 'link'),
        (r'<form[^>]*>', 'form'),
        (r'<Form[^>]*>', 'form'),
        (r'<select[^>]*>', 'select'),
        (r'<textarea[^>]*>', 'textarea'),
    ]

    for pattern, element_type in patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in matches:
            elements.append({
                'type': element_type,
                'context': match[:80]
            })

    # Check for map/array iterations (suggests indexed selectors)
    if '.map(' in content or '.forEach(' in content:
        elements.append({
            'type': 'indexed',
            'context': 'Array iteration found - consider indexed selectors'
        })

    return elements


def generate_selectors_entry(block_name: str, elements: List[Dict] = None) -> str:
    """Generate BLOCK_SELECTORS entry matching project conventions."""
    camel_name = to_camel_case(block_name)
    kebab_name = block_name  # Keep kebab for selector values

    lines = [
        f"  {camel_name}: {{",
        f"    container: 'block-{kebab_name}',",
    ]

    has_indexed = False
    if elements:
        # Add selectors based on analyzed elements
        element_counts = {}
        for elem in elements:
            elem_type = elem['type']
            if elem_type == 'indexed':
                has_indexed = True
            else:
                count = element_counts.get(elem_type, 0)
                if count == 0:
                    lines.append(f"    {elem_type}: '{kebab_name}-{elem_type}',")
                else:
                    lines.append(f"    {elem_type}{count + 1}: '{kebab_name}-{elem_type}-{count + 1}',")
                element_counts[elem_type] = count + 1

        if has_indexed:
            lines.append(f"    item: '{kebab_name}-item-{{index}}',")
    else:
        # Default structure for new blocks
        lines.append(f"    // Add more selectors as needed:")
        lines.append(f"    // title: '{kebab_name}-title',")
        lines.append(f"    // item: '{kebab_name}-item-{{index}}',")

    lines.append("  },")

    return '\n'.join(lines)


def generate_full_example(block_name: str, theme: str, elements: List[Dict] = None) -> str:
    """Generate full usage example matching project conventions."""
    camel_name = to_camel_case(block_name)
    pascal_name = to_pascal_case(block_name)
    kebab_name = block_name

    has_indexed = elements and any(e['type'] == 'indexed' for e in elements) if elements else False

    return f'''
================================================================================
BLOCK SELECTORS: {block_name}
================================================================================

1. ADD TO BLOCK_SELECTORS
   File: contents/themes/{theme}/lib/selectors.ts

   Find the BLOCK_SELECTORS constant and add:

{generate_selectors_entry(block_name, elements)}

--------------------------------------------------------------------------------

2. COMPONENT USAGE
   File: contents/themes/{theme}/blocks/{block_name}/component.tsx

   Import:
   ```typescript
   import {{ sel }} from '../../lib/selectors'
   ```

   Usage in JSX:
   ```tsx
   <section data-cy={{sel('blocks.{camel_name}.container')}}>
     <h2 data-cy={{sel('blocks.{camel_name}.title')}}>
       {{title}}
     </h2>
     {has_indexed and f"""
     {{items.map((item, index) => (
       <div
         key={{index}}
         data-cy={{sel('blocks.{camel_name}.item', {{ index: String(index) }})}}
       >
         {{item.content}}
       </div>
     ))}}""" or ""}
   </section>
   ```

--------------------------------------------------------------------------------

3. CYPRESS TEST USAGE
   File: contents/themes/{theme}/tests/cypress/e2e/blocks/{block_name}.cy.ts

   ```typescript
   import {{ cySelector }} from '../../src/selectors'

   describe('{pascal_name} Block', () => {{
     beforeEach(() => {{
       cy.visit('/page-with-{block_name}')
     }})

     it('should display the block', () => {{
       cy.get(cySelector('blocks.{camel_name}.container')).should('be.visible')
     }})
     {has_indexed and f"""
     it('should display items', () => {{
       cy.get(cySelector('blocks.{camel_name}.item', {{ index: '0' }}))
         .should('be.visible')
     }})""" or ""}
   }})
   ```

--------------------------------------------------------------------------------

4. POM USAGE (Optional - for complex blocks)
   File: contents/themes/{theme}/tests/cypress/src/blocks/{pascal_name}POM.ts

   ```typescript
   import {{ BasePOM }} from '../core/BasePOM'
   import {{ cySelector }} from '../selectors'

   export class {pascal_name}POM extends BasePOM {{
     get selectors() {{
       return {{
         container: cySelector('blocks.{camel_name}.container'),
         {has_indexed and f"item: (index: number) => cySelector('blocks.{camel_name}.item', {{ index: String(index) }})," or ""}
       }}
     }}

     // Factory method
     static create(): {pascal_name}POM {{
       return new {pascal_name}POM()
     }}

     // Helper methods
     shouldBeVisible(): {pascal_name}POM {{
       cy.get(this.selectors.container).should('be.visible')
       return this
     }}
   }}
   ```

================================================================================
'''


def main():
    parser = argparse.ArgumentParser(description='Generate block selectors')
    parser.add_argument('--block', required=True, help='Block name (kebab-case)')
    parser.add_argument('--theme', default=None, help='Theme name')
    parser.add_argument('--analyze', action='store_true', help='Analyze existing block')
    parser.add_argument('--full', action='store_true', help='Generate full example')
    parser.add_argument('--dry-run', action='store_true', help='Print only selector entry')

    args = parser.parse_args()

    theme = args.theme or get_active_theme()
    block_name = args.block.lower()

    print(f"\n{'='*60}")
    print(f"Generating selectors for block: {block_name}")
    print(f"Theme: {theme}")
    print(f"{'='*60}")

    elements = None
    if args.analyze:
        block_path = Path(f'contents/themes/{theme}/blocks/{block_name}')
        if block_path.exists():
            elements = analyze_block_component(block_path)
            if elements:
                print(f"\nAnalyzed component - found {len(elements)} elements:")
                for elem in elements:
                    print(f"  - {elem['type']}")
        else:
            print(f"\nWarning: Block not found at {block_path}")
            print("Run without --analyze to generate default selectors.")

    if args.dry_run:
        print("\nBLOCK_SELECTORS entry:")
        print("-" * 40)
        print(generate_selectors_entry(block_name, elements))
        print("-" * 40)
    elif args.full:
        print(generate_full_example(block_name, theme, elements))
    else:
        # Default: show selector entry with brief instructions
        print("\nAdd to BLOCK_SELECTORS in lib/selectors.ts:")
        print("-" * 40)
        print(generate_selectors_entry(block_name, elements))
        print("-" * 40)
        print(f"\nUsage in component:")
        print(f"  import {{ sel }} from '../../lib/selectors'")
        print(f"  <div data-cy={{sel('blocks.{to_camel_case(block_name)}.container')}}>")
        print(f"\nFor full example run with --full flag")

    return 0


if __name__ == '__main__':
    sys.exit(main())
