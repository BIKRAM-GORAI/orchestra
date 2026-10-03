import EventEmitter from 'events';
import { modelGateway } from '../gateway/modelGateway.js';
import { getProjectContract, PROJECT_RULES } from './projectContracts.js';

export const AGENT_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  WORKING: 'working',
  STREAMING: 'streaming',
  COMPLETED: 'completed',
  ERROR: 'error',
  RETRYING: 'retrying',
};

/**
 * Prebuilt automated fallback chains based on agent model / tier hierarchy:
 * - Free Model (codestral-latest):
 *     Primary: Free/Eval model (codestral-latest)
 *     Fallback 1: Next best model (kimi-k3)
 *     Fallback 2: Top best model (gemini-3.5-flash-lite)
 * - Pro Model (kimi-k3):
 *     Primary: Moderate model (kimi-k3)
 *     Fallback 1: Top best model (gemini-3.5-flash-lite)
 *     Fallback 2: Free model backup (codestral-latest)
 * - Premium Model (gemini-3.5-flash-lite / Manager):
 *     Primary: Top best model (gemini-3.5-flash-lite)
 *     Fallback 1: Second best model (kimi-k3)
 *     Fallback 2: Third model (codestral-latest)
 */
export function getPrebuiltFallbackChain(modelId = '') {
  const m = String(modelId).toLowerCase();
  if (m.includes('codestral') || m.includes('qwen')) {
    return ['kimi-k3', 'gemini-3.5-flash-lite'];
  }
  if (m.includes('kimi')) {
    return ['gemini-3.5-flash-lite', 'codestral-latest'];
  }
  // Gemini or default premium
  return ['kimi-k3', 'codestral-latest'];
}

/**
 * Base Agent
 * 
 * Logical entity encapsulating:
 * - Identity (id, name, emoji, role)
 * - Skills & capabilities
 * - Configured model assignment (decoupled from inference)
 * - System instructions and output schema
 * - Strict state machine lifecycle
 */
export class BaseAgent extends EventEmitter {
  constructor({
    id,
    name,
    emoji = '🤖',
    role,
    description,
    skills = [],
    model = 'kimi-k3',
    fallbackModels = null,
    systemPrompt = '',
    outputSchema = null,
    contractRole = null,
  }) {
    super();
    if (!id || !name) {
      throw new Error('Agent requires both "id" and "name"');
    }
    this.id = id;
    this.name = name;
    this.emoji = emoji;
    this.role = role;
    this.description = description;
    this.skills = skills;
    this.modelId = model;
    this.fallbackModels = Array.isArray(fallbackModels) && fallbackModels.length > 0
      ? [...fallbackModels]
      : getPrebuiltFallbackChain(model);
    this.contractRole = contractRole;
    const contract = contractRole ? getProjectContract(contractRole) : null;
    this.systemPrompt = contract ? `${PROJECT_RULES}\n\n${contract.prompt}` : systemPrompt;
    this.outputSchema = contract?.schema || outputSchema;

    this.state = AGENT_STATES.IDLE;
    this.lastOutput = null;
    this.lastError = null;
  }

  /**
   * Transition state and notify listeners
   */
  setState(newState, payload = {}) {
    this.state = newState;
    this.emit('state', {
      agentId: this.id,
      state: newState,
      timestamp: new Date().toISOString(),
      ...payload,
    });
  }

  /**
   * Set or update assigned model ID and synchronize prebuilt fallback chain
   */
  setModel(newModelId) {
    this.modelId = newModelId;
    this.fallbackModels = getPrebuiltFallbackChain(newModelId);
  }

  /**
   * Set or update fallback models list
   */
  setFallbackModels(models) {
    if (Array.isArray(models)) {
      this.fallbackModels = [...models];
    }
  }

  /**
   * Reset state to IDLE
   */
  reset() {
    this.state = AGENT_STATES.IDLE;
    this.lastOutput = null;
    this.lastError = null;
    this.emit('state', { agentId: this.id, state: AGENT_STATES.IDLE });
  }

