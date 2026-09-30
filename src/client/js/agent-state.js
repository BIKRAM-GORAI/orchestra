/**
 * Agent Orchestra — Centralized Agent State Manager
 * 
 * Single Source of Truth for all Agent States across:
 * - Inspector Card & Current Task Panel
 * - Sidebar Roster Strip & Status Indicators
 * - Team Directory Dossiers
 * - 2.5D Virtual Office Simulation (posture, bubbles, visual halo)
 * - Live Terminal Activity Feed
 * 
 * Strict State Machine Lifecycle:
 * IDLE -> QUEUED -> WORKING -> THINKING / CODING / RUNNING / WAITING -> COMPLETED -> (timer) IDLE
 * Error: WORKING -> FAILED
 */

export const AGENT_STATUS = {
  IDLE: 'IDLE',
  QUEUED: 'QUEUED',
  WORKING: 'WORKING',
  THINKING: 'THINKING',
  CODING: 'CODING',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PAUSED: 'PAUSED',
};

// Initial Roster Blueprint with dedicated identity, colors, roles, and assigned rooms
export const AGENT_DEFINITIONS = {
  // 1. Executive Manager
  atlas: {
    id: 'atlas',
    backendId: 'manager-1',
    name: 'Atlas',
    tag: 'AT',
    role: 'Lead Architect & Manager',
    color: '#F59E0B', // Amber / Gold
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite (Google AI)',
    room: 'Manager Suite',
    core: true,
    skills: ['Intent Understanding', 'Task Decomposition', 'Multi-Agent Synthesis', 'Fallback Routing'],
  },

  // 2. Designers (3 Individual Agents)
  pixel: {
    id: 'pixel',
    backendId: 'designer-1',
    name: 'Pixel',
    tag: 'PX',
    role: 'Junior Designer (Free Tier)',
    color: '#C084FC', // Lavender
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    core: true,
    skills: ['Harmonious Palettes', 'Typography Hierarchy', 'Spacing Grids', 'Responsive Breakpoints'],
  },
  chroma: {
    id: 'chroma',
    backendId: 'designer-2',
    name: 'Chroma',
    tag: 'CR',
    role: 'UI/UX Designer (Pro Tier)',
    color: '#A855F7', // Vibrant Purple
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    core: true,
    skills: ['Design Tokens', 'Micro-interactions', 'Component Aesthetics', 'Interaction States'],
  },
  canvas: {
    id: 'canvas',
    backendId: 'designer-3',
    name: 'Canvas',
    tag: 'CV',
    role: 'Lead Designer (Max Tier)',
    color: '#7E22CE', // Deep Purple
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    core: true,
    skills: ['Complete Design Systems', 'Visual Rhythm', 'Design-to-Code Fidelity', 'Edge-Case Visuals'],
  },

  // 3. Frontend Architects (3 Individual Agents)
  nova: {
    id: 'nova',
    backendId: 'frontend-1',
    name: 'Nova',
    tag: 'NV',
    role: 'Junior Frontend (Free Tier)',
    color: '#38BDF8', // Sky Blue
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    core: true,
    skills: ['Semantic HTML5', 'CSS Variables', 'Flexbox & Grid', 'Single-File Architecture'],
  },
  blueprint: {
    id: 'blueprint',
    backendId: 'frontend-2',
    name: 'Blueprint',
    tag: 'BP',
    role: 'Frontend Architect (Pro Tier)',
    color: '#0284C7', // Ocean Blue
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    core: true,
    skills: ['DOM Hierarchy', 'Client State Architecture', 'Event Delegation', 'Accessibility Semantics'],
  },
  apex: {
    id: 'apex',
    backendId: 'frontend-3',
    name: 'Apex',
    tag: 'AP',
    role: 'Lead Frontend Architect (Max Tier)',
    color: '#0369A1', // Deep Cyan
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    core: true,
    skills: ['State-Driven Architecture', 'Performance Optimization', 'Progressive Enhancement', 'Contract Validation'],
  },

  // 4. Feature Architects (3 Individual Agents)
  scout: {
    id: 'scout',
    backendId: 'feature-1',
    name: 'Scout',
    tag: 'SC',
    role: 'Feature Analyst (Free Tier)',
    color: '#2DD4BF', // Teal
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    core: true,
    skills: ['Feature Decomposition', 'User Flow Definition', 'Search & Filtering', 'Form Validation'],
  },
  beacon: {
    id: 'beacon',
    backendId: 'feature-2',
    name: 'Beacon',
    tag: 'BC',
    role: 'Feature Architect (Pro Tier)',
    color: '#0D9488', // Dark Teal
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    core: true,
    skills: ['State Machine Design', 'User Journey Mapping', 'Cart & Checkout Flows', 'Empty-State Handling'],
  },
  compass: {
    id: 'compass',
    backendId: 'feature-3',
    name: 'Compass',
    tag: 'CP',
    role: 'Lead Feature Architect (Max Tier)',
    color: '#0F766E', // Forest Teal
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    core: true,
    skills: ['Full Functional Architecture', 'Interaction Contracts', 'Feature Dependency Graphs', 'Edge-Case Matrix'],
  },

  // 5. Coders (3 Individual Agents)
  byte: {
    id: 'byte',
    backendId: 'coder-1',
    name: 'Byte',
    tag: 'BY',
    role: 'Junior Coder (Free Tier)',
    color: '#34D399', // Mint Green
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    core: true,
    skills: ['Single-File index.html', 'Vanilla JavaScript', 'Event Handlers', 'Surgical Code Patching'],
  },
  cipher: {
    id: 'cipher',
    backendId: 'coder-2',
    name: 'Cipher',
    tag: 'CI',
    role: 'Fullstack Coder (Pro Tier)',
    color: '#10B981', // Emerald Green
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    core: true,
    skills: ['Dynamic DOM Manipulation', 'Interactive State', 'Form Validation & Feedback', 'Minimal-Change Preservation'],
  },
  matrix: {
    id: 'matrix',
    backendId: 'coder-3',
    name: 'Matrix',
    tag: 'MX',
    role: 'Lead Coder (Max Tier)',
    color: '#059669', // Deep Emerald
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    core: true,
    skills: ['Single-File Synthesis', 'Modern CSS Systems', 'Full Interactive JS', 'Regression-Free Surgery'],
  },

  // 6. QA Auditors (3 Individual Agents)
  query: {
    id: 'query',
    backendId: 'qa-1',
    name: 'Query',
    tag: 'QR',
    role: 'Junior QA (Free Tier)',
    color: '#FB923C', // Coral Orange
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    core: true,
    skills: ['Static Analysis', 'DOM Structure Inspection', 'JS Error Detection', 'Requirements Verification'],
  },
  audit: {
    id: 'audit',
    backendId: 'qa-2',
    name: 'Audit',
    tag: 'AD',
    role: 'QA Auditor (Pro Tier)',
    color: '#F97316', // Orange
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    core: true,
    skills: ['JavaScript Correctness', 'Event-Flow Verification', 'Responsive Layout Audit', 'Defect Severity'],
  },
  sentinel: {
    id: 'sentinel',
    backendId: 'qa-3',
    name: 'Sentinel',
    tag: 'ST',
    role: 'Lead QA Inspector (Max Tier)',
    color: '#EA580C', // Deep Orange
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    core: true,
    skills: ['Comprehensive Code Audit', 'DOM Integrity Trapping', 'Functional Tracing', 'Automated Repair Directives'],
  },
};

