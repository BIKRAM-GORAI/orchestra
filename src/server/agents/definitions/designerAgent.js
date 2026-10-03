import { ProjectAgent, resolveTier } from './projectAgent.js';

export class DesignerAgentFree extends ProjectAgent {
  constructor(model = 'qwen-3.8-27b', id = 'designer-1') { super('designer', 0, model, id); }
}
export class DesignerAgentPro extends ProjectAgent {
  constructor(model = 'kimi-k3', id = 'designer-2') { super('designer', 1, model, id); }
}
export class DesignerAgentMax extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash-lite', id = 'designer-3') { super('designer', 2, model, id); }
}
export class DesignerAgent extends ProjectAgent {
  constructor(model = 'gemini-3.5-flash', id = 'designer-1', tier = null) { super('designer', resolveTier(id, tier), model, id); }
}
