/**
 * Agent Orchestra — 2.5D Retro Pixel-Art Virtual Office Engine
 * 
 * - Full Grid-based Navigation (20px tiles) with real A* shortest-path algorithm
 * - Non-clipping line-of-sight path smoothing & strict diagonal corner clearance
 * - Natural human walking physics (40-65 px/sec) with smooth acceleration/deceleration
 * - Agent separation steering & local avoidance (zero conga lines or trains)
 * - Real corridor system connecting Manager Suite, Meeting Room, Server Room, Main Workspace, and Coffee Lounge
 * - Animated physical doors with hinges, wood panels, and brass handles that swing open/closed
 * - 18 Autonomous specialized agents with unique pixel-art sprites, hairstyles, attire, and assigned desks
 * - Purposeful destination behaviors (coding at workstations, coffee breaks, all-hands meetings, server inspections)
 * - Rich environmental pixel-art: textured floors, glowing monitors, blinking server racks, whiteboard diagrams, ticking clocks
 * - Smooth camera panning, zooming (0.8x - 1.8x), and click-to-focus on agents
 */

import { agentStateManager, AGENT_STATUS, getStatusDisplayText } from './agent-state.js?v=4';

export const WORKFLOW_STATE = {
  IDLE: 'IDLE',
  GOING_TO_MEETING: 'GOING_TO_MEETING',
  IN_MEETING: 'IN_MEETING',
  RETURNING_TO_DESK: 'RETURNING_TO_DESK',
  WORKING: 'WORKING',
  TASK_COMPLETED: 'TASK_COMPLETED',
  GOING_TO_REVIEW: 'GOING_TO_REVIEW',
  IN_REVIEW: 'IN_REVIEW'
};

export const FREE_ROAM_SPOTS = [
  // Coffee Lounge & Cafe
  { x: 620, y: 395, text: 'Coffee break ☕' },
  { x: 665, y: 445, text: 'Lounge chat 💬' },
  { x: 685, y: 280, text: 'Espresso run ☕' },
  { x: 575, y: 260, text: 'Water break 💧' },
  { x: 580, y: 485, text: 'Taking a breather 🛋️' },
  { x: 685, y: 320, text: 'Chatting by counter ☕' },

  // Server Room ESD Lab
  { x: 600, y: 100, text: 'Inspecting servers 🖥️' },
  { x: 620, y: 130, text: 'Checking telemetry ⚡' },

  // Meeting Room Collaboration
  { x: 380, y: 55, text: 'Reviewing whiteboard 📊' },
  { x: 340, y: 55, text: 'Brainstorming 💡' },
  { x: 380, y: 135, text: 'Syncing notes 📝' },
  { x: 295, y: 95, text: 'Discussing roadmap 📋' },

  // Main Workspace Open Corridors
  { x: 100, y: 220, text: 'Stretching legs 🚶' },
  { x: 280, y: 220, text: 'Walking corridor 🚶' },
  { x: 460, y: 220, text: 'Passing by 👋' },
  { x: 200, y: 310, text: 'Checking in 🤝' },
  { x: 280, y: 380, text: 'Checking office plants 🌿' }
];

export const AGENT_ROSTER = {
  // 1. Executive Manager
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    core: true,
    role: 'Lead Architect & Manager',
    tag: 'AT',
    color: '#F59E0B',
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite (Google AI)',
    room: 'Manager Suite',
    suitColor: '#1E293B',
    hairColor: '#D97706',
    skinColor: '#FDE047',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Intent Understanding', 'Task Decomposition', 'Multi-Agent Synthesis', 'Fallback Routing'],
    home: { x: 110, y: 120, facing: 'up' },
    deskPos: { x: 110, y: 85 }
  },

  // 2. Designers (3 Individual Agents)
  pixel: {
    id: 'pixel',
    name: 'Pixel',
    core: true,
    role: 'Junior Designer (Free Tier)',
    tag: 'PX',
    color: '#C084FC',
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    suitColor: '#7E22CE',
    hairColor: '#F472B6',
    skinColor: '#FEE2E2',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Harmonious Palettes', 'Typography Hierarchy', 'Spacing Grids', 'Responsive Breakpoints'],
    home: { x: 72, y: 270, facing: 'up' },
    deskPos: { x: 72, y: 240 }
  },
  chroma: {
    id: 'chroma',
    name: 'Chroma',
    core: true,
    role: 'UI/UX Designer (Pro Tier)',
    tag: 'CR',
    color: '#A855F7',
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    suitColor: '#581C87',
    hairColor: '#E879F9',
    skinColor: '#FCE7F3',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Design Tokens', 'Micro-interactions', 'Component Aesthetics', 'Interaction States'],
    home: { x: 72, y: 365, facing: 'up' },
    deskPos: { x: 72, y: 335 }
  },
  canvas: {
    id: 'canvas',
    name: 'Canvas',
    core: true,
    role: 'Lead Designer (Max Tier)',
    tag: 'CV',
    color: '#7E22CE',
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    suitColor: '#3B0764',
    hairColor: '#38BDF8',
    skinColor: '#FEF3C7',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Complete Design Systems', 'Visual Rhythm', 'Design-to-Code Fidelity', 'Edge-Case Visuals'],
    home: { x: 72, y: 460, facing: 'up' },
    deskPos: { x: 72, y: 430 }
  },

  // 3. Frontend Architects (3 Individual Agents)
  nova: {
    id: 'nova',
    name: 'Nova',
    core: true,
    role: 'Junior Frontend (Free Tier)',
    tag: 'NV',
    color: '#38BDF8',
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    suitColor: '#0284C7',
    hairColor: '#0F172A',
    skinColor: '#FAD4C0',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Semantic HTML5', 'CSS Variables', 'Flexbox & Grid', 'Single-File Architecture'],
    home: { x: 162, y: 270, facing: 'up' },
    deskPos: { x: 162, y: 240 }
  },
  blueprint: {
    id: 'blueprint',
    name: 'Blueprint',
    core: true,
    role: 'Frontend Architect (Pro Tier)',
    tag: 'BP',
    color: '#0284C7',
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    suitColor: '#0369A1',
    hairColor: '#475569',
    skinColor: '#F5D0A9',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['DOM Hierarchy', 'Client State Architecture', 'Event Delegation', 'Accessibility Semantics'],
    home: { x: 162, y: 365, facing: 'up' },
    deskPos: { x: 162, y: 335 }
  },
  apex: {
    id: 'apex',
    name: 'Apex',
    core: true,
    role: 'Lead Frontend Architect (Max Tier)',
    tag: 'AP',
    color: '#0369A1',
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    suitColor: '#075985',
    hairColor: '#E2E8F0',
    skinColor: '#FDE047',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['State-Driven Architecture', 'Performance Optimization', 'Progressive Enhancement', 'Contract Validation'],
    home: { x: 162, y: 460, facing: 'up' },
    deskPos: { x: 162, y: 430 }
  },

  // 4. Feature Architects (3 Individual Agents)
  scout: {
    id: 'scout',
    name: 'Scout',
    core: true,
    role: 'Feature Analyst (Free Tier)',
    tag: 'SC',
    color: '#2DD4BF',
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    suitColor: '#0F766E',
    hairColor: '#475569',
    skinColor: '#FDE047',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Feature Decomposition', 'User Flow Definition', 'Search & Filtering', 'Form Validation'],
    home: { x: 252, y: 270, facing: 'up' },
    deskPos: { x: 252, y: 240 }
  },
  beacon: {
    id: 'beacon',
    name: 'Beacon',
    core: true,
    role: 'Feature Architect (Pro Tier)',
    tag: 'BC',
    color: '#0D9488',
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    suitColor: '#115E59',
    hairColor: '#D97706',
    skinColor: '#F5C6A5',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['State Machine Design', 'User Journey Mapping', 'Cart & Checkout Flows', 'Empty-State Handling'],
    home: { x: 252, y: 365, facing: 'up' },
    deskPos: { x: 252, y: 335 }
  },
  compass: {
    id: 'compass',
    name: 'Compass',
    core: true,
    role: 'Lead Feature Architect (Max Tier)',
    tag: 'CP',
    color: '#0F766E',
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    suitColor: '#134E4A',
    hairColor: '#1E293B',
    skinColor: '#FEF3C7',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Full Functional Architecture', 'Interaction Contracts', 'Feature Dependency Graphs', 'Edge-Case Matrix'],
    home: { x: 252, y: 460, facing: 'up' },
    deskPos: { x: 252, y: 430 }
  },

  // 5. Coders (3 Individual Agents)
  byte: {
    id: 'byte',
    name: 'Byte',
    core: true,
    role: 'Junior Coder (Free Tier)',
    tag: 'BY',
    color: '#34D399',
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    suitColor: '#059669',
    hairColor: '#334155',
    skinColor: '#F5C6A5',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Single-File index.html', 'Vanilla JavaScript', 'Event Handlers', 'Surgical Code Patching'],
    home: { x: 342, y: 270, facing: 'up' },
    deskPos: { x: 342, y: 240 }
  },
  cipher: {
    id: 'cipher',
    name: 'Cipher',
    core: true,
    role: 'Fullstack Coder (Pro Tier)',
    tag: 'CI',
    color: '#10B981',
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    suitColor: '#047857',
    hairColor: '#1E1E2E',
    skinColor: '#FEE2E2',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Dynamic DOM Manipulation', 'Interactive State', 'Form Validation & Feedback', 'Minimal-Change Preservation'],
    home: { x: 342, y: 365, facing: 'up' },
    deskPos: { x: 342, y: 335 }
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix',
    core: true,
    role: 'Lead Coder (Max Tier)',
    tag: 'MX',
    color: '#059669',
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    suitColor: '#064E3B',
    hairColor: '#10B981',
    skinColor: '#FDE047',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Single-File Synthesis', 'Modern CSS Systems', 'Full Interactive JS', 'Regression-Free Surgery'],
    home: { x: 342, y: 460, facing: 'up' },
    deskPos: { x: 342, y: 430 }
  },

  // 6. QA Auditors (3 Individual Agents)
  query: {
    id: 'query',
    name: 'Query',
    core: true,
    role: 'Junior QA (Free Tier)',
    tag: 'QR',
    color: '#FB923C',
    tier: 'free',
    model: 'Qwen 3.8 27B (Free $0.00)',
    room: 'Main Workspace',
    suitColor: '#C2410C',
    hairColor: '#78350F',
    skinColor: '#F5D0A9',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Static Analysis', 'DOM Structure Inspection', 'JS Error Detection', 'Requirements Verification'],
    home: { x: 432, y: 270, facing: 'up' },
    deskPos: { x: 432, y: 240 }
  },
  audit: {
    id: 'audit',
    name: 'Audit',
    core: true,
    role: 'QA Auditor (Pro Tier)',
    tag: 'AD',
    color: '#F97316',
    tier: 'pro',
    model: 'Kimi K3 (NVIDIA NIM $0.05)',
    room: 'Main Workspace',
    suitColor: '#9A3412',
    hairColor: '#334155',
    skinColor: '#FCE7F3',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['JavaScript Correctness', 'Event-Flow Verification', 'Responsive Layout Audit', 'Defect Severity'],
    home: { x: 432, y: 365, facing: 'up' },
    deskPos: { x: 432, y: 335 }
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    core: true,
    role: 'Lead QA Inspector (Max Tier)',
    tag: 'ST',
    color: '#EA580C',
    tier: 'max',
    model: 'Gemini 3.5 Flash Lite ($0.10)',
    room: 'Main Workspace',
    suitColor: '#7C2D12',
    hairColor: '#0F172A',
    skinColor: '#FEF3C7',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Comprehensive Code Audit', 'DOM Integrity Trapping', 'Functional Tracing', 'Automated Repair Directives'],
    home: { x: 432, y: 460, facing: 'up' },
    deskPos: { x: 432, y: 430 }
  },
};

