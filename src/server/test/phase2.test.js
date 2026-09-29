import assert from 'node:assert';
import test from 'node:test';
import { BaseAgent, AGENT_STATES } from '../agents/baseAgent.js';
import { agentRegistry } from '../agents/agentRegistry.js';

test('Phase 2: Agent Registry Initialization & Metadata', () => {
  const allAgents = agentRegistry.getAllAgents();
  assert.strictEqual(allAgents.length, 6, 'Exactly 6 logical agents registered');

  const expectedIds = ['manager', 'designer', 'frontend_architect', 'feature_architect', 'coding_agent', 'qa'];
  for (const id of expectedIds) {
    const agent = agentRegistry.getAgent(id);
    assert.ok(agent, `Agent ${id} exists in registry`);
    assert.strictEqual(agent.modelId, 'gemini-3.5-flash', `Agent ${id} initially uses gemini-3.5-flash`);
    assert.ok(agent.skills.length > 0, `Agent ${id} has defined skills`);
    assert.ok(agent.systemPrompt.length > 0, `Agent ${id} has system instructions`);
  }
});

test('Phase 2: Model Assignment Decoupling', () => {
  const designer = agentRegistry.getAgent('designer');
  assert.strictEqual(designer.modelId, 'gemini-3.5-flash');

  // Dynamically reassign model
  agentRegistry.updateAgentModel('designer', 'kimi-k3');
  assert.strictEqual(designer.modelId, 'kimi-k3', 'Model assignment dynamically changed to kimi-k3');

  // Revert back
  agentRegistry.updateAgentModel('designer', 'gemini-3.5-flash');
  assert.strictEqual(designer.modelId, 'gemini-3.5-flash');
});

test('Phase 2: BaseAgent State Machine & Output Parsing', async () => {
  const agent = new BaseAgent({
    id: 'test_agent',
    name: 'Test Agent',
    role: 'Testing',
    skills: ['testing'],
    model: 'kimi-k3',
    outputSchema: {
      status: 'completed',
      result: 'String',
    },
  });

  const stateTransitions = [];
  agent.on('state', (ev) => stateTransitions.push(ev.state));

  // Test structured parsing with code fences
  const parsed = agent.parseStructuredOutput('```json\n{"status": "completed", "result": "passed"}\n```');
  assert.strictEqual(parsed.status, 'completed');
  assert.strictEqual(parsed.result, 'passed');

  // Test execution with mock gateway
  const mockGateway = {
    async generate({ onChunk, onStateChange }) {
      if (onChunk) onChunk({ delta: '{"status":' });
      if (onChunk) onChunk({ delta: '"completed", "result": "ok"}' });
      return {
        text: '{"status": "completed", "result": "ok"}',
        reasoningText: 'Thought about testing',
        model: 'moonshotai/kimi-k3',
        durationMs: 15,
        attempts: 1,
      };
    },
  };

  const output = await agent.execute({
    input: 'Run test task',
    gateway: mockGateway,
  });

  assert.strictEqual(output.result.status, 'completed');
  assert.strictEqual(output.result.result, 'ok');
  assert.ok(stateTransitions.includes(AGENT_STATES.WORKING));
  assert.ok(stateTransitions.includes(AGENT_STATES.STREAMING));
  assert.ok(stateTransitions.includes(AGENT_STATES.COMPLETED));
});
