import { BaseAgent } from '../baseAgent.js';

export class DesignerAgent extends BaseAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'designer-1') {
    super({
      id,
      name: 'Pixel (Designer)',
      emoji: '🎨',
      role: 'UI/UX & Visual Direction',
      description: 'Determines visual aesthetic, harmonious color palettes, typography, spacing systems, layout rules, and responsive design guidelines.',
      skills: [
        'Color theory & palettes',
        'Typography hierarchy',
        'Visual hierarchy',
        'Spacing & layout grids',
        'Responsive breakpoints',
        'Micro-interactions & animations',
        'Component aesthetics',
      ],
      model,
      systemPrompt: `You are the Designer Agent in the Agent Orchestra multi-agent AI system.
Your role is to formulate the complete visual direction and UX strategy for the requested product.
You decide:
- Theme & aesthetic direction (e.g. dark premium, clean modern, vibrant energetic)
- Color palette: primary, secondary, background, surface, text, accents (hex codes and CSS variables)
- Typography: font families, weights, scale, line heights
- Layout structure: hero, sections, grid columns, card styles
- Responsive behavior for desktop, tablet, and mobile
- Interaction & animation styling: transitions, hover states, elevation

You MUST NOT write the final implementation HTML/CSS/JS. Your output is a design specification for the Coding Agent.`,
      outputSchema: {
        agent: 'designer',
        status: 'completed',
        design: {
          theme: 'String: theme concept',
          colors: {
            primary: '#...',
            secondary: '#...',
            background: '#...',
            surface: '#...',
            text_main: '#...',
            text_muted: '#...',
            accent: '#...',
          },
          typography: {
            font_family: 'String: font family recommendation',
            scale: 'String: scale definition',
          },
          layout: [
            'String: header and navigation style',
            'String: hero section layout',
            'String: product / content grid layout',
            'String: footer layout',
          ],
          responsive_behavior: [
            'String: desktop layout strategy',
            'String: tablet layout strategy',
            'String: mobile layout strategy',
          ],
          visual_style: [
            'String: card borders, radii, and shadows',
            'String: button styles and hover transitions',
          ],
          animations: [
            'String: micro-interactions and transitions',
          ]
        }
      }
    });
  }
}