// Map backend agent IDs to client agent IDs
export const BACKEND_TO_CLIENT_MAP = {
  // Manager
  manager: 'atlas',
  'manager-1': 'atlas',
  'manager-free-1': 'atlas',
  'manager-pro-1': 'atlas',
  'manager-max-1': 'atlas',
  atlas: 'atlas',

  // Designers
  designer: 'pixel',
  'designer-1': 'pixel',
  'designer-free-1': 'pixel',
  pixel: 'pixel',
  'designer-2': 'chroma',
  'designer-pro-1': 'chroma',
  chroma: 'chroma',
  'designer-3': 'canvas',
  'designer-max-1': 'canvas',
  canvas: 'canvas',

  // Frontend Architects
  frontend_architect: 'nova',
  frontend: 'nova',
  'frontend-1': 'nova',
  'frontend-free-1': 'nova',
  nova: 'nova',
  'frontend-2': 'blueprint',
  'frontend-pro-1': 'blueprint',
  blueprint: 'blueprint',
  'frontend-3': 'apex',
  'frontend-max-1': 'apex',
  apex: 'apex',

  // Feature Architects
  feature_architect: 'scout',
  feature: 'scout',
  'feature-1': 'scout',
  'feature-free-1': 'scout',
  scout: 'scout',
  'feature-2': 'beacon',
  'feature-pro-1': 'beacon',
  beacon: 'beacon',
  'feature-3': 'compass',
  'feature-max-1': 'compass',
  compass: 'compass',

  // Coders
  coding_agent: 'byte',
  coder: 'byte',
  'coder-1': 'byte',
  'coder-free-1': 'byte',
  byte: 'byte',
  'coder-2': 'cipher',
  'coder-pro-1': 'cipher',
  cipher: 'cipher',
  'coder-3': 'matrix',
  'coder-max-1': 'matrix',
  matrix: 'matrix',

  // QA Auditors
  qa: 'query',
  'qa-1': 'query',
  'qa-free-1': 'query',
  query: 'query',
  'qa-2': 'audit',
  'qa-pro-1': 'audit',
  audit: 'audit',
  'qa-3': 'sentinel',
  'qa-max-1': 'sentinel',
  sentinel: 'sentinel',
};

