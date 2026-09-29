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
    this.initDefaultAgents();
  }

  initDefaultAgents() {
    const defaultAgents = [
      new ManagerAgent('gemini-3.5-flash'),
      new DesignerAgent('gemini-3.5-flash'),
      new FrontendArchitectAgent('gemini-3.5-flash'),
      new FeatureArchitectAgent('gemini-3.5-flash'),
      new CodingAgent('gemini-3.5-flash'),
      new QAAgent('gemini-3.5-flash'),
    ];

    for (const agent of defaultAgents) {
      this.registerAgent(agent);
    }
  }

  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    // Forward agent state events to registry listeners
    agent.on('state', (event) => {
      this.emit('agentState', event);
    });
  }

  getAgent(id) {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent "${id}" not found in registry. Registered: ${Array.from(this.agents.keys()).join(', ')}`);
    }
    return agent;
  }

  getAllAgents() {
    return Array.from(this.agents.values());
  }

  updateAgentModel(id, modelId) {
    const agent = this.getAgent(id);
    agent.setModel(modelId);
    this.emit('agentModelUpdated', { agentId: id, modelId });
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
