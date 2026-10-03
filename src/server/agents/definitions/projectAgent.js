import { BaseAgent } from '../baseAgent.js';

const definitions = {
  designer: { names: ['Pixel (Junior Designer)', 'Chroma (UI/UX Designer)', 'Canvas (Lead Designer)'], emoji: '🎨', role: 'UI/UX & Visual Direction', skills: ['Design tokens', 'Typography', 'Responsive layouts', 'Accessible interaction states'] },
  frontend: { names: ['Nova (Junior Frontend)', 'Blueprint (Frontend Architect)', 'Apex (Lead Frontend Architect)'], emoji: '📐', role: 'Technical Implementation Strategy', skills: ['Multi-file architecture', 'DOM contracts', 'CSS organization', 'JavaScript module dependencies'] },
  feature: { names: ['Scout (Feature Analyst)', 'Beacon (Feature Architect)', 'Compass (Lead Feature Architect)'], emoji: '⚡', role: 'Functional Behavior & User Interaction Flows', skills: ['Feature decomposition', 'User journeys', 'State transitions', 'Validation and edge cases'] },
  coder: { names: ['Byte (Junior Coder)', 'Cipher (Fullstack Coder)', 'Matrix (Lead Coder)'], emoji: '💻', role: 'Implementation Owner & Code Generator', skills: ['Multi-file website generation', 'Project-aware file reading', 'Targeted file edits', 'HTML/CSS/JavaScript', 'Binary asset preservation'] },
  qa: { names: ['Query (Junior QA)', 'Audit (QA Auditor)', 'Sentinel (Lead QA Inspector)'], emoji: '🛡️', role: 'Quality Assurance & Code Auditor', skills: ['Cross-file reference validation', 'DOM and event auditing', 'Requirements verification', 'Regression review'] },
};

export class ProjectAgent extends BaseAgent {
  constructor(kind, tier, model, id) {
    const def = definitions[kind];
    super({ id, name: def.names[tier], emoji: def.emoji, role: def.role, description: `${def.role} for multi-file websites and imported projects.`, skills: def.skills, model, contractRole: kind });
  }
}

export function resolveTier(id, tier) {
  if (tier === 'free' || id?.includes('free')) return 0;
  if (['max', 'best'].includes(tier) || id?.includes('max')) return 2;
  return 1;
}