/**
 * Returns formatted status display string adhering strictly to Section 2 specification.
 */
export function getStatusDisplayText(status, action = null) {
  switch (status) {
    case AGENT_STATUS.IDLE:
      return 'Idle — Waiting for a task';
    case AGENT_STATUS.QUEUED:
      return 'Queued — Waiting to start';
    case AGENT_STATUS.WORKING:
      return `Working — ${action || 'Analyzing the assigned task'}`;
    case AGENT_STATUS.THINKING:
      return `Thinking — ${action || 'Evaluating requirements'}`;
    case AGENT_STATUS.CODING:
      return `Coding — ${action || 'Implementing application'}`;
    case AGENT_STATUS.RUNNING:
      return `Running — ${action || 'Executing validation'}`;
    case AGENT_STATUS.WAITING:
      return `Waiting — ${action || 'Awaiting upstream artifacts'}`;
    case AGENT_STATUS.COMPLETED:
      return 'Completed — Task finished successfully';
    case AGENT_STATUS.FAILED:
      return `Failed — ${action || 'Execution encountered an error'}`;
    case AGENT_STATUS.PAUSED:
      return `Paused — ${action || 'Task paused'}`;
    default:
      return 'Idle — Waiting for a task';
  }
}

class AgentStateManager {
  constructor() {
    this.agents = {};
    this.subscribers = new Set();
    this.terminalListeners = new Set();
    this.completionTimers = new Map();

    // Default hired team for standard balanced tier ($0.25)
    const defaultHired = new Set(['atlas', 'matrix', 'audit', 'chroma', 'blueprint', 'scout']);

    // Initialize all agents to IDLE state (zero fake / random states)
    for (const [id, def] of Object.entries(AGENT_DEFINITIONS)) {
      this.agents[id] = {
        id: def.id,
        backendId: def.backendId,
        name: def.name,
        role: def.role,
        tag: def.tag,
        color: def.color,
        tier: def.tier || 'pro',
        model: def.model,
        room: def.room,
        core: def.core,
        skills: def.skills,
        status: AGENT_STATUS.IDLE,
        isHired: defaultHired.has(id),
        currentTask: null,
        lastAction: null,
        progress: 0,
        startedAt: null,
        completedAt: null,
      };
    }
  }