// ============================================================================
// 1. Navigation Mesh & A* Pathfinding (20px Grid)
// ============================================================================

export class NavGrid {
  constructor(width, height, tileSize = 20) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.cols = Math.ceil(width / tileSize);
    this.rows = Math.ceil(height / tileSize);
    // 0: Walkable, 1: Wall (Blocked), 2: Furniture (Blocked), 3: Door (Walkable transition)
    this.grid = new Uint8Array(this.cols * this.rows);
  }

  idx(c, r) {
    return r * this.cols + c;
  }

  isWalkable(c, r) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
    const v = this.grid[this.idx(c, r)];
    return v === 0 || v === 3;
  }

  setTile(c, r, val) {
    if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
      this.grid[this.idx(c, r)] = val;
    }
  }

  setRect(x, y, w, h, val) {
    const minC = Math.max(0, Math.floor(x / this.tileSize));
    const maxC = Math.min(this.cols - 1, Math.floor((x + w - 1) / this.tileSize));
    const minR = Math.max(0, Math.floor(y / this.tileSize));
    const maxR = Math.min(this.rows - 1, Math.floor((y + h - 1) / this.tileSize));
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        this.setTile(c, r, val);
      }
    }
  }

  toGrid(x, y) {
    return {
      c: Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.tileSize))),
      r: Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.tileSize)))
    };
  }

  toWorld(c, r) {
    return {
      x: c * this.tileSize + this.tileSize / 2,
      y: r * this.tileSize + this.tileSize / 2
    };
  }

  findNearestWalkable(c, r) {
    if (this.isWalkable(c, r)) return { c, r };
    for (let radius = 1; radius <= 7; radius++) {
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.abs(dc) === radius || Math.abs(dr) === radius) {
            const nc = c + dc;
            const nr = r + dr;
            if (this.isWalkable(nc, nr)) {
              return { c: nc, r: nr };
            }
          }
        }
      }
    }
    return { c, r };
  }

  findPath(startWorldX, startWorldY, endWorldX, endWorldY) {
    let start = this.toGrid(startWorldX, startWorldY);
    let end = this.toGrid(endWorldX, endWorldY);

    start = this.findNearestWalkable(start.c, start.r);
    end = this.findNearestWalkable(end.c, end.r);

    if (start.c === end.c && start.r === end.r) {
      return [{ x: endWorldX, y: endWorldY }];
    }

    const startIdx = this.idx(start.c, start.r);
    const endIdx = this.idx(end.c, end.r);

    const openSet = new Set([startIdx]);
    const cameFrom = new Map();

    const gScore = new Float32Array(this.cols * this.rows).fill(Infinity);
    const fScore = new Float32Array(this.cols * this.rows).fill(Infinity);

    gScore[startIdx] = 0;
    fScore[startIdx] = Math.hypot(end.c - start.c, end.r - start.r);

    const DIRS = [
      { dc: 0, dr: -1, cost: 1.0 },
      { dc: 0, dr: 1, cost: 1.0 },
      { dc: -1, dr: 0, cost: 1.0 },
      { dc: 1, dr: 0, cost: 1.0 },
      // Diagonal steps with strict orthogonal clearance so corners are NEVER cut!
      { dc: -1, dr: -1, cost: 1.414, check1: [-1, 0], check2: [0, -1] },
      { dc: 1, dr: -1, cost: 1.414, check1: [1, 0], check2: [0, -1] },
      { dc: -1, dr: 1, cost: 1.414, check1: [-1, 0], check2: [0, 1] },
      { dc: 1, dr: 1, cost: 1.414, check1: [1, 0], check2: [0, 1] }
    ];

    let steps = 0;
    const maxSteps = 1500;

    while (openSet.size > 0 && steps++ < maxSteps) {
      let currentIdx = -1;
      let minF = Infinity;
      for (const idx of openSet) {
        if (fScore[idx] < minF) {
          minF = fScore[idx];
          currentIdx = idx;
        }
      }

      if (currentIdx === endIdx) {
        const path = [];
        let curr = currentIdx;
        while (cameFrom.has(curr)) {
          const c = curr % this.cols;
          const r = Math.floor(curr / this.cols);
          path.unshift(this.toWorld(c, r));
          curr = cameFrom.get(curr);
        }
        if (path.length > 0) {
          path[path.length - 1] = { x: endWorldX, y: endWorldY };
        } else {
          path.push({ x: endWorldX, y: endWorldY });
        }
        return this.smoothPath(path);
      }

      openSet.delete(currentIdx);
      const currC = currentIdx % this.cols;
      const currR = Math.floor(currentIdx / this.cols);

      for (const dir of DIRS) {
        const nc = currC + dir.dc;
        const nr = currR + dir.dr;

        if (!this.isWalkable(nc, nr)) continue;

        if (dir.check1) {
          if (!this.isWalkable(currC + dir.check1[0], currR + dir.check1[1]) ||
              !this.isWalkable(currC + dir.check2[0], currR + dir.check2[1])) {
            continue;
          }
        }

        const neighborIdx = this.idx(nc, nr);
        const tentativeG = gScore[currentIdx] + dir.cost;

        if (tentativeG < gScore[neighborIdx]) {
          cameFrom.set(neighborIdx, currentIdx);
          gScore[neighborIdx] = tentativeG;
          fScore[neighborIdx] = tentativeG + Math.hypot(end.c - nc, end.r - nr);
          openSet.add(neighborIdx);
        }
      }
    }

    return [{ x: endWorldX, y: endWorldY }];
  }

  smoothPath(path) {
    if (path.length <= 2) return path;
    const smoothed = [path[0]];
    let currentIdx = 0;

    while (currentIdx < path.length - 1) {
      let furthest = currentIdx + 1;
      for (let next = path.length - 1; next > currentIdx + 1; next--) {
        if (this.hasLineOfSight(path[currentIdx], path[next])) {
          furthest = next;
          break;
        }
      }
      smoothed.push(path[furthest]);
      currentIdx = furthest;
    }
    return smoothed;
  }

  hasLineOfSight(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.ceil(dist / (this.tileSize / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;
      const g = this.toGrid(x, y);
      if (!this.isWalkable(g.c, g.r)) return false;
    }
    return true;
  }
}

