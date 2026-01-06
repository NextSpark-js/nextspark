import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Default',
    description: 'Standard text content block',
    props: {
      title: 'About Our Platform',
      content: `
        <p>We built this platform with one goal in mind: to make professional-grade tools accessible to teams of all sizes. Whether you're a startup or an enterprise, you deserve software that works as hard as you do.</p>

        <p>Our journey started in 2020 when we recognized a gap in the market for intuitive, powerful collaboration tools. Today, we serve thousands of teams across 150+ countries, helping them streamline their workflows and achieve more.</p>

        <h3>Our Mission</h3>
        <p>To empower teams with technology that amplifies their capabilities without adding complexity. We believe the best tools are the ones you don't have to think about - they just work.</p>

        <h3>Core Values</h3>
        <ul>
          <li><strong>Simplicity:</strong> Complex problems deserve simple solutions</li>
          <li><strong>Reliability:</strong> Your work depends on us, we take that seriously</li>
          <li><strong>Innovation:</strong> Constantly evolving to meet your needs</li>
          <li><strong>Support:</strong> Real people, real help, real time</li>
        </ul>
      `,
      backgroundColor: 'white',
      maxWidth: '4xl',
      textAlign: 'left',
    },
  },
]
