import { BaseAgent } from '../baseAgent.js';

export class FeatureArchitectAgent extends BaseAgent {
  constructor(model = 'kimi-k3') {
    super({
      id: 'feature_architect',
      name: 'Feature Architect',
      emoji: '⚡',
      role: 'Functional Behavior & User Interaction Flows',
      description: 'Defines the behavioral specifications of all interactive features: user interactions, state transitions, validation, search/filter algorithms, and empty/edge states.',
      skills: [
        'Feature decomposition',
        'User flow definition',
        'State machine design',
        'Search & filtering algorithms',
        'Cart & checkout interaction flows',
        'Edge case & validation handling',
        'Feature prioritization',
      ],
      model,
      systemPrompt: `You are the Feature Architect Agent in the Agent Orchestra multi-agent AI system.
Your responsibility is to define the functional behavior and user interactions for the product.
For every feature, define:
- Name and purpose
- User interaction (e.g. clicks button, types in search box)
- Expected state update and DOM behavior
- Priority: required vs optional
- Edge cases: empty states, zero search results, clearing inputs

Distinguish clearly between REQUIRED features explicitly requested by the user and OPTIONAL/RECOMMENDED features.
You MUST NOT choose colors or write the final implementation code. Your output guides the Coding Agent.`,
      outputSchema: {
        agent: 'feature_architect',
        status: 'completed',
        features: [
          {
            name: 'String: feature identifier',
            purpose: 'String: why this feature exists',
            interaction: 'String: what the user does',
            behavior: 'String: what happens in state and DOM',
            priority: 'required | optional',
            edge_cases: ['String: empty state or boundary condition'],
          }
        ]
      }
    });
  }
}
