import { ProjectAgent, resolveTier } from './projectAgent.js';

export class FeatureArchitectAgentFree extends ProjectAgent {
  constructor(model = 'codestral-latest', id = 'feature-1') { super('feature', 0, model, id); }
}
export class FeatureArchitectAgentPro extends ProjectAgent {
  constructor(model = 'kimi-k3', id = 'feature-2') { super('feature', 1, model, id); }
}
export class FeatureArchitectAgentMax extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'feature-3') { super('feature', 2, model, id); }
}
export class FeatureArchitectAgent extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash', id = 'feature-1', tier = null) { super('feature', resolveTier(id, tier), model, id); }
}