  setHiredAgents(hiredIds = []) {
    const hiredSet = new Set(hiredIds.map(id => BACKEND_TO_CLIENT_MAP[id] || id));
    for (const agent of Object.values(this.agents)) {
      const wasHired = agent.isHired;
      agent.isHired = hiredSet.has(agent.id);
      if (wasHired !== agent.isHired) {
        this.notifySubscribers(agent);
      }
    }
  }

  getAgent(id) {
    const resolvedId = BACKEND_TO_CLIENT_MAP[id] || id;
    return this.agents[resolvedId] || null;
  }

  getAllAgents() {
    return Object.values(this.agents);
  }

  getActiveAgentsCount() {
    return Object.values(this.agents).filter(a => a.status !== AGENT_STATUS.IDLE).length;
  }

  getIdleAgentsCount() {
    return Object.values(this.agents).filter(a => a.status === AGENT_STATUS.IDLE).length;
  }

  updateAgentModel(agentId, model) {
    const id = BACKEND_TO_CLIENT_MAP[agentId] || agentId;
    const agent = this.agents[id];
    if (agent) {
      agent.model = model;
      this.notifySubscribers(agent);
    }
  }

  registerAgent(agentDef) {
    const id = agentDef.id;
    this.agents[id] = {
      ...agentDef,
      status: AGENT_STATUS.IDLE,
      currentTask: null,
      lastAction: 'Standby',
      progress: 0,
      startedAt: null,
      completedAt: null,
    };
    BACKEND_TO_CLIENT_MAP[id] = id;
    this.notifySubscribers(this.agents[id]);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  onTerminalLog(callback) {
    this.terminalListeners.add(callback);
    return () => this.terminalListeners.delete(callback);
  }

  emitTerminalLog(agent, status, message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    for (const cb of this.terminalListeners) {
      cb({
        timestamp,
        agentTag: agent ? agent.tag : 'SYS',
        agentName: agent ? agent.name : 'SYSTEM',
        agentColor: agent ? agent.color : '#94A3B8',
        status: status || 'INFO',
        message,
        type,
      });
    }
  }

  /**
   * Central method to update an agent's real activity state.
   */
  setAgentState(agentId, updates = {}, { log = true } = {}) {
    const id = BACKEND_TO_CLIENT_MAP[agentId] || agentId;
    const agent = this.agents[id];
    if (!agent) {
      console.warn(`[AgentStateManager] Unknown agent "${agentId}"`);
      return null;
    }

    const prevStatus = agent.status;
    const prevAction = agent.lastAction;

    // Clear any pending completion return timer if state changes
    if (this.completionTimers.has(id)) {
      clearTimeout(this.completionTimers.get(id));
      this.completionTimers.delete(id);
    }

    if (updates.status !== undefined) {
      agent.status = updates.status;
    }
    if (updates.currentTask !== undefined) {
      agent.currentTask = updates.currentTask;
    }
    if (updates.lastAction !== undefined) {
      agent.lastAction = updates.lastAction;
    }
    if (updates.progress !== undefined) {
      agent.progress = Math.min(100, Math.max(0, updates.progress));
    }

    // Lifecycle timestamps
    if (agent.status !== AGENT_STATUS.IDLE && !agent.startedAt) {
      agent.startedAt = new Date().toLocaleTimeString();
      agent.completedAt = null;
    }

    if (agent.status === AGENT_STATUS.COMPLETED) {
      agent.completedAt = new Date().toLocaleTimeString();
      agent.progress = 100;

      // Section 3: Automatically return to IDLE after completion display duration (3.5s)
      const timer = setTimeout(() => {
        this.setAgentState(id, {
          status: AGENT_STATUS.IDLE,
          currentTask: null,
          lastAction: null,
          progress: 0,
          startedAt: null,
          completedAt: null,
        }, { log: true });
      }, 3500);
      this.completionTimers.set(id, timer);
    }

    if (agent.status === AGENT_STATUS.IDLE && prevStatus !== AGENT_STATUS.IDLE) {
      agent.currentTask = null;
      agent.lastAction = null;
      agent.progress = 0;
      agent.startedAt = null;
      agent.completedAt = null;
    }

    // Emit live terminal event if meaningful transition occurred
    if (log && (agent.status !== prevStatus || agent.lastAction !== prevAction)) {
      let logType = 'info';
      if (agent.status === AGENT_STATUS.WORKING || agent.status === AGENT_STATUS.CODING || agent.status === AGENT_STATUS.THINKING) {
        logType = 'working';
      } else if (agent.status === AGENT_STATUS.COMPLETED) {
        logType = 'success';
      } else if (agent.status === AGENT_STATUS.FAILED) {
        logType = 'error';
      }

      const actionText = agent.lastAction || (agent.status === AGENT_STATUS.IDLE ? 'Waiting for instructions' : agent.currentTask || 'Active');
      this.emitTerminalLog(agent, agent.status, actionText, logType);
    }

    // Notify all UI subscribers
    for (const sub of this.subscribers) {
      try {
        sub(agent, prevStatus);
      } catch (err) {
        console.error('[AgentStateManager] Subscriber error:', err);
      }
    }

    return agent;
  }

  /**
   * Reset all agents to clean IDLE state.
   */
  resetAll() {
    for (const id of Object.keys(this.agents)) {
      if (this.completionTimers.has(id)) {
        clearTimeout(this.completionTimers.get(id));
        this.completionTimers.delete(id);
      }
      this.setAgentState(id, {
        status: AGENT_STATUS.IDLE,
        currentTask: null,
        lastAction: null,
        progress: 0,
        startedAt: null,
        completedAt: null,
      }, { log: false });
    }
  }

  /**
   * Bridges backend SSE pipeline events directly into the single source of truth.
   */
  handlePipelineEvent(data) {
    if (!data || !data.stage) return;
    const stage = data.stage;

    switch (stage) {
      case 'PIPELINE_STARTED': {
        const prompt = data.prompt || 'Project Build';
        this.emitTerminalLog(null, 'SYSTEM', `Task received: "${prompt.slice(0, 60)}..."`, 'info');
        this.setAgentState('atlas', {
          status: AGENT_STATUS.QUEUED,
          currentTask: `Orchestrate: "${prompt.slice(0, 45)}"`,
          lastAction: 'Task assigned. Waiting to start pipeline',
          progress: 5,
        });
        break;
      }

      case 'MANAGER_PLAN_STARTED': {
        const prompt = data.prompt || 'Project Build';
        this.setAgentState('atlas', {
          status: AGENT_STATUS.THINKING,
          currentTask: `Scope analysis: "${prompt.slice(0, 40)}"`,
          lastAction: 'Analyzing user requirements & selecting specialists',
          progress: 15,
        });
        break;
      }

      case 'MANAGER_PLAN_COMPLETED': {
        const specialists = data.plan?.selected_agents || ['designer', 'frontend_architect', 'feature_architect'];
        this.setAgentState('atlas', {
          status: AGENT_STATUS.WORKING,
          lastAction: `Plan compiled. Selected specialists: ${specialists.map(s => BACKEND_TO_CLIENT_MAP[s] || s).join(', ')}`,
          progress: 30,
        });

        // Transition assigned specialists to QUEUED
        for (const specBackendId of specialists) {
          const clientAgentId = BACKEND_TO_CLIENT_MAP[specBackendId];
          if (clientAgentId) {
            this.setAgentState(clientAgentId, {
              status: AGENT_STATUS.QUEUED,
              currentTask: 'Author technical specifications',
              lastAction: 'Queued — Waiting for delegation dispatch',
              progress: 0,
            });
          }
        }
        break;
      }

      case 'SPECIALISTS_STARTED': {
        this.setAgentState('atlas', {
          status: AGENT_STATUS.WAITING,
          lastAction: 'Awaiting specialist specifications',
          progress: 35,
        });

        const selected = data.selectedAgents || ['designer', 'frontend_architect', 'feature_architect'];
        if (selected.includes('designer')) {
          this.setAgentState('pixel', {
            status: AGENT_STATUS.WORKING,
            currentTask: 'Design System & Visual Direction',
            lastAction: 'Defining palette, typography & layout hierarchy',
            progress: 40,
          });
        }
        if (selected.includes('frontend_architect')) {
          this.setAgentState('nova', {
            status: AGENT_STATUS.WORKING,
            currentTask: 'Semantic HTML5 Architecture',
            lastAction: 'Structuring single-file DOM & CSS tokens',
            progress: 40,
          });
        }
        if (selected.includes('feature_architect')) {
          this.setAgentState('scout', {
            status: AGENT_STATUS.WORKING,
            currentTask: 'Feature Behaviors & Interactions',
            lastAction: 'Specifying user interaction flows & state',
            progress: 40,
          });
        }
        break;
      }

      case 'SPECIALISTS_COMPLETED': {
        this.setAgentState('pixel', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: 'Design specifications authored successfully',
          progress: 100,
        });
        this.setAgentState('nova', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: 'Frontend architecture authored successfully',
          progress: 100,
        });
        this.setAgentState('scout', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: 'Feature behaviors authored successfully',
          progress: 100,
        });
        break;
      }

