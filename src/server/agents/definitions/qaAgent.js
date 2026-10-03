import { ProjectAgent, resolveTier } from './projectAgent.js';

export class QAAgentFree extends ProjectAgent {
  constructor(model = 'codestral-latest', id = 'qa-1') { super('qa', 0, model, id); }
}
export class QAAgentPro extends ProjectAgent {
  constructor(model = 'kimi-k3', id = 'qa-2') { super('qa', 1, model, id); }
}
export class QAAgentMax extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'qa-3') { super('qa', 2, model, id); }
}
export class QAAgent extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash', id = 'qa-1', tier = null) { super('qa', resolveTier(id, tier), model, id); }
}
