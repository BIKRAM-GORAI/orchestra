import { BaseAgent } from '../baseAgent.js';

export class ManagerAgent extends BaseAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'manager-1') {
    super({
      id,
      model,
      contractRole: 'manager',
      name: 'Atlas (Manager)',
      emoji: '👑',
      role: 'Orchestration Coordinator & Synthesis',
      description: 'Plans multi-file websites and synthesizes specialist specifications.',
      skills: ['Requirement extraction', 'Specialist selection', 'Project file planning', 'Multi-agent synthesis', 'Quality review'],
      fallbackModels: ['kimi-k3', 'codestral-latest'],
    });
  }
}