  /**
   * Format messages for the model gateway
   */
  buildMessages(userInput, context = {}, outputSchema = this.outputSchema, systemPrompt = this.systemPrompt) {
    const messages = [];

    let sys = systemPrompt;
    if (outputSchema) {
      sys += `\n\nCRITICAL OUTPUT REQUIREMENT:\nYou MUST respond ONLY with valid JSON conforming to the following structure. Do not wrap with conversational filler or markdown explanations outside the JSON object.\nExpected Schema:\n${JSON.stringify(outputSchema, null, 2)}`;
    }

    if (sys) {
      messages.push({ role: 'system', content: sys });
    }

    let userContent = typeof userInput === 'string' ? userInput : JSON.stringify(userInput, null, 2);
    if (context && Object.keys(context).length > 0) {
      userContent = `[CONTEXT]:\n${JSON.stringify(context, null, 2)}\n\n[TASK]:\n${userContent}`;
    }

    messages.push({ role: 'user', content: userContent });
    return messages;
  }

  /**
   * Parse structured JSON from model text
   */
  parseStructuredOutput(rawText, outputSchema = this.outputSchema) {
    if (!outputSchema) return rawText;

    let cleaned = rawText.trim();
    // Strip markdown code fences if model returned ```json ... ```
    if (cleaned.startsWith('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) cleaned = match[1].trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      console.warn(`[AGENT ${this.id}] Failed to parse JSON output directly:`, err.message);
      // Attempt to extract the first balanced { ... } object
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch (_) {}
      }
      return { raw: rawText, parseError: err.message };
    }
  }

  /**
   * Execute agent task using the configured Model Gateway
   */
  async execute({
    input,
    context = {},
    parameters = {},
    onChunk = null,
    onStateChange = null,
    gateway = modelGateway,
    outputSchema = this.outputSchema,
    systemPrompt = this.systemPrompt,
  } = {}) {
    this.setState(AGENT_STATES.WORKING, { model: this.modelId });
    this.lastError = null;

    const messages = this.buildMessages(input, context, outputSchema, systemPrompt);

    try {
      const result = await gateway.generate({
        modelId: this.modelId,
        fallbackModels: this.fallbackModels,
        messages,
        parameters,
        onChunk: (chunk) => {
          if (this.state !== AGENT_STATES.STREAMING) {
            this.setState(AGENT_STATES.STREAMING, { model: this.modelId });
          }
          if (onChunk) onChunk(chunk);
        },
        onStateChange: (state, details) => {
          if (state === 'retrying') {
            this.setState(AGENT_STATES.RETRYING, details);
          } else if (state === 'fallback') {
            this.setState(AGENT_STATES.RETRYING, { ...details, isFallback: true });
            this.emit('fallback', { agentId: this.id, ...details });
          }
          if (onStateChange) onStateChange(state, details);
        },
      });

      const parsed = this.parseStructuredOutput(result.text, outputSchema);
      this.lastOutput = {
        result: parsed,
        rawText: result.text,
        reasoningText: result.reasoningText,
        model: result.model,
        cost: result.cost ?? 0,
        durationMs: result.durationMs,
        attempts: result.attempts,
      };

      this.setState(AGENT_STATES.COMPLETED, {
        durationMs: result.durationMs,
        attempts: result.attempts,
        model: result.model,
        cost: result.cost ?? 0,
      });

      return this.lastOutput;
    } catch (error) {
      this.lastError = error;
      this.setState(AGENT_STATES.ERROR, { error: error.message });
      throw error;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      emoji: this.emoji,
      role: this.role,
      description: this.description,
      skills: this.skills,
      model: this.modelId,
      modelId: this.modelId,
      primaryModel: this.modelId,
      fallbackModels: this.fallbackModels || [],
      state: this.state,
    };
  }
}