// ============================================================================
// 2. PixiOffice Main Simulation Class
// ============================================================================

export class PixiOffice {
  constructor(containerEl, { onAgentSelect, onLog } = {}) {
    this.container = containerEl;
    this.onAgentSelect = onAgentSelect;
    this.onLog = onLog;

    // Fixed office floor dimensions
    this.worldWidth = 760;
    this.worldHeight = 540;

    this.currentPreset = 'focus';
    this.selectedAgentId = 'nova';
    this.tick = 0;
    this.isRunning = false;

    // Smooth Camera State
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      targetX: 0,
      targetY: 0,
      targetZoom: 1.0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0
    };

    // Navigation Grid Setup
    this.navGrid = new NavGrid(this.worldWidth, this.worldHeight, 20);
    this.buildNavMesh();

    // Physical Animated Doors
    this.doors = {
      manager: {
        id: 'manager',
        name: "Manager's Office Door",
        x: 100,
        y: 184,
        w: 40,
        h: 6,
        type: 'horizontal',
        openProgress: 0,
        targetOpen: 0
      },
      meeting_south: {
        id: 'meeting_south',
        name: 'Conference Room South Door',
        x: 370,
        y: 184,
        w: 40,
        h: 6,
        type: 'horizontal',
        openProgress: 0,
        targetOpen: 0
      },
      server: {
        id: 'server',
        name: 'Server Room Door',
        x: 630,
        y: 184,
        w: 40,
        h: 6,
        type: 'horizontal',
        openProgress: 0,
        targetOpen: 0
      },
      kitchen: {
        id: 'kitchen',
        name: 'Coffee Lounge Door',
        x: 536,
        y: 345,
        w: 6,
        h: 36,
        type: 'vertical',
        openProgress: 0,
        targetOpen: 0
      }
    };

    // Initialize Agents from Central State
    this.agents = {};
    for (const [id, def] of Object.entries(AGENT_ROSTER)) {
      const centralState = agentStateManager.getAgent(id);
      this.agents[id] = {
        ...def,
        status: centralState ? centralState.status : AGENT_STATUS.IDLE,
        workflowState: WORKFLOW_STATE.IDLE,
        currentTask: centralState ? centralState.currentTask : null,
        lastAction: centralState ? centralState.lastAction : null,
        x: def.home.x,
        y: def.home.y,
        waypoints: [],
        currentSpeed: 0,
        facing: def.home.facing,
        isSeated: true,
        walkingFrame: 0,
        bubbleTimer: 0,
        bubbleText: '',
      };
    }

    // Subscribe to Central State Manager as Single Source of Truth
    this.unsubscribeState = agentStateManager.subscribe((agentState) => {
      this.syncAgentFromState(agentState);
    });

    // Bind workflow orchestration methods to instance
    this.sendAgentToDesk = this.sendAgentToDesk.bind(this);
    this.holdOneOnOneReview = this.holdOneOnOneReview.bind(this);
    this.callReviewMeeting = this.callReviewMeeting.bind(this);
    this.callQuorumMeeting = this.callQuorumMeeting.bind(this);
    this.returnAgentsToDesks = this.returnAgentsToDesks.bind(this);
    this.reportToManager = this.reportToManager.bind(this);

