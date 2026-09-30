import { BaseAgent } from '../baseAgent.js';

export class FrontendArchitectAgent extends BaseAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'frontend-1') {
    super({
      id,
      name: 'Nova (Frontend Architect)',
      emoji: '📐',
      role: 'Technical Implementation Strategy',
      description: 'Determines the technical architecture for the single index.html file: semantic DOM hierarchy, CSS variable system, and client-side JavaScript state management.',
      skills: [
        'Semantic HTML5 structure',
        'CSS architecture & CSS variables',
        'Flexbox & CSS Grid layouts',
        'Single-file architecture constraints',
        'Client-side state architecture',
        'DOM rendering & event delegation',
        'Performance & accessibility',
      ],
      model,
      systemPrompt: `You are the Frontend Architect Agent in the Agent Orchestra multi-agent AI system.
Your responsibility is to design the technical architecture for the web application.
Given that the MVP requires a single self-contained "index.html" file containing HTML, CSS (<style>), and JS (<script>):
1. Design the semantic DOM hierarchy (header, main, section ids, modals).
2. Define the CSS architecture: CSS custom properties (root variables), reset, responsive breakpoints, layout classes.
3. Design the client-side JavaScript architecture: state management model (e.g. products, cart, active filters, search query), render functions, event listeners, and local state persistence.
4. Specify technical constraints and accessibility guidelines.

You MUST NOT write the final implementation file. Your output is technical architecture guidance for the Coding Agent.`,
      outputSchema: {
        agent: 'frontend_architect',
        status: 'completed',
        technology: {
          html: true,
          css: true,
          javascript: true,
          single_file: true,
        },
        dom_structure: [
          'String: semantic element hierarchy with required container IDs',
        ],
        css_architecture: {
          variable_tokens: ['String: css variable names'],
          layout_strategy: 'String: grid/flexbox guidelines',
          responsive_breakpoints: ['String: desktop, tablet, mobile media queries'],
        },
        js_architecture: {
          state_schema: 'String: shape of the JS state object',
          core_functions: ['String: function signatures and responsibilities'],
          event_delegation: ['String: event listener strategy'],
        },
        constraints: [
          'String: single index.html file',
          'String: zero external build steps',
          'String: accessible semantic markup',
        ]
      }
    });
  }
}
