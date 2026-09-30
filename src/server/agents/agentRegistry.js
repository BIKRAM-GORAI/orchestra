import EventEmitter from 'events';
import { ManagerAgent } from './definitions/managerAgent.js';
import { DesignerAgent } from './definitions/designerAgent.js';
import { FrontendArchitectAgent } from './definitions/frontendArchitectAgent.js';
import { FeatureArchitectAgent } from './definitions/featureArchitectAgent.js';
import { CodingAgent } from './definitions/codingAgent.js';
import { QAAgent } from './definitions/qaAgent.js';

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
    this.aliasMap.set('frontend_architect', 'frontend-1');
    this.aliasMap.set('frontend', 'frontend-1');
    this.aliasMap.set('feature_architect', 'feature-1');
    this.aliasMap.set('feature', 'feature-1');
    this.aliasMap.set('coding_agent', 'coder-1');
    this.aliasMap.set('coder', 'coder-1');
    this.aliasMap.set('qa', 'qa-1');
  }

  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    // Forward agent state events to registry listeners
    agent.on('state', (event) => {
      this.emit('agentState', event);
    });
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
  createAgentInstance({ role, model = 'gemini-3.5-flash-lite', id = null } = {}) {
    let agent;
    const normalizedRole = role?.toLowerCase() || 'designer';

    if (normalizedRole.includes('design')) {
      const uniqueId = id || this.generateNextAgentId('designer');
      agent = new DesignerAgent(model, uniqueId);
    } else if (normalizedRole.includes('frontend')) {
      const uniqueId = id || this.generateNextAgentId('frontend');
      agent = new FrontendArchitectAgent(model, uniqueId);
    } else if (normalizedRole.includes('feature')) {
      const uniqueId = id || this.generateNextAgentId('feature');
      agent = new FeatureArchitectAgent(model, uniqueId);
    } else if (normalizedRole.includes('cod')) {
      const uniqueId = id || this.generateNextAgentId('coder');
      agent = new CodingAgent(model, uniqueId);
    } else if (normalizedRole.includes('qa') || normalizedRole.includes('audit')) {
      const uniqueId = id || this.generateNextAgentId('qa');
      agent = new QAAgent(model, uniqueId);
    } else {
      const uniqueId = id || this.generateNextAgentId('agent');
      agent = new DesignerAgent(model, uniqueId);
    }

    this.registerAgent(agent);
    return agent;
  }

  getAgent(id) {
    if (this.agents.has(id)) {
      return this.agents.get(id);
    }
    if (this.aliasMap.has(id)) {
      const realId = this.aliasMap.get(id);
      if (this.agents.has(realId)) {
        return this.agents.get(realId);
      }
    }
    throw new Error(`Agent "${id}" not found in registry. Registered: ${Array.from(this.agents.keys()).join(', ')}`);
  }

  getAllAgents() {
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
