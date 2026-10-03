import { ProjectAgent, resolveTier } from './projectAgent.js';

export class CodingAgentFree extends ProjectAgent {
  constructor(model = 'codestral-latest', id = 'coder-1') { super('coder', 0, model, id); }
}
export class CodingAgentPro extends ProjectAgent {
  constructor(model = 'kimi-k3', id = 'coder-2') { super('coder', 1, model, id); }
}
export class CodingAgentMax extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'coder-3') { super('coder', 2, model, id); }
}
export class CodingAgent extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash', id = 'coder-1', tier = null) { super('coder', resolveTier(id, tier), model, id); }
}
