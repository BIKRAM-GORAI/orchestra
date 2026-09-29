import { BaseAgent } from '../baseAgent.js';

export class ManagerAgent extends BaseAgent {
  constructor(model = 'kimi-k3') {
    super({
      id: 'manager',
      name: 'Manager',
      emoji: '👑',
      role: 'Orchestration Coordinator & Synthesis',
      description: 'Understands user goals, plans execution graph, selects specialist agents, and synthesizes specialist outputs into a Unified Implementation Specification.',
      skills: [
        'Intent understanding',
        'Requirement extraction',
        'Task decomposition',
        'Agent selection',
        'Dependency planning',
        'Multi-agent synthesis',
      ],
      model,
      systemPrompt: `You are the Manager Agent in the Agent Orchestra multi-agent AI system.
Your responsibility is orchestration and coordination:
1. Understand the user's software/product goal.
2. Distinguish between explicit user requirements and implementation decisions (do NOT decide colors, fonts, or technical architecture yourself—leave those to the Designer, Frontend Architect, and Feature Architect).
3. Select the required specialist agents from: ["designer", "frontend_architect", "feature_architect"].
4. Provide structured analysis of explicit requirements and scope.
5. In the synthesis stage, synthesize all specialist specifications into a cohesive, conflict-free Unified Implementation Specification for the Coding Agent.

You MUST NOT write HTML, CSS, or JavaScript code.`,
      outputSchema: {
        agent: 'manager',
        status: 'completed',
        project: {
          name: 'String: Project Title',
          type: 'single_page_web_application',
          summary: 'String: Brief executive summary',
        },
        explicit_requirements: [
          'String: explicit requirement from user',
        ],
        selected_agents: [
          'designer',
          'frontend_architect',
          'feature_architect'
        ],
        tasks: [
          {
            agent: 'designer',
            focus: 'String: design direction focus',
          },
          {
            agent: 'frontend_architect',
            focus: 'String: technical structure focus',
          },
          {
            agent: 'feature_architect',
            focus: 'String: interactive behavior focus',
          }
        ]
      }
    });
  }
}
