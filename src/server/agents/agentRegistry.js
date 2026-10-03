import EventEmitter from 'events';
import { ManagerAgent } from './definitions/managerAgent.js';
import { DesignerAgent, DesignerAgentFree, DesignerAgentPro, DesignerAgentMax } from './definitions/designerAgent.js';
import { FrontendArchitectAgent, FrontendArchitectAgentFree, FrontendArchitectAgentPro, FrontendArchitectAgentMax } from './definitions/frontendArchitectAgent.js';
import { FeatureArchitectAgent, FeatureArchitectAgentFree, FeatureArchitectAgentPro, FeatureArchitectAgentMax } from './definitions/featureArchitectAgent.js';
import { CodingAgent, CodingAgentFree, CodingAgentPro, CodingAgentMax } from './definitions/codingAgent.js';
import { QAAgent, QAAgentFree, QAAgentPro, QAAgentMax } from './definitions/qaAgent.js';

/**
 * Agent Registry
 * 
 * Central registry holding all logical agents.
 * Ensures agents and models remain strictly decoupled.
 */
export class AgentRegistry extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.aliasMap = new Map();
    this.initDefaultAgents();
  }

  initDefaultAgents() {
    const defaultAgents = [
      new ManagerAgent('gemini-3.5-flash', 'manager-1'),
      new DesignerAgent('gemini-3.5-flash', 'designer-1'),
      new FrontendArchitectAgent('gemini-3.5-flash', 'frontend-1'),
      new FeatureArchitectAgent('gemini-3.5-flash', 'feature-1'),
      new CodingAgent('gemini-3.5-flash', 'coder-1'),
      new QAAgent('gemini-3.5-flash', 'qa-1'),
    ];

    for (const agent of defaultAgents) {
      this.registerAgent(agent);
    }

    // Register backwards-compatible aliases
    this.aliasMap.set('manager', 'manager-1');
    this.aliasMap.set('designer', 'designer-1');
    this.aliasMap.set('designer-pro-1', 'designer-1');
    this.aliasMap.set('frontend_architect', 'frontend-1');
    this.aliasMap.set('frontend', 'frontend-1');
    this.aliasMap.set('frontend-pro-1', 'frontend-1');
    this.aliasMap.set('feature_architect', 'feature-1');
    this.aliasMap.set('feature', 'feature-1');
    this.aliasMap.set('feature-pro-1', 'feature-1');
    this.aliasMap.set('coding_agent', 'coder-1');
    this.aliasMap.set('coder', 'coder-1');
    this.aliasMap.set('coder-pro-1', 'coder-1');
    this.aliasMap.set('qa', 'qa-1');
    this.aliasMap.set('qa-pro-1', 'qa-1');
  }

  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    // Forward agent state events to registry listeners
    agent.on('state', (event) => {
      this.emit('agentState', event);
    });
    agent.on('fallback', (event) => {
      this.emit('agentFallback', event);
    });
  }

  updateAgentConfig(id, { modelId, fallbackModels } = {}) {
    const agent = this.getAgent(id);
    if (modelId) agent.setModel(modelId);
    if (Array.isArray(fallbackModels)) agent.setFallbackModels(fallbackModels);
    this.emit('agentConfigUpdated', {
      agentId: agent.id,
      modelId: agent.modelId,
      fallbackModels: agent.fallbackModels,
    });
    return agent;
  }

  /**
   * Generate next sequential unique ID for a role (e.g. designer-1, designer-2)
   */
  generateNextAgentId(rolePrefix = 'agent') {
    const prefix = rolePrefix.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let maxNum = 0;
    for (const id of this.agents.keys()) {
      if (id.startsWith(`${prefix}-`)) {
        const numPart = parseInt(id.slice(prefix.length + 1), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
    return `${prefix}-${maxNum + 1}`;
  }

  /**
   * Dynamically instantiate a new agent with a guaranteed unique sequential ID
   */
  createAgentInstance({ role, model = 'gemini-3.5-flash-lite', id = null, tier = null } = {}) {
    let agent;
    const normalizedRole = role?.toLowerCase() || 'designer';

    if (normalizedRole.includes('design')) {
      const uniqueId = id || this.generateNextAgentId('designer');
      agent = new DesignerAgent(model, uniqueId, tier);
    } else if (normalizedRole.includes('frontend')) {
      const uniqueId = id || this.generateNextAgentId('frontend');
      agent = new FrontendArchitectAgent(model, uniqueId, tier);
    } else if (normalizedRole.includes('feature')) {
      const uniqueId = id || this.generateNextAgentId('feature');
      agent = new FeatureArchitectAgent(model, uniqueId, tier);
    } else if (normalizedRole.includes('cod')) {
      const uniqueId = id || this.generateNextAgentId('coder');
      agent = new CodingAgent(model, uniqueId, tier);
    } else if (normalizedRole.includes('qa') || normalizedRole.includes('audit')) {
      const uniqueId = id || this.generateNextAgentId('qa');
      agent = new QAAgent(model, uniqueId, tier);
    } else {
      const uniqueId = id || this.generateNextAgentId('agent');
      agent = new DesignerAgent(model, uniqueId, tier);
    }

    this.registerAgent(agent);
    return agent;
  }

  initFullAgencyRoster() {
    const fullRoster = [
      new ManagerAgent('gemini-3.5-flash-lite', 'manager-1'),

      // 3 Designers
      new DesignerAgentFree('codestral-latest', 'designer-1'),
      new DesignerAgentPro('kimi-k3', 'designer-2'),
      new DesignerAgentMax('gemini-3.5-flash-lite', 'designer-3'),

      // 3 Frontend Architects
      new FrontendArchitectAgentFree('codestral-latest', 'frontend-1'),
      new FrontendArchitectAgentPro('kimi-k3', 'frontend-2'),
      new FrontendArchitectAgentMax('gemini-3.5-flash-lite', 'frontend-3'),

      // 3 Feature Architects
      new FeatureArchitectAgentFree('codestral-latest', 'feature-1'),
      new FeatureArchitectAgentPro('kimi-k3', 'feature-2'),
      new FeatureArchitectAgentMax('gemini-3.5-flash-lite', 'feature-3'),

      // 3 Coders
      new CodingAgentFree('codestral-latest', 'coder-1'),
      new CodingAgentPro('kimi-k3', 'coder-2'),
      new CodingAgentMax('gemini-3.5-flash-lite', 'coder-3'),

      // 3 QA Auditors
      new QAAgentFree('codestral-latest', 'qa-1'),
      new QAAgentPro('kimi-k3', 'qa-2'),
      new QAAgentMax('gemini-3.5-flash-lite', 'qa-3'),
    ];

    for (const agent of fullRoster) {
      if (!this.agents.has(agent.id)) {
        this.registerAgent(agent);
      }
    }
  }

  getAgent(id) {
    const targetId = this.aliasMap.get(id) || id;
    if (this.agents.has(targetId)) {
      return this.agents.get(targetId);
    }

    // Lazy tier instantiation for all 15 specialists
    if (targetId === 'designer-1' || targetId === 'designer-free-1') {
      const a = new DesignerAgentFree('codestral-latest', 'designer-1');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'designer-2' || targetId === 'designer-pro-1') {
      const a = new DesignerAgentPro('kimi-k3', 'designer-2');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'designer-3' || targetId === 'designer-max-1') {
      const a = new DesignerAgentMax('gemini-3.5-flash-lite', 'designer-3');
      this.registerAgent(a);
      return a;
    }

    if (targetId === 'frontend-1' || targetId === 'frontend-free-1') {
      const a = new FrontendArchitectAgentFree('codestral-latest', 'frontend-1');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'frontend-2' || targetId === 'frontend-pro-1') {
      const a = new FrontendArchitectAgentPro('kimi-k3', 'frontend-2');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'frontend-3' || targetId === 'frontend-max-1') {
      const a = new FrontendArchitectAgentMax('gemini-3.5-flash-lite', 'frontend-3');
      this.registerAgent(a);
      return a;
    }

    if (targetId === 'feature-1' || targetId === 'feature-free-1') {
      const a = new FeatureArchitectAgentFree('codestral-latest', 'feature-1');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'feature-2' || targetId === 'feature-pro-1') {
      const a = new FeatureArchitectAgentPro('kimi-k3', 'feature-2');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'feature-3' || targetId === 'feature-max-1') {
      const a = new FeatureArchitectAgentMax('gemini-3.5-flash-lite', 'feature-3');
      this.registerAgent(a);
      return a;
    }

    if (targetId === 'coder-1' || targetId === 'coder-free-1') {
      const a = new CodingAgentFree('codestral-latest', 'coder-1');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'coder-2' || targetId === 'coder-pro-1') {
      const a = new CodingAgentPro('kimi-k3', 'coder-2');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'coder-3' || targetId === 'coder-max-1') {
      const a = new CodingAgentMax('gemini-3.5-flash-lite', 'coder-3');
      this.registerAgent(a);
      return a;
    }

    if (targetId === 'qa-1' || targetId === 'qa-free-1') {
      const a = new QAAgentFree('codestral-latest', 'qa-1');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'qa-2' || targetId === 'qa-pro-1') {
      const a = new QAAgentPro('kimi-k3', 'qa-2');
      this.registerAgent(a);
      return a;
    }
    if (targetId === 'qa-3' || targetId === 'qa-max-1') {
      const a = new QAAgentMax('gemini-3.5-flash-lite', 'qa-3');
      this.registerAgent(a);
      return a;
    }

    throw new Error(`Agent "${id}" (target: "${targetId}") not found in registry. Registered: ${Array.from(this.agents.keys()).join(', ')}`);
  }

  /**
   * Set active team selection for each logical role
   */
  setActiveAgents({ manager, designer, frontend, feature, coder, qa } = {}) {
    if (manager) this.aliasMap.set('manager', manager);
    if (designer) this.aliasMap.set('designer', designer);
    if (frontend) this.aliasMap.set('frontend_architect', frontend);
    if (feature) this.aliasMap.set('feature_architect', feature);
    if (coder) {
      this.aliasMap.set('coding_agent', coder);
      this.aliasMap.set('coder', coder);
    }
    if (qa) this.aliasMap.set('qa', qa);
  }

  /**
   * Returns active logical agents (default length: 6) or all 16 registered staff members
   */
  getAllAgents({ all = false } = {}) {
    if (all) {
      return Array.from(this.agents.values());
    }
    const logicalRoles = ['manager', 'designer', 'frontend_architect', 'feature_architect', 'coding_agent', 'qa'];
    return logicalRoles.map(role => this.getAgent(role));
  }

  getAllStaff() {
    return Array.from(this.agents.values());
  }

  updateAgentModel(id, modelId) {
    const agent = this.getAgent(id);
    agent.setModel(modelId);
    this.emit('agentModelUpdated', { agentId: agent.id, modelId });
    return agent;
  }

  resetAll() {
    for (const agent of this.agents.values()) {
      agent.reset();
    }
  }

  toJSON() {
    return this.getAllAgents().map(a => a.toJSON());
  }
}

export const agentRegistry = new AgentRegistry();
agentRegistry.initFullAgencyRoster();