    this.initCanvas();
    this.bindEvents();
    this.start();
  }

  syncAgentFromState(agentState) {
    const agent = this.agents[agentState.id];
    if (!agent) return;
    if (agent.inChoreography) return; // Choreography has priority over passive background sync

    agent.status = agentState.status;
    agent.currentTask = agentState.currentTask;
    agent.lastAction = agentState.lastAction;
    agent.progress = agentState.progress;

    if (agentState.status === AGENT_STATUS.COMPLETED) {
      agent.bubbleText = '✓ Task finished!';
      agent.bubbleTimer = 220;
    } else if (
      agentState.status === AGENT_STATUS.WORKING ||
      agentState.status === AGENT_STATUS.CODING ||
      agentState.status === AGENT_STATUS.THINKING ||
      agentState.status === AGENT_STATUS.RUNNING
    ) {
      const actionDesc = agentState.lastAction || (agentState.status === AGENT_STATUS.CODING ? 'coding...' : 'working...');
      agent.bubbleText = actionDesc.length > 28 ? actionDesc.slice(0, 26) + '..' : actionDesc;
      agent.bubbleTimer = 280;

      // Ensure agent is seated at workstation for focused work
      if (agent.waypoints.length === 0 && !agent.isSeated) {
        this.navigateTo(agent, agent.home.x, agent.home.y, {
          onComplete: () => {
            agent.isSeated = true;
            agent.facing = agent.home.facing;
          }
        });
      }
    } else if (agentState.status === AGENT_STATUS.QUEUED) {
      agent.bubbleText = 'Queued — Waiting to start';
      agent.bubbleTimer = 180;
    } else if (agentState.status === AGENT_STATUS.FAILED) {
      agent.bubbleText = '× Failed';
      agent.bubbleTimer = 300;
    } else if (agentState.status === AGENT_STATUS.IDLE) {
      agent.bubbleText = '';
      agent.bubbleTimer = 0;
    }
  }

  handlePipelineEvent(event) {
    agentStateManager.handlePipelineEvent(event);
  }

  buildNavMesh() {
    const nav = this.navGrid;

    // 1. Perimeter Walls (18px border)
    nav.setRect(0, 0, this.worldWidth, 20, 1);
    nav.setRect(0, 0, 20, this.worldHeight, 1);
    nav.setRect(this.worldWidth - 20, 0, 20, this.worldHeight, 1);
    nav.setRect(0, this.worldHeight - 20, this.worldWidth, 20, 1);

    // 2. Interior Walls
    // Manager Suite (x: 20..220, y: 20..184)
    nav.setRect(220, 20, 12, 164, 1);
    nav.setRect(20, 184, 80, 12, 1);
    nav.setRect(140, 184, 80, 12, 1);

    // Meeting Room (x: 232..540, y: 20..184)
    nav.setRect(232, 20, 10, 164, 1);
    nav.setRect(540, 20, 12, 164, 1);
    nav.setRect(232, 184, 138, 12, 1);
    nav.setRect(410, 184, 130, 12, 1);

    // Server Room (x: 552..740, y: 20..184)
    nav.setRect(540, 184, 90, 12, 1);
    nav.setRect(670, 184, 70, 12, 1);

    // Coffee Lounge Left Partition (x: 536, y: 196..520)
    nav.setRect(536, 196, 12, 149, 1);
    nav.setRect(536, 381, 12, 140, 1);

    // 3. Mark Doorways as Transition Tiles (3: WALKABLE!)
    nav.setRect(100, 184, 40, 16, 3); // Manager South Doorway (Walkable!)
    nav.setRect(370, 184, 40, 16, 3); // Meeting South Doorway (Walkable!)
    nav.setRect(630, 184, 40, 16, 3); // Server Doorway
    nav.setRect(536, 345, 16, 36, 3); // Coffee Lounge Doorway

    // 4. Mark Furniture / Desks as BLOCKED (2)
    // Manager Desk (Atlas sits at 110, 120 facing up to desk)
    nav.setRect(80, 55, 60, 32, 2);
    nav.setRect(25, 30, 40, 70, 2); // Bookshelf

    // Meeting Table
    nav.setRect(320, 65, 140, 60, 2);

    // Server Racks
    nav.setRect(570, 25, 150, 45, 2);
    nav.setRect(645, 105, 50, 30, 2); // DevOps terminal desk

    // Coffee Counter & Appliances
    nav.setRect(675, 240, 45, 110, 2);
    nav.setRect(600, 375, 35, 35, 2); // Cafe Table 1
    nav.setRect(665, 425, 35, 35, 2); // Cafe Table 2
    nav.setRect(560, 465, 60, 35, 2); // Lounge Sofa

    // Main Workspace Desks (15 specialized workstations: 5 roles x 3 tiers)
    const deskCols = [50, 140, 230, 320, 410];
    const deskRows = [240, 335, 430];
    for (const r of deskRows) {
      for (const c of deskCols) {
        nav.setRect(c, r, 46, 24, 2);
      }
    }
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pixi-office-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.10)';
    this.canvas.style.cursor = 'default';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.container) return;
    const dpr = window.devicePixelRatio || 1;
    const containerW = this.container.clientWidth || this.worldWidth;
    const containerH = this.container.clientHeight || this.worldHeight;

    // Calculate best scale to fill 60% container cleanly without distortion
    const availW = Math.max(containerW - 16, 400);
    const availH = Math.max(containerH - 16, 300);
    const scale = Math.min(availW / this.worldWidth, availH / this.worldHeight);
    const finalScale = scale > 0 ? scale : 1.0;

    const displayW = Math.floor(this.worldWidth * finalScale);
    const displayH = Math.floor(this.worldHeight * finalScale);

    this.canvas.width = Math.floor(displayW * dpr);
    this.canvas.height = Math.floor(displayH * dpr);
    this.canvas.style.width = `${displayW}px`;
    this.canvas.style.height = `${displayH}px`;
    this.dpr = dpr;
    this.displayScale = finalScale;
  }

  bindEvents() {
    // 1. Click to select agent (fixed coordinate mapping, non-zoomable)
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clickScreenX = e.clientX - rect.left;
      const clickScreenY = e.clientY - rect.top;

      const scale = this.displayScale || 1.0;
      const worldX = clickScreenX / scale;
      const worldY = clickScreenY / scale;

      for (const [id, agent] of Object.entries(this.agents)) {
        const dist = Math.hypot(worldX - agent.x, worldY - (agent.y - 14));
        if (dist < 26) {
          this.selectAgent(id);
          break;
        }
      }
    });

    // 2. Mouse Move (Hover effect on agents only)
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      const scale = this.displayScale || 1.0;
      const worldX = mouseScreenX / scale;
      const worldY = mouseScreenY / scale;

      let isHoveringAgent = false;
      for (const agent of Object.values(this.agents)) {
        if (Math.hypot(worldX - agent.x, worldY - (agent.y - 14)) < 24) {
          isHoveringAgent = true;
          break;
        }
      }
      this.canvas.style.cursor = isHoveringAgent ? 'pointer' : 'default';
    });
  }

  clampCamera() {
    // Camera is fixed
  }

  zoomIn() {}
  zoomOut() {}
  resetCamera() {}

  focusOnAgent(agentId) {
    const agent = this.agents[agentId];
    if (!agent) return;
    agent.bubbleTimer = 240;
    agent.bubbleText = `${agent.name} (${agent.tag})`;
  }

  selectAgent(agentId) {
    this.selectedAgentId = agentId;
    const agent = this.agents[agentId];
    if (agent && this.onAgentSelect) {
      this.onAgentSelect(agentId, agent);
    }
  }

  // ============================================================================
  // 3. High-Fidelity A* Pathfinding Dispatcher
  // ============================================================================
  navigateTo(agent, targetX, targetY, options = {}) {
    const rawPath = this.navGrid.findPath(agent.x, agent.y, targetX, targetY);
    agent.waypoints = rawPath;
    agent.currentSpeed = 0;
    agent.isSeated = false;
    if (options.onComplete) {
      agent.onNavigationComplete = options.onComplete;
    }
  }

  // Boss Briefing Workflow
  triggerManagerDelegation(agentId, taskTitle = 'Review sprint specs') {
    const agent = this.agents[agentId];
    const boss = this.agents.atlas;
    if (!agent || !boss) return;

    boss.bubbleText = `Summoned @${agent.name} 📋`;
    boss.bubbleTimer = 350;

    agent.bubbleText = 'Heading to Boss office 🚶';
    agent.bubbleTimer = 350;

    // Agent navigates to visitor spot in Boss Office (x: 145, y: 120)
    this.navigateTo(agent, 145, 120, {
      onComplete: () => {
        agent.facing = 'left';
        boss.bubbleText = `Brief: ${taskTitle.slice(0, 18)} 📋`;
        boss.bubbleTimer = 320;
        agent.bubbleText = 'On it! Starting run 🚀';
        agent.bubbleTimer = 260;

        setTimeout(() => {
          this.navigateTo(agent, agent.home.x, agent.home.y, {
            onComplete: () => {
              agent.isSeated = true;
              agent.facing = agent.home.facing;
              agent.state = 'working';
              agent.bubbleText = 'coding...';
              agent.bubbleTimer = 500;
              if (this.onLog) {
                this.onLog(`[DELEGATION] ${agent.name} completed task briefing and returned to workstation.`, 'success');
              }
            }
          });
        }, 1800);
      }
    });
  }

  // ============================================================================
  // Choreographed Workflow: Quorum Meetings, Gated Desk Work, Review Protocols
  // ============================================================================
  navigateToAsync(agent, targetX, targetY) {
    return new Promise((resolve) => {
      if (Math.hypot(agent.x - targetX, agent.y - targetY) < 6) {
        agent.x = targetX;
        agent.y = targetY;
        agent.waypoints = [];
        agent.currentSpeed = 0;
        resolve();
        return;
      }
      this.navigateTo(agent, targetX, targetY, {
        onComplete: () => {
          agent.x = targetX;
          agent.y = targetY;
          agent.currentSpeed = 0;
          resolve();
        }
      });
    });
  }

  callQuorumMeeting(agentIds, topic = 'Sprint Directives') {
    // Specific, designated chairs around the Conference Table
    const meetingSeats = {
      atlas: { x: 390, y: 45, facing: 'down' },  // Head of Table (North)
      pixel: { x: 350, y: 45, facing: 'down' },  // North Left
      nova: { x: 430, y: 45, facing: 'down' },   // North Right
      scout: { x: 350, y: 140, facing: 'up' },   // South Left
      byte: { x: 390, y: 140, facing: 'up' },    // South Center
      query: { x: 430, y: 140, facing: 'up' },   // South Right
      chroma: { x: 310, y: 55, facing: 'down' },
      blueprint: { x: 450, y: 55, facing: 'down' },
      beacon: { x: 310, y: 135, facing: 'up' },
      cipher: { x: 450, y: 135, facing: 'up' }
    };

    const fallbackSeats = [
      { x: 300, y: 95, facing: 'right' },
      { x: 480, y: 95, facing: 'left' }
    ];

    let fallbackIdx = 0;
    const promises = [];

    agentIds.forEach(id => {
      const agent = this.agents[id];
      if (!agent) return;

      agent.workflowState = WORKFLOW_STATE.GOING_TO_MEETING;
      agent.inChoreography = true;
      agent.isSeated = false;
      agent.bubbleText = 'To Meeting Room 👥';
      agent.bubbleTimer = 260;

      const seat = meetingSeats[id] || fallbackSeats[fallbackIdx++ % fallbackSeats.length];

      promises.push(
        this.navigateToAsync(agent, seat.x, seat.y).then(() => {
          // Strictly mark IN_MEETING only upon physical arrival at chair
          agent.workflowState = WORKFLOW_STATE.IN_MEETING;
          agent.x = seat.x;
          agent.y = seat.y;
          agent.facing = seat.facing;
          agent.isSeated = true;
          agent.bubbleText = id === 'atlas' ? 'Quorum Assembled 📋' : 'Present ✋';
          agent.bubbleTimer = 300;
        })
      );
    });

    return Promise.all(promises);
  }

  returnAgentsToDesks(agentIds, onIndividualArrival = null) {
    const promises = [];

    agentIds.forEach(id => {
      const agent = this.agents[id];
      if (!agent) return;

      agent.workflowState = WORKFLOW_STATE.RETURNING_TO_DESK;
      agent.isSeated = false;
      agent.bubbleText = 'Returning to desk 🚶';
      agent.bubbleTimer = 240;

      promises.push(
        this.navigateToAsync(agent, agent.home.x, agent.home.y).then(() => {
          // STRICT RULE: Only when agent physically reaches their desk do they start working!
          agent.workflowState = WORKFLOW_STATE.WORKING;
          agent.x = agent.home.x;
          agent.y = agent.home.y;
          agent.isSeated = true;
          agent.facing = agent.home.facing;
          agent.bubbleText = id === 'byte' ? 'Coding at desk 💻' : (id === 'atlas' ? 'Directing sprint 👑' : 'Working at desk ⚙️');
          agent.bubbleTimer = 350;

          if (onIndividualArrival) {
            onIndividualArrival(id);
          }
        })
      );
    });

    return Promise.all(promises);
  }

  callReviewMeeting(reviewerId = 'query', workerId = 'byte', topic = 'Code Review') {
    const reviewer = this.agents[reviewerId];
    const worker = this.agents[workerId];
    if (!reviewer || !worker) return Promise.resolve();

    reviewer.workflowState = WORKFLOW_STATE.GOING_TO_REVIEW;
    worker.workflowState = WORKFLOW_STATE.GOING_TO_REVIEW;
    reviewer.inChoreography = true;
    worker.inChoreography = true;
    reviewer.isSeated = false;
    worker.isSeated = false;

    reviewer.bubbleText = 'To Review Meeting 🔍';
    reviewer.bubbleTimer = 260;
    worker.bubbleText = 'Bringing Code 📋';
    worker.bubbleTimer = 260;

    // Reviewer sits at West Chair (facing right), Worker sits at East Chair (facing left)
    const seatReviewer = { x: 295, y: 95, facing: 'right' };
    const seatWorker = { x: 475, y: 95, facing: 'left' };

    return Promise.all([
      this.navigateToAsync(reviewer, seatReviewer.x, seatReviewer.y).then(() => {
        reviewer.workflowState = WORKFLOW_STATE.IN_REVIEW;
        reviewer.x = seatReviewer.x;
        reviewer.y = seatReviewer.y;
        reviewer.facing = seatReviewer.facing;
        reviewer.isSeated = true;
      }),
      this.navigateToAsync(worker, seatWorker.x, seatWorker.y).then(() => {
        worker.workflowState = WORKFLOW_STATE.IN_REVIEW;
        worker.x = seatWorker.x;
        worker.y = seatWorker.y;
        worker.facing = seatWorker.facing;
        worker.isSeated = true;
      })
    ]);
  }

  reportToManager(reviewerId = 'query', reportTopic = 'Audit Report') {
    const reviewer = this.agents[reviewerId];
    const boss = this.agents.atlas;
    if (!reviewer) return Promise.resolve();

    reviewer.workflowState = WORKFLOW_STATE.GOING_TO_MEETING;
    reviewer.isSeated = false;
    reviewer.bubbleText = 'Reporting to Boss 🚶';
    reviewer.bubbleTimer = 260;

    // In front of Atlas desk at (110, 115), Atlas is at (110, 85)
    return this.navigateToAsync(reviewer, 110, 115).then(() => {
      reviewer.workflowState = WORKFLOW_STATE.IN_MEETING;
      reviewer.x = 110;
      reviewer.y = 115;
      reviewer.facing = 'up';
      reviewer.isSeated = false;
      if (boss) {
        boss.facing = 'down';
      }
    });
  }

  sendAgentToDesk(agentId, label = '') {
    const agent = this.agents[agentId];
    if (!agent) return Promise.resolve();
    agent.workflowState = WORKFLOW_STATE.RETURNING_TO_DESK;
    agent.isSeated = false;
    agent.bubbleText = 'Returning to desk 🚶';
    agent.bubbleTimer = 220;

    return this.navigateToAsync(agent, agent.home.x, agent.home.y).then(() => {
      // Deterministically switch to WORKING state only upon physical desk arrival
      agent.workflowState = WORKFLOW_STATE.WORKING;
      agent.x = agent.home.x;
      agent.y = agent.home.y;
      agent.isSeated = true;
      agent.facing = agent.home.facing;
      agent.bubbleText = label || (agentId === 'byte' ? 'Coding at desk 💻' : 'Working at desk ⚙️');
      agent.bubbleTimer = 350;
    });
  }

  holdOneOnOneReview(reviewerId = 'query', workerId = 'byte', topic = 'Code Review') {
    return this.callReviewMeeting(reviewerId, workerId, topic);
  }

  showSpeechBubble(agentId, text, durationFrames = 260) {
    const agent = this.agents[agentId];
    if (agent) {
      agent.bubbleText = text;
      agent.bubbleTimer = durationFrames;
    }
  }

  releaseChoreographyLocks(agentIds = null) {
    const ids = agentIds || Object.keys(this.agents);
    ids.forEach(id => {
      if (this.agents[id]) {
        this.agents[id].inChoreography = false;
      }
    });
  }

  // Office Presets (Deterministic, zero random wandering)
  setPreset(preset) {
    this.currentPreset = preset;

    if (preset === 'coffee') {
      const cafeSpots = [
        { x: 600, y: 395 }, { x: 620, y: 395 }, { x: 640, y: 395 },
        { x: 665, y: 445 }, { x: 685, y: 445 }, { x: 705, y: 445 },
        { x: 685, y: 280 }, { x: 685, y: 320 }, { x: 575, y: 485 },
        { x: 610, y: 485 }, { x: 580, y: 260 }, { x: 630, y: 485 }
      ];
      let i = 0;
      for (const agent of Object.values(this.agents)) {
        const spot = cafeSpots[i % cafeSpots.length];
        this.navigateTo(agent, spot.x, spot.y, {
          onComplete: () => {
            agent.state = 'coffee';
            agent.bubbleText = 'Coffee break ☕';
            agent.bubbleTimer = 600;
          }
        });
        i++;
      }
    } else if (preset === 'focus') {
      for (const agent of Object.values(this.agents)) {
        agent.workflowState = WORKFLOW_STATE.WORKING;
        this.navigateTo(agent, agent.home.x, agent.home.y, {
          onComplete: () => {
            agent.isSeated = true;
            agent.facing = agent.home.facing;
            agent.state = 'working';
            agent.bubbleText = (agent.id === 'atlas') ? 'planning...' : 'coding...';
            agent.bubbleTimer = 400;
          }
        });
      }
    } else if (preset === 'meeting') {
      const meetingSeats = [
        { x: 380, y: 55 }, { x: 340, y: 55 }, { x: 420, y: 55 },
        { x: 340, y: 135 }, { x: 380, y: 135 }, { x: 420, y: 135 },
        { x: 295, y: 95 }, { x: 475, y: 95 }, { x: 310, y: 55 },
        { x: 450, y: 55 }, { x: 310, y: 135 }, { x: 450, y: 135 }
      ];
      let i = 0;
      for (const agent of Object.values(this.agents)) {
        const seat = meetingSeats[i % meetingSeats.length];
        this.navigateTo(agent, seat.x, seat.y, {
          onComplete: () => {
            agent.workflowState = WORKFLOW_STATE.IN_MEETING;
            agent.state = 'meeting';
            agent.bubbleText = 'All-Hands 👥';
            agent.bubbleTimer = 600;
          }
        });
        i++;
      }
    } else if (preset === 'free') {
      // Free Roam Mode: Release choreography locks and allow agents to explore the office
      for (const agent of Object.values(this.agents)) {
        agent.inChoreography = false;
        agent.isSeated = false;
        agent.workflowState = WORKFLOW_STATE.IDLE;
        agent.freeRoamCooldown = 10 + Math.floor(Math.random() * 50); // Stagger initial movement
      }
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      this.update();
      this.draw();
      if (this.isRunning) {
        requestAnimationFrame(loop);
      }
    };
    loop();
  }

  stop() {
    this.isRunning = false;
  }

  // ============================================================================
  // 4. Update Loop: Physics, Door Proximity, Local Avoidance
  // ============================================================================
  update() {
    this.tick++;

    // 1. Smooth Camera Damping
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.12;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.12;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12;

    // 2. Physical Animated Doors (Open when agent is near, close when clear)
    for (const door of Object.values(this.doors)) {
      let isAgentNear = false;
      const doorCenterX = door.x + door.w / 2;
      const doorCenterY = door.y + door.h / 2;

      for (const agent of Object.values(this.agents)) {
        if (Math.hypot(agent.x - doorCenterX, agent.y - doorCenterY) < 38) {
          isAgentNear = true;
          break;
        }
      }
      door.targetOpen = isAgentNear ? 1 : 0;
      door.openProgress += (door.targetOpen - door.openProgress) * 0.16;
    }

    // 3. Update Agents Movement & Avoidance
    for (const agent of Object.values(this.agents)) {
      if (agent.waypoints.length > 0) {
        const nextWp = agent.waypoints[0];
        const dx = nextWp.x - agent.x;
        const dy = nextWp.y - agent.y;
        const dist = Math.hypot(dx, dy);

        // Human walking speed: ~50-65 px/sec -> maxSpeed: 1.05 px/frame at 60fps
        const maxSpeed = 1.05;
        const accel = 0.06;
        const decelDist = 24;

        // Calculate remaining distance across all waypoints
        let totalDist = dist;
        for (let i = 1; i < agent.waypoints.length; i++) {
          const p1 = agent.waypoints[i - 1];
          const p2 = agent.waypoints[i];
          totalDist += Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }

        // Smooth ease-in & ease-out
        if (totalDist < decelDist) {
          const targetSpeed = Math.max(0.35, (totalDist / decelDist) * maxSpeed);
          agent.currentSpeed = Math.max(targetSpeed, (agent.currentSpeed || 0) - 0.05);
        } else {
          agent.currentSpeed = Math.min(maxSpeed, (agent.currentSpeed || 0) + accel);
        }

        // Local avoidance force to avoid stacking/chains
        let avoidX = 0;
        let avoidY = 0;
        for (const other of Object.values(this.agents)) {
          if (other.id === agent.id) continue;
          const d = Math.hypot(agent.x - other.x, agent.y - other.y);
          if (d > 0 && d < 18) {
            const repulse = ((18 - d) / 18) * 0.35;
            avoidX += ((agent.x - other.x) / d) * repulse;
            avoidY += ((agent.y - other.y) / d) * repulse;
          }
        }

        if (dist > agent.currentSpeed) {
          const dirX = (dx / dist);
          const dirY = (dy / dist);
          agent.x += dirX * agent.currentSpeed + avoidX;
          agent.y += dirY * agent.currentSpeed + avoidY;

          // Natural 4-frame walk cadence
          agent.walkingFrame = Math.floor(this.tick / 7) % 4;
          agent.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          agent.isSeated = false;
        } else {
          agent.x = nextWp.x;
          agent.y = nextWp.y;
          agent.waypoints.shift();

          if (agent.waypoints.length === 0) {
            agent.currentSpeed = 0;
            agent.walkingFrame = 0;
            if (agent.onNavigationComplete) {
              const cb = agent.onNavigationComplete;
              agent.onNavigationComplete = null;
              cb();
            }
          }
        }
      } else {
        agent.walkingFrame = 0;
        agent.currentSpeed = 0;

        // Station alignment: firmly align at workstation ONLY when returning to desk or working at desk in focus mode
        if (
          agent.workflowState === WORKFLOW_STATE.RETURNING_TO_DESK ||
          (agent.workflowState === WORKFLOW_STATE.WORKING && this.currentPreset === 'focus')
        ) {
          if (Math.hypot(agent.x - agent.home.x, agent.y - agent.home.y) < 22) {
            agent.x = agent.home.x;
            agent.y = agent.home.y;
            agent.isSeated = true;
            agent.facing = agent.home.facing;
          }
        }

        // Autonomous Free Roam in Free Roam Preset
        if (this.currentPreset === 'free' && !agent.inChoreography) {
          agent.freeRoamCooldown = (agent.freeRoamCooldown || 0) - 1;
          if (agent.freeRoamCooldown <= 0) {
            const spot = FREE_ROAM_SPOTS[Math.floor(Math.random() * FREE_ROAM_SPOTS.length)];
            agent.isSeated = false;
            this.navigateTo(agent, spot.x, spot.y, {
              onComplete: () => {
                agent.bubbleText = spot.text;
                agent.bubbleTimer = 240;
              }
            });
            // Stay at visited spot for 6 to 12 seconds before strolling to next spot
            agent.freeRoamCooldown = 360 + Math.floor(Math.random() * 360);
          }
        }
      }

      if (agent.bubbleTimer > 0) {
        agent.bubbleTimer--;
      }
    }
  }

  // ============================================================================
  // 5. Drawing Loop (Depth-Sorted with Visual Atmosphere)
  // ============================================================================
  draw() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const totalScale = (this.displayScale || 1.0) * dpr;

    ctx.setTransform(totalScale, 0, 0, totalScale, 0, 0);
    ctx.clearRect(0, 0, this.worldWidth, this.worldHeight);

    // 1. Draw Textured Architectural Floors
    this.drawFloors(ctx);

    // 2. Draw 2.5D Architectural Walls with Coping & Shadows
    this.drawWalls(ctx);

    // 3. Draw Environmental Decor (Windows, Whiteboards, Clocks, TV)
    this.drawDecorations(ctx);

    // 4. Draw Animated Physical Doors (Swing open & closed)
    this.drawDoors(ctx);

    // 5. Draw Furniture (Desks, Server Racks, Conference Table, Kitchen)
    this.drawFurniture(ctx);

    // 6. Draw Agents (Depth-sorted by Y position for proper 2.5D layering)
    const sortedAgents = Object.values(this.agents).sort((a, b) => a.y - b.y);
    for (const agent of sortedAgents) {
      this.drawAgent(ctx, agent);
    }

    // 7. Draw Speech & Status Bubbles (only when active bubble text exists)
    for (const agent of sortedAgents) {
      if (agent.bubbleTimer > 0 && agent.bubbleText && agent.bubbleText.trim().length > 0) {
        this.drawSpeechBubble(ctx, agent);
      }
    }
  }

  // ============================================================================
  // 6. Architectural Room Floors
  // ============================================================================
  drawFloors(ctx) {
    // A. Main Workspace: Warm light oak wood planks
    ctx.fillStyle = '#E8E5DD';
    ctx.fillRect(18, 18, this.worldWidth - 36, this.worldHeight - 36);

    ctx.strokeStyle = '#D8D4C7';
    ctx.lineWidth = 1;
    for (let x = 18; x < this.worldWidth - 18; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, this.worldHeight - 18);
      ctx.stroke();
    }

    // B. Manager Suite: Executive Mahogany Herringbone Parquet
    ctx.fillStyle = '#C89360';
    ctx.fillRect(20, 20, 200, 164);
    ctx.strokeStyle = '#A87140';
    ctx.lineWidth = 1;
    for (let x = 20; x <= 220; x += 16) {
      for (let y = 20; y <= 184; y += 16) {
        ctx.strokeRect(x, y, 16, 16);
      }
    }

    // C. Meeting Room: Executive Slate Blue Carpet
    ctx.fillStyle = '#334155';
    ctx.fillRect(242, 20, 298, 164);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    for (let x = 242; x <= 540; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, 184);
      ctx.stroke();
    }

    // D. Server Room: Tech Gray Antistatic ESD Tiles
    ctx.fillStyle = '#1E222A';
    ctx.fillRect(552, 20, 188, 164);
    ctx.strokeStyle = '#282F3B';
    ctx.lineWidth = 1;
    for (let x = 552; x <= 740; x += 20) {
      for (let y = 20; y <= 184; y += 20) {
        ctx.strokeRect(x, y, 20, 20);
      }
    }
    // Subtle glowing cyan floor data lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.moveTo(560, 100);
    ctx.lineTo(730, 100);
    ctx.moveTo(640, 20);
    ctx.lineTo(640, 184);
    ctx.stroke();

    // E. Coffee Lounge: Checkered Terrazzo Ceramic Tiles
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(548, 200, 192, 320);
    ctx.fillStyle = '#E2E8F0';
    for (let x = 548; x < 740; x += 24) {
      for (let y = 200; y < 520; y += 24) {
        if ((Math.floor((x - 548) / 24) + Math.floor((y - 200) / 24)) % 2 === 0) {
          ctx.fillRect(x, y, 24, 24);
        }
      }
    }
  }

  // ============================================================================
  // 7. Architectural 2.5D Walls
  // ============================================================================
  drawWalls(ctx) {
    const drawWall = (x, y, w, h) => {
      // 3D Ground Shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
      ctx.fillRect(x + 2, y + h, w, 5);

      // Light Wall Face
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y + 5, w, h - 5);

      // Dark Wall Coping / Top Trim
      ctx.fillStyle = '#334155';
      ctx.fillRect(x, y, w, 5);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(x, y, w, 1.5);
    };

    // Outer Perimeter
    drawWall(0, 0, this.worldWidth, 18);
    drawWall(0, 0, 18, this.worldHeight);
    drawWall(this.worldWidth - 18, 0, 18, this.worldHeight);
    drawWall(0, this.worldHeight - 18, this.worldWidth, 18);

    // 1. Manager Suite Walls (Cutout for South door at x: 100..140)
    drawWall(220, 18, 12, 166);
    drawWall(18, 184, 82, 12);
    drawWall(140, 184, 82, 12);

    // 2. Meeting Room Walls (Cutout for South door at x: 370..410)
    drawWall(232, 18, 10, 166);
    drawWall(232, 184, 138, 12);
    drawWall(410, 184, 130, 12);
    drawWall(540, 18, 12, 166);

    // 3. Server Room South Wall (Cutout for door at x: 630..670)
    drawWall(540, 184, 90, 12);
    drawWall(670, 184, 71, 12);

    // 4. Coffee Lounge West Wall (Cutout for door at y: 345..381)
    drawWall(536, 196, 12, 149);
    drawWall(536, 381, 12, 139);
  }

  // ============================================================================
  // 8. Environmental Decorations
  // ============================================================================
  drawDecorations(ctx) {
    // A. Manager Suite Skyline Window (x: 80, y: 1)
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(75, 4, 70, 14);
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(90, 8, 12, 10);
    ctx.fillRect(115, 6, 16, 12);

    // B. Meeting Room Presentation Display (Animated live pixel bar chart!)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(360, 2, 70, 15);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(365, 8, 8, (this.tick % 40 > 20) ? 7 : 5);
    ctx.fillStyle = '#10B981';
    ctx.fillRect(377, 6, 8, (this.tick % 60 > 30) ? 9 : 7);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(389, 9, 8, 6);
    ctx.fillStyle = '#C084FC';
    ctx.fillRect(401, 5, 8, 10);

    // C. Whiteboard in Meeting Room (x: 460, y: 2)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(460, 3, 50, 14);
    ctx.strokeStyle = '#94A3B8';
    ctx.strokeRect(460, 3, 50, 14);
    // Sticky Notes
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(465, 6, 6, 6);
    ctx.fillStyle = '#F472B6';
    ctx.fillRect(475, 6, 6, 6);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(485, 6, 6, 6);

    // D. Wall Clocks (Ticking hand!)
    const drawClock = (cx, cy) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      const angle = (this.tick / 60) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 5, cy + Math.sin(angle) * 5);
      ctx.strokeStyle = '#EF4444';
      ctx.stroke();
    };

    drawClock(200, 10); // Manager suite
    drawClock(300, 10); // Conference room
    drawClock(700, 208); // Coffee lounge
  }

  // ============================================================================
  // 9. Animated Physical Doors
  // ============================================================================
  drawDoors(ctx) {
    for (const door of Object.values(this.doors)) {
      const open = door.openProgress;

      ctx.save();
      if (door.type === 'vertical') {
        ctx.translate(door.x + 3, door.y);
        ctx.rotate(-open * (Math.PI / 2.2));

        // Wood Door Leaf
        ctx.fillStyle = '#B45309';
        ctx.fillRect(-2, 0, 5, door.h);
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1;
        ctx.strokeRect(-2, 0, 5, door.h);

        // Brass Handle
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(0, door.h / 2 - 2, 4, 4);
      } else {
        ctx.translate(door.x, door.y + 3);
        ctx.rotate(open * (Math.PI / 2.2));

        ctx.fillStyle = '#B45309';
        ctx.fillRect(0, -2, door.w, 5);
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, -2, door.w, 5);

        ctx.fillStyle = '#FDE047';
        ctx.fillRect(door.w / 2 - 2, 0, 4, 4);
      }
      ctx.restore();
    }
  }

  // ============================================================================
  // 10. Furniture & Equipment Rendering
  // ============================================================================
  drawFurniture(ctx) {
    // 1. Manager Suite Furniture
    // Mahogany Executive Desk (x: 75, y: 70)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(75, 105, 90, 8); // Shadow
    ctx.fillStyle = '#78350F';
    ctx.fillRect(75, 75, 90, 32);
    ctx.fillStyle = '#92400E';
    ctx.fillRect(77, 77, 86, 28);

    // Dual Monitors on Manager Desk
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(90, 68, 22, 14);
    ctx.fillRect(118, 68, 22, 14);
    // Glowing code screens
    ctx.fillStyle = (this.tick % 30 > 15) ? '#38BDF8' : '#0284C7';
    ctx.fillRect(92, 70, 18, 10);
    ctx.fillStyle = (this.tick % 40 > 20) ? '#10B981' : '#059669';
    ctx.fillRect(120, 70, 18, 10);

    // Manager Bookshelf (x: 25, y: 35)
    ctx.fillStyle = '#78350F';
    ctx.fillRect(25, 35, 35, 60);
    ctx.fillStyle = '#F59E0B'; ctx.fillRect(28, 42, 6, 12);
    ctx.fillStyle = '#38BDF8'; ctx.fillRect(36, 42, 5, 12);
    ctx.fillStyle = '#EF4444'; ctx.fillRect(43, 42, 7, 12);
    ctx.fillStyle = '#10B981'; ctx.fillRect(28, 64, 8, 12);

    // 2. Meeting Room Conference Table (x: 320..460, y: 75..125)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(318, 128, 148, 8); // Shadow
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(320, 75, 144, 52);
    ctx.fillStyle = '#334155';
    ctx.fillRect(324, 79, 136, 44);
    // Center Glass/Speaker Inlay
    ctx.fillStyle = '#475569';
    ctx.fillRect(370, 95, 44, 12);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(388, 99, 8, 4);

    // 8 Conference Chairs around Table
    const chairs = [
      { x: 340, y: 64 }, { x: 380, y: 64 }, { x: 420, y: 64 },
      { x: 340, y: 130 }, { x: 380, y: 130 }, { x: 420, y: 130 },
      { x: 308, y: 96 }, { x: 468, y: 96 }
    ];
    for (const c of chairs) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(c.x - 6, c.y - 6, 12, 12);
      ctx.fillStyle = '#475569';
      ctx.fillRect(c.x - 4, c.y - 4, 8, 8);
    }

    // 3. Server Room Server Racks (3 Racks with Blinking Status LEDs)
    const racks = [
      { x: 575, y: 28 }, { x: 625, y: 28 }, { x: 675, y: 28 }
    ];
    for (const r of racks) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(r.x, r.y, 40, 56);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, 40, 56);

      // Server Units
      for (let s = 0; s < 4; s++) {
        const sy = r.y + 4 + s * 12;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(r.x + 3, sy, 34, 9);

        // Blinking LEDs
        const isBlink1 = ((this.tick + s * 10) % 20 > 8);
        const isBlink2 = ((this.tick + s * 15) % 25 > 10);
        ctx.fillStyle = isBlink1 ? '#10B981' : '#047857';
        ctx.fillRect(r.x + 6, sy + 3, 3, 3);
        ctx.fillStyle = isBlink2 ? '#38BDF8' : '#0369A1';
        ctx.fillRect(r.x + 12, sy + 3, 3, 3);
        ctx.fillStyle = (this.tick % 40 === 0) ? '#EF4444' : '#7F1D1D';
        ctx.fillRect(r.x + 18, sy + 3, 3, 3);
      }
    }

    // Server Terminal Desk (Forge)
    ctx.fillStyle = '#334155';
    ctx.fillRect(650, 115, 45, 24);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(662, 107, 18, 12);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(664, 109, 14, 8);

    // 4. Coffee Lounge Amenities
    // Kitchen Counter & Sink
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(685, 240, 35, 110);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(688, 243, 29, 104);

    // Espresso Machine (with steam indicator)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(690, 270, 16, 18);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(692, 280, 5, 5); // Mug
    if (this.tick % 40 < 20) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(694, 265 - (this.tick % 6), 2, 3);
    }

    // Water Dispenser
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(560, 245, 16, 32);
    // Translucent Blue Water Bottle
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(562, 230, 12, 16);

    // Cafe Tables
    const cafeTables = [{ x: 615, y: 395 }, { x: 680, y: 445 }];
    for (const t of cafeTables) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.arc(t.x, t.y + 4, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(t.x, t.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();
    }

    // Lounge Sofa
    ctx.fillStyle = '#475569';
    ctx.fillRect(560, 465, 60, 30);
    ctx.fillStyle = '#334155';
    ctx.fillRect(563, 468, 54, 14);

    // 5. Workstation Desks (Main Open-Plan Workspace - 15 specialized workstations)
    const desks = [
      // Row 1 (Tier 1 Free): Pixel, Nova, Scout, Byte, Query
      { x: 50, y: 240, glow: '#C084FC', label: 'Pixel' },
      { x: 140, y: 240, glow: '#38BDF8', label: 'Nova' },
      { x: 230, y: 240, glow: '#2DD4BF', label: 'Scout' },
      { x: 320, y: 240, glow: '#34D399', label: 'Byte' },
      { x: 410, y: 240, glow: '#FB923C', label: 'Query' },

      // Row 2 (Tier 2 Pro): Chroma, Blueprint, Beacon, Cipher, Audit
      { x: 50, y: 335, glow: '#A855F7', label: 'Chroma' },
      { x: 140, y: 335, glow: '#0284C7', label: 'Blueprint' },
      { x: 230, y: 335, glow: '#0D9488', label: 'Beacon' },
      { x: 320, y: 335, glow: '#10B981', label: 'Cipher' },
      { x: 410, y: 335, glow: '#F97316', label: 'Audit' },

      // Row 3 (Tier 3 Max): Canvas, Apex, Compass, Matrix, Sentinel
      { x: 50, y: 430, glow: '#7E22CE', label: 'Canvas' },
      { x: 140, y: 430, glow: '#0369A1', label: 'Apex' },
      { x: 230, y: 430, glow: '#0F766E', label: 'Compass' },
      { x: 320, y: 430, glow: '#059669', label: 'Matrix' },
      { x: 410, y: 430, glow: '#EA580C', label: 'Sentinel' }
    ];

    for (let i = 0; i < desks.length; i++) {
      const d = desks[i];
      // Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(d.x, d.y + 24, 46, 5);

      // Desk Surface
      ctx.fillStyle = '#D6D3D1';
      ctx.fillRect(d.x, d.y, 46, 24);
      ctx.fillStyle = '#E7E5E4';
      ctx.fillRect(d.x + 2, d.y + 2, 42, 20);

      // Computer Monitor
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(d.x + 14, d.y - 7, 18, 12);
      ctx.fillRect(d.x + 21, d.y + 5, 4, 3); // Stand

      // Glowing Code Screen with role/tier theme color
      ctx.fillStyle = d.glow || '#38BDF8';
      ctx.fillRect(d.x + 16, d.y - 5, 14, 8);

      // Keyboard & Mouse
      ctx.fillStyle = '#475569';
      ctx.fillRect(d.x + 15, d.y + 11, 14, 5);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(d.x + 32, d.y + 12, 3, 4);

      // Office Chair
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(d.x + 16, d.y + 22, 14, 10);
    }

    // Potted Office Plants
    const plants = [
      { x: 205, y: 35 }, { x: 250, y: 35 }, { x: 520, y: 35 },
      { x: 550, y: 505 }, { x: 25, y: 505 }
    ];
    for (const p of plants) {
      // Pot
      ctx.fillStyle = '#78350F';
      ctx.fillRect(p.x, p.y + 8, 14, 12);
      // Leaves
      ctx.fillStyle = '#15803D';
      ctx.beginPath();
      ctx.arc(p.x + 7, p.y + 6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.arc(p.x + 5, p.y + 4, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ============================================================================
  // 11. Pixel-Art Agent Character Rendering
  // ============================================================================
  drawAgent(ctx, agent) {
    const x = Math.round(agent.x);
    const y = Math.round(agent.y);
    const isSelected = agent.id === this.selectedAgentId;

    // Ground Shadow beneath Agent
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Selection Ring Indicator
    if (isSelected) {
      ctx.strokeStyle = agent.color || '#2563EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 14, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Walking stride bob offset
    const bob = (agent.waypoints.length > 0) ? (agent.walkingFrame % 2 === 0 ? 0 : -1.5) : 0;
    const legOffset = (agent.waypoints.length > 0) ? (agent.walkingFrame === 1 ? 2 : (agent.walkingFrame === 3 ? -2 : 0)) : 0;

    // Feet / Shoes
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x - 5 + legOffset, y - 2, 4, 3);
    ctx.fillRect(x + 1 - legOffset, y - 2, 4, 3);

    // Legs / Pants
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 5, y - 8 + bob, 4, 7);
    ctx.fillRect(x + 1, y - 8 + bob, 4, 7);

    // Torso / Suit Attire
    ctx.fillStyle = agent.suitColor || '#0284C7';
    ctx.fillRect(x - 6, y - 18 + bob, 12, 11);

    // Collar / Tie / Accent
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - 2, y - 18 + bob, 4, 4);
    ctx.fillStyle = agent.color || '#F59E0B';
    ctx.fillRect(x - 1, y - 14 + bob, 2, 5);

    // Head / Skin Face
    ctx.fillStyle = agent.skinColor || '#FAD4C0';
    ctx.fillRect(x - 5, y - 26 + bob, 10, 9);

    // Eyes (based on facing)
    ctx.fillStyle = '#0F172A';
    if (agent.facing === 'up') {
      // Back of head, no eyes visible
    } else if (agent.facing === 'left') {
      ctx.fillRect(x - 4, y - 23 + bob, 2, 2);
    } else if (agent.facing === 'right') {
      ctx.fillRect(x + 2, y - 23 + bob, 2, 2);
    } else {
      // Facing Down
      ctx.fillRect(x - 3, y - 23 + bob, 2, 2);
      ctx.fillRect(x + 1, y - 23 + bob, 2, 2);
    }

    // Hair Style & Color
    ctx.fillStyle = agent.hairColor || '#0F172A';
    ctx.fillRect(x - 6, y - 29 + bob, 12, 5);
    ctx.fillRect(x - 6, y - 26 + bob, 2, 4);
    ctx.fillRect(x + 4, y - 26 + bob, 2, 4);

    const isWorking = agent.status === AGENT_STATUS.WORKING || agent.status === AGENT_STATUS.CODING || agent.status === AGENT_STATUS.THINKING || agent.status === AGENT_STATUS.RUNNING;
    const isCompleted = agent.status === AGENT_STATUS.COMPLETED;
    const isFailed = agent.status === AGENT_STATUS.FAILED;

    // State-based Desk Typing / Seated Meeting Animations
    if (agent.isSeated && (agent.workflowState === WORKFLOW_STATE.WORKING || isWorking)) {
      // Seated at desk actively typing on keyboard (alternating tap cadence)
      const typeAlt = (Math.floor(this.tick / 6) % 2 === 0);
      ctx.fillStyle = agent.skinColor || '#FAD4C0';
      if (agent.facing === 'up') {
        ctx.fillRect(x - 5, y - 20 - (typeAlt ? 1 : 0), 3, 2);
        ctx.fillRect(x + 2, y - 20 - (typeAlt ? 0 : 1), 3, 2);
      } else {
        ctx.fillRect(x - 5, y - 13 - (typeAlt ? 1 : 0), 2, 2);
        ctx.fillRect(x + 3, y - 13 - (typeAlt ? 0 : 1), 2, 2);
      }
    } else if (agent.isSeated && (agent.workflowState === WORKFLOW_STATE.IN_MEETING || agent.workflowState === WORKFLOW_STATE.IN_REVIEW)) {
      // Seated attentively at conference table
      ctx.fillStyle = agent.skinColor || '#FAD4C0';
      if (agent.facing === 'down') {
        ctx.fillRect(x - 4, y - 11, 2, 2);
        ctx.fillRect(x + 2, y - 11, 2, 2);
      } else if (agent.facing === 'up') {
        ctx.fillRect(x - 4, y - 18, 2, 2);
        ctx.fillRect(x + 2, y - 18, 2, 2);
      } else {
        ctx.fillRect(x - 2, y - 14, 2, 2);
      }
    }

    // Name Tag Badge beneath Agent with Live Status Indicator
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const textWidth = ctx.measureText(agent.name).width;

    const badgeWidth = textWidth + 18;
    const badgeX = Math.round(x - badgeWidth / 2);
    const badgeY = y + 4;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(badgeX, badgeY, badgeWidth, 12);
    ctx.strokeStyle = isSelected ? (agent.color || '#38BDF8') : (isWorking ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.12)');
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.strokeRect(badgeX, badgeY, badgeWidth, 12);

    // Live Activity Indicator (Dot/Symbol)
    const dotX = badgeX + 6;
    const dotY = badgeY + 6;
    if (isWorking) {
      const pulse = 0.5 + Math.sin(this.tick * 0.14) * 0.5;
      ctx.fillStyle = agent.color || '#10B981';
      ctx.globalAlpha = 0.4 + pulse * 0.6;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    } else if (isCompleted) {
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText('✓', dotX, dotY + 2.5);
    } else if (isFailed) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText('×', dotX, dotY + 2.5);
    } else {
      // Idle
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = isSelected ? '#38BDF8' : '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(agent.name, dotX + 5, y + 13);
  }

  // ============================================================================
  // 12. Speech & Status Bubbles
  // ============================================================================
  drawSpeechBubble(ctx, agent) {
    const text = agent.bubbleText || 'working';
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    const textWidth = ctx.measureText(text).width;
    const bubbleWidth = textWidth + 12;
    const bubbleHeight = 16;
    const bx = Math.round(agent.x - bubbleWidth / 2);
    const by = Math.round(agent.y - 48);

    // Bubble Background with drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(bx + 1, by + 1, bubbleWidth, bubbleHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(bx, by, bubbleWidth, bubbleHeight);
    ctx.strokeStyle = agent.color || '#0284C7';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bubbleWidth, bubbleHeight);

    // Downward Pointer
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(agent.x - 3, by + bubbleHeight);
    ctx.lineTo(agent.x + 3, by + bubbleHeight);
    ctx.lineTo(agent.x, by + bubbleHeight + 4);
    ctx.fill();

    // Text
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.fillText(text, agent.x, by + 11);
  }
}