      case 'MANAGER_SYNTHESIS_STARTED': {
        this.setAgentState('atlas', {
          status: AGENT_STATUS.THINKING,
          currentTask: 'Unified Implementation Specification',
          lastAction: 'Synthesizing specialist specs for Coding Agent',
          progress: 55,
        });
        break;
      }

      case 'MANAGER_SYNTHESIS_COMPLETED': {
        this.setAgentState('atlas', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: 'Unified Implementation Specification delivered to Byte',
          progress: 100,
        });

        // Queue coding agent
        this.setAgentState('byte', {
          status: AGENT_STATUS.QUEUED,
          currentTask: 'Implement single-file index.html',
          lastAction: 'Unified spec received. Queued for build',
          progress: 0,
        });
        break;
      }

      case 'CODING_AGENT_STARTED': {
        this.setAgentState('atlas', {
          status: AGENT_STATUS.WAITING,
          lastAction: 'Awaiting implementation deliverable from Byte',
          progress: 60,
        });
        this.setAgentState('byte', {
          status: AGENT_STATUS.CODING,
          currentTask: 'Implement standalone index.html',
          lastAction: 'Writing semantic HTML5, CSS tokens & vanilla JS handlers',
          progress: 65,
        });
        break;
      }

      case 'CODING_AGENT_COMPLETED': {
        const length = data.contentLength || 0;
        this.setAgentState('byte', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: `Generated index.html (${length.toLocaleString()} bytes)`,
          progress: 100,
        });

        // Queue QA
        this.setAgentState('query', {
          status: AGENT_STATUS.QUEUED,
          currentTask: 'DOM integrity & compliance audit',
          lastAction: 'Code received. Queued for inspection',
          progress: 0,
        });
        break;
      }

      case 'QA_STARTED': {
        this.setAgentState('query', {
          status: AGENT_STATUS.RUNNING,
          currentTask: 'DOM integrity & compliance audit',
          lastAction: 'Running DOM validation, script checks & responsive inspection',
          progress: 85,
        });
        break;
      }

      case 'QA_REPAIR_STARTED': {
        const issueCount = data.issueCount || 1;
        this.setAgentState('query', {
          status: AGENT_STATUS.WAITING,
          lastAction: `Found ${issueCount} defect(s). Awaiting repair by Byte`,
          progress: 88,
        });
        this.setAgentState('byte', {
          status: AGENT_STATUS.CODING,
          currentTask: 'Auto-repair detected defects',
          lastAction: `Resolving ${issueCount} defect(s) flagged in audit`,
          progress: 90,
        });
        break;
      }

      case 'QA_REPAIR_COMPLETED': {
        this.setAgentState('byte', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: 'Defects repaired and patched into index.html',
          progress: 100,
        });
        break;
      }

      case 'QA_COMPLETED': {
        const result = data.result || 'passed';
        this.setAgentState('query', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: `Audit completed successfully (${result.toUpperCase()})`,
          progress: 100,
        });
        break;
      }

      case 'FEEDBACK_STARTED': {
        const feedback = data.feedback || 'Targeted Change';
        this.emitTerminalLog(null, 'USER', `Feedback received: "${feedback}"`, 'info');
        this.setAgentState('byte', {
          status: AGENT_STATUS.CODING,
          currentTask: `Apply targeted change: "${feedback.slice(0, 40)}"`,
          lastAction: 'Patching index.html preserving existing code',
          progress: 50,
        });
        break;
      }

      case 'FEEDBACK_COMPLETED': {
        const version = data.version || 2;
        this.setAgentState('byte', {
          status: AGENT_STATUS.COMPLETED,
          lastAction: `Targeted change applied successfully (Version ${version})`,
          progress: 100,
        });
        break;
      }

      case 'PIPELINE_COMPLETED': {
        this.emitTerminalLog(null, 'SYSTEM', 'Build sprint completed successfully. Live preview synchronized.', 'success');
        break;
      }

      case 'PIPELINE_FAILED':
      case 'FEEDBACK_FAILED': {
        const errorMsg = data.error || 'Execution failed';
        this.emitTerminalLog(null, 'SYSTEM', `Pipeline halted: ${errorMsg}`, 'error');
        for (const agent of Object.values(this.agents)) {
          if (agent.status === AGENT_STATUS.WORKING || agent.status === AGENT_STATUS.CODING || agent.status === AGENT_STATUS.RUNNING || agent.status === AGENT_STATUS.THINKING) {
            this.setAgentState(agent.id, {
              status: AGENT_STATUS.FAILED,
              lastAction: errorMsg,
            });
          }
        }
        break;
      }
    }
  }

  /**
   * Direct backend agentState event handler.
   */
  handleAgentStateEvent(data) {
    if (!data || !data.agentId) return;
    const clientAgentId = BACKEND_TO_CLIENT_MAP[data.agentId] || data.agentId;
    const agent = this.agents[clientAgentId];
    if (!agent) return;

    const rawState = (data.state || '').toLowerCase();
    let mappedStatus = agent.status;

    if (rawState === 'thinking') mappedStatus = AGENT_STATUS.THINKING;
    else if (rawState === 'working') mappedStatus = AGENT_STATUS.WORKING;
    else if (rawState === 'streaming') mappedStatus = (agent.id === 'byte' ? AGENT_STATUS.CODING : AGENT_STATUS.WORKING);
    else if (rawState === 'completed') mappedStatus = AGENT_STATUS.COMPLETED;
    else if (rawState === 'error') mappedStatus = AGENT_STATUS.FAILED;
    else if (rawState === 'idle') mappedStatus = AGENT_STATUS.IDLE;

    if (mappedStatus !== agent.status) {
      this.setAgentState(clientAgentId, {
        status: mappedStatus,
        lastAction: data.error || (mappedStatus === AGENT_STATUS.STREAMING ? 'Streaming output tokens' : null),
      });
    }
  }
}

export const agentStateManager = new AgentStateManager();
