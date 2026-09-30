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

import { agentStateManager, AGENT_STATUS, getStatusDisplayText } from './agent-state.js';

export const AGENT_ROSTER = {
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    core: true,
    role: 'Lead Architect & Manager',
    tag: 'AT',
    color: '#F59E0B',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Manager Suite',
    suitColor: '#1E293B',
    hairColor: '#D97706',
    skinColor: '#FDE047',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['System Architecture', 'Decomposition', 'Synthesis', 'Delegation'],
    home: { x: 110, y: 120, facing: 'up' },
    deskPos: { x: 110, y: 85 }
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    core: true,
    role: 'Frontend Architect',
    tag: 'NV',
    color: '#38BDF8',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Main Workspace',
    suitColor: '#0284C7',
    hairColor: '#0F172A',
    skinColor: '#FAD4C0',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['HTML5 Semantic DOM', 'Vanilla CSS3', 'Mobile Viewports', 'CSS Tokens'],
    home: { x: 80, y: 325, facing: 'up' },
    deskPos: { x: 80, y: 295 }
  },
  byte: {
    id: 'byte',
    name: 'Byte',
    core: true,
    role: 'Backend Architect',
    tag: 'BY',
    color: '#10B981',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Main Workspace',
    suitColor: '#059669',
    hairColor: '#334155',
    skinColor: '#F5C6A5',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Vanilla JavaScript', 'Event Handlers', 'State Machines', 'REST APIs'],
    home: { x: 80, y: 445, facing: 'up' },
    deskPos: { x: 80, y: 415 }
  },
  pixel: {
    id: 'pixel',
    name: 'Pixel',
    core: true,
    role: 'UI/UX Designer',
    tag: 'PX',
    color: '#C084FC',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Main Workspace',
    suitColor: '#7E22CE',
    hairColor: '#F472B6',
    skinColor: '#FEE2E2',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Design Tokens', 'Color Systems', 'Typography Hierarchy', 'Micro-interactions'],
    home: { x: 200, y: 325, facing: 'up' },
    deskPos: { x: 200, y: 295 }
  },
  query: {
    id: 'query',
    name: 'Query',
    core: true,
    role: 'QA & Compliance Inspector',
    tag: 'QR',
    color: '#FB923C',
    model: 'Gemini 3.5 Flash Lite (Google AI)',
    room: 'Main Workspace',
    suitColor: '#C2410C',
    hairColor: '#78350F',
    skinColor: '#F5D0A9',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Static Analysis', 'DOM Auditing', 'Error Trapping', 'Auto-Repair Loop'],
    home: { x: 320, y: 445, facing: 'up' },
    deskPos: { x: 320, y: 415 }
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    core: false,
    role: 'DevOps & Server Engineer',
    tag: 'FG',
    color: '#F43F5E',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Server Room',
    suitColor: '#BE123C',
    hairColor: '#18181B',
    skinColor: '#FAD4C0',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Server Infrastructure', 'Node.js Watchers', 'SSE Streaming'],
    home: { x: 670, y: 145, facing: 'up' },
    deskPos: { x: 670, y: 115 }
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    core: false,
    role: 'Research & Feature Analyst',
    tag: 'SC',
    color: '#2DD4BF',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Main Workspace',
    suitColor: '#0F766E',
    hairColor: '#475569',
    skinColor: '#FDE047',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Feature Benchmarking', 'Conversion Funnels', 'Product Analytics'],
    home: { x: 440, y: 445, facing: 'up' },
    deskPos: { x: 440, y: 415 }
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    core: false,
    role: 'Content & Copy Strategist',
    tag: 'EC',
    color: '#FDE047',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Main Workspace',
    suitColor: '#854D0E',
    hairColor: '#FBBF24',
    skinColor: '#FAD4C0',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Marketing Copy', 'Brand Voice', 'Value Propositions'],
    home: { x: 440, y: 325, facing: 'up' },
    deskPos: { x: 440, y: 295 }
  },
  // Retained Demo Agents (reduced to 1/4th)
  luna: {
    id: 'luna',
    name: 'Luna',
    core: false,
    role: 'Data Pipelines & Storage',
    tag: 'LN',
    color: '#06B6D4',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Main Workspace',
    suitColor: '#0891B2',
    hairColor: '#1E1B4B',
    skinColor: '#FAD4C0',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Schema Validation', 'Data Transformations', 'ETL Pipelines'],
    home: { x: 320, y: 325, facing: 'up' },
    deskPos: { x: 320, y: 295 }
  },
  rex: {
    id: 'rex',
    name: 'Rex',
    core: false,
    role: 'Security & Auth Engineer',
    tag: 'RX',
    color: '#EF4444',
    model: 'Gemini 3.5 Flash (Google AI)',
    room: 'Main Workspace',
    suitColor: '#991B1B',
    hairColor: '#374151',
    skinColor: '#F5C6A5',
    state: 'idle',
    statusText: 'Idle — Waiting for a task',
    task: '',
    progress: 0,
    skills: ['Penetration Testing', 'CSP & CORS', 'Input Sanitization'],
    home: { x: 200, y: 445, facing: 'up' },
    deskPos: { x: 200, y: 415 }
  }
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
        x: 220,
        y: 125,
        w: 6,
        h: 36,
        type: 'vertical',
        openProgress: 0,
        targetOpen: 0
      },
      meeting_south: {
        id: 'meeting_south',
        name: 'Conference Room South Door',
        x: 375,
        y: 184,
        w: 36,
        h: 6,
        type: 'horizontal',
        openProgress: 0,
        targetOpen: 0
      },
      server: {
        id: 'server',
        name: 'Server Room Door',
        x: 635,
        y: 184,
        w: 36,
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

    this.initCanvas();
    this.bindEvents();
    this.start();
  }

  syncAgentFromState(agentState) {
    const agent = this.agents[agentState.id];
    if (!agent) return;

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
      if (agent.waypoints.length === 0 && !agent.isSeated) {
        this.navigateTo(agent, agent.home.x, agent.home.y, {
          onComplete: () => {
            agent.isSeated = true;
            agent.facing = agent.home.facing;
          }
        });
      }
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
    // Manager Suite (x: 20..220, y: 20..190)
    nav.setRect(220, 20, 12, 105, 1);
    nav.setRect(220, 161, 12, 30, 1);
    nav.setRect(20, 184, 212, 12, 1);

    // Meeting Room (x: 236..540, y: 20..190)
    nav.setRect(232, 20, 10, 170, 1);
    nav.setRect(232, 184, 143, 12, 1);
    nav.setRect(411, 184, 135, 12, 1);
    nav.setRect(540, 20, 12, 176, 1);

    // Server Room (x: 556..740, y: 20..190)
    nav.setRect(540, 184, 95, 12, 1);
    nav.setRect(671, 184, 70, 12, 1);

    // Coffee Lounge Left Partition (x: 536, y: 196..520)
    nav.setRect(536, 196, 12, 149, 1);
    nav.setRect(536, 381, 12, 140, 1);

    // 3. Mark Doorways as Transition Tiles (3: WALKABLE!)
    nav.setRect(220, 125, 16, 36, 3); // Manager Door
    nav.setRect(375, 184, 36, 16, 3); // Meeting South Door
    nav.setRect(635, 184, 36, 16, 3); // Server Door
    nav.setRect(536, 345, 16, 36, 3); // Coffee Lounge Door

    // 4. Mark Furniture / Desks as BLOCKED (2)
    // Manager Desk & Credenza
    nav.setRect(75, 55, 90, 40, 2);
    nav.setRect(25, 30, 40, 70, 2); // Bookshelf

    // Meeting Table & Chairs
    nav.setRect(310, 65, 150, 60, 2);

    // Server Racks
    nav.setRect(570, 25, 150, 45, 2);
    nav.setRect(645, 105, 50, 30, 2); // DevOps terminal desk

    // Coffee Counter & Appliances
    nav.setRect(675, 240, 45, 110, 2);
    nav.setRect(600, 375, 35, 35, 2); // Cafe Table 1
    nav.setRect(665, 425, 35, 35, 2); // Cafe Table 2
    nav.setRect(560, 465, 60, 35, 2); // Lounge Sofa

    // Main Workspace Desks (8 spacious workstations for 10-agent studio)
    // Row 1: y: 280..315 (Nova, Pixel, Luna, Echo)
    nav.setRect(60, 280, 50, 32, 2);
    nav.setRect(180, 280, 50, 32, 2);
    nav.setRect(300, 280, 50, 32, 2);
    nav.setRect(420, 280, 50, 32, 2);

    // Row 2: y: 400..435 (Byte, Rex, Query, Scout)
    nav.setRect(60, 400, 50, 32, 2);
    nav.setRect(180, 400, 50, 32, 2);
    nav.setRect(300, 400, 50, 32, 2);
    nav.setRect(420, 400, 50, 32, 2);
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

  // Office Presets
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
      // 12 distinct positions around the conference table (never stacked!)
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
            agent.state = 'meeting';
            agent.bubbleText = 'All-Hands 👥';
            agent.bubbleTimer = 600;
          }
        });
        i++;
      }
    } else if (preset === 'free') {
      for (const agent of Object.values(this.agents)) {
        agent.state = 'idle';
        agent.bubbleText = 'Free roam 🚶';
        agent.bubbleTimer = 300;
        this.pickControlledDestination(agent);
      }
    }
  }

  // Purposeful Autonomous Roaming (75% work at desk, 15% walk, 10% break)
  pickControlledDestination(agent) {
    const destinations = [
      { x: agent.home.x, y: agent.home.y, state: 'working', label: 'Back to desk 💻' },
      { x: 685, y: 280, state: 'coffee', label: 'Espresso ☕' },
      { x: 600, y: 395, state: 'coffee', label: 'Break ☕' },
      { x: 380, y: 95, state: 'meeting', label: 'Sync 👥' },
      { x: 650, y: 145, state: 'working', label: 'Server check 🔧' },
      { x: 236, y: 215, state: 'idle', label: 'Hallway 🚶' }
    ];
    // Heavily bias towards returning to assigned desk
    const choice = (Math.random() < 0.6) ? destinations[0] : destinations[Math.floor(Math.random() * destinations.length)];
    this.navigateTo(agent, choice.x, choice.y, {
      onComplete: () => {
        agent.state = choice.state;
        agent.bubbleText = choice.label;
        agent.bubbleTimer = 400;
        if (choice.state === 'working') {
          agent.isSeated = true;
          agent.facing = agent.home.facing;
        }
      }
    });
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

    // 1. Manager Suite Walls (Cutout for door at y: 125..161)
    drawWall(220, 18, 12, 107);
    drawWall(220, 161, 12, 23);
    drawWall(18, 184, 214, 12);

    // 2. Meeting Room Walls (Cutout for South door at x: 375..411)
    drawWall(232, 18, 10, 172);
    drawWall(232, 184, 143, 12);
    drawWall(411, 184, 135, 12);
    drawWall(540, 18, 12, 172);

    // 3. Server Room South Wall (Cutout for door at x: 635..671)
    drawWall(540, 184, 95, 12);
    drawWall(671, 184, 71, 12);

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

    // 5. Workstation Desks (Main Open-Plan Workspace - 8 spacious workstations)
    const desks = [
      // Row 1 (Nova, Pixel, Luna, Echo)
      { x: 60, y: 295 }, { x: 180, y: 295 }, { x: 300, y: 295 }, { x: 420, y: 295 },
      // Row 2 (Byte, Rex, Query, Scout)
      { x: 60, y: 415 }, { x: 180, y: 415 }, { x: 300, y: 415 }, { x: 420, y: 415 }
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

      // Glowing Code Screen
      const glowColors = ['#38BDF8', '#10B981', '#F59E0B', '#C084FC', '#FB923C'];
      ctx.fillStyle = glowColors[i % glowColors.length];
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

    // Name Tag Badge beneath Agent with Live Status Indicator
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    const textWidth = ctx.measureText(agent.name).width;

    const isWorking = agent.status === AGENT_STATUS.WORKING || agent.status === AGENT_STATUS.CODING || agent.status === AGENT_STATUS.THINKING || agent.status === AGENT_STATUS.RUNNING;
    const isCompleted = agent.status === AGENT_STATUS.COMPLETED;
    const isFailed = agent.status === AGENT_STATUS.FAILED;

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
