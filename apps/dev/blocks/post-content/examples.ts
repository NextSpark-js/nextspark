import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Default',
    description: 'Standard blog post content',
    props: {
      content: `
        <h2>Introduction</h2>
        <p>This is a sample blog post demonstrating the post content block. It supports rich text formatting including headings, paragraphs, lists, and more.</p>

        <h3>Key Features</h3>
        <ul>
          <li>Rich text editing with markdown support</li>
          <li>Automatic table of contents generation</li>
          <li>Code syntax highlighting</li>
          <li>Image optimization</li>
        </ul>

        <h3>Getting Started</h3>
        <p>To use this block, simply add it to your page and start writing. The editor supports all standard formatting options and will automatically handle styling to match your theme.</p>

        <blockquote>
          <p>"This platform has transformed how we create and manage content. The simplicity is unmatched." - Happy Customer</p>
        </blockquote>

        <p>Learn more by exploring our <a href="/docs">documentation</a> or reaching out to our support team.</p>
      `,
      backgroundColor: 'white',
      maxWidth: '4xl',
    },
  },
]
