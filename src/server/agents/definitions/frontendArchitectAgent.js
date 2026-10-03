import { ProjectAgent, resolveTier } from './projectAgent.js';

export class FrontendArchitectAgentFree extends ProjectAgent {
  constructor(model = 'codestral-latest', id = 'frontend-1') { super('frontend', 0, model, id); }
}
export class FrontendArchitectAgentPro extends ProjectAgent {
  constructor(model = 'kimi-k3', id = 'frontend-2') { super('frontend', 1, model, id); }
}
export class FrontendArchitectAgentMax extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'frontend-3') { super('frontend', 2, model, id); }
}
export class FrontendArchitectAgent extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash', id = 'frontend-1', tier = null) { super('frontend', resolveTier(id, tier), model, id); }
}
