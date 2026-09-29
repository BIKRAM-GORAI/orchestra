/**
 * Agent Orchestra — Gamified Virtual Office Floor Engine
 * 
 * Renders an animated 2D top-down / 2.5D creative office simulation where
 * logical agents have dedicated cabins and desks. Characters sit, roam, pace,
 * walk to handover tasks, and speak/murmur humorous thoughts in real time.
 */

export const MURMURS = {
  manager: [
    "Decomposing user goal into technical specifications...",
    "Reviewing visual hierarchy and user conversion paths...",
    "Ensuring single-responsibility principle across agents...",
    "Synthesizing requirements... zero div-soup allowed!",
    "Consulting the architectural blueprint on the whiteboard...",
    "Hold on, who borrowed my favorite whiteboard marker?"
  ],
  designer: [
    "What if the primary button had an 18px radius instead of 14px? Life-changing.",
    "Contemplating the subtle emotional resonance of warm amber and sage green...",
    "Adding smooth cubic-bezier transitions to all hover micro-interactions...",
    "Making sure typography hierarchy breathes on mobile viewports...",
    "Balancing negative space with rich botanical card aesthetics..."
  ],
  frontend_architect: [
    "Structuring the semantic DOM with zero layout shifts...",
    "Ensuring single-file CSS custom property design system is rock solid...",
    "Checking flexbox wrapping behavior on 375px mobile viewports...",
    "Writing a resilient zero-dependency vanilla JS state engine...",
    "Hardware-accelerating the keyframe animations with transform: translateZ..."
  ],
  feature_architect: [
    "What happens if user clicks the cart button 42 times rapidly?",
    "Designing reactive shopping cart state with live badge counter...",
    "Adding category filter pills with instant real-time search...",
    "Handling empty filter states with a helpful reset button...",
    "Simulating delivery checkout modal with real-time field validation..."
  ],
  coding_agent: [
    "Drinking espresso... compiling HTML5 markup at 300 WPM...",
    "Crafting clean embedded <style> with CSS custom properties...",
    "Embedding interactive JavaScript state machine with no external deps...",
    "Refactoring cart event listeners to prevent duplicate triggers...",
    "Ensuring absolute minimal-change preservation during edits..."
  ],
  qa: [
    "Scanning DOM tree for unclosed tags and accessibility labels...",
    "Checking responsive media query breakpoints on mobile & tablet...",
    "Testing JavaScript cart handlers and modal transitions...",
    "Verifying all buttons have active cursor pointers and hover effects...",
    "Validating single-file standalone execution with zero errors..."
  ]
};

export class OfficeEngine {
  constructor(canvas, { onMurmur } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onMurmur = onMurmur;

    this.width = canvas.width;
    this.height = canvas.height;

    // Room Layout Coordinates (normalized for scalable canvas)
    this.rooms = {
      managerCabin: { x: 20, y: 20, w: 260, h: 220, name: "Manager's Executive Cabin", color: '#231e18', border: '#e5ad42' },
      devDen: { x: 300, y: 20, w: 280, h: 220, name: "Dev Den (Coding Agent)", color: '#13201a', border: '#10b981' },
      creativeCommons: { x: 20, y: 260, w: 560, h: 220, name: "Creative Commons & QA Testing Lab", color: '#171922', border: '#6366f1' },
    };

    // Agent Avatars
    this.agents = {
      manager: {
        id: 'manager',
        name: 'Manager',
        role: 'Orchestrator',
        emoji: '👑',
        color: '#f59e0b',
        x: 150,
        y: 110,
        homeX: 150,
        homeY: 110,
        targetX: 150,
        targetY: 110,
        state: 'idle', // idle, thinking, walking, working
        facing: 1, // 1 = right, -1 = left
        cabin: 'managerCabin',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      coding_agent: {
        id: 'coding_agent',
        name: 'Coding Agent',
        role: 'Implementation',
        emoji: '💻',
        color: '#10b981',
        x: 440,
        y: 110,
        homeX: 440,
        homeY: 110,
        targetX: 440,
        targetY: 110,
        state: 'idle',
        facing: -1,
        cabin: 'devDen',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      designer: {
        id: 'designer',
        name: 'Designer',
        role: 'UI/UX Visuals',
        emoji: '🎨',
        color: '#ec4899',
        x: 90,
        y: 350,
        homeX: 90,
        homeY: 350,
        targetX: 90,
        targetY: 350,
        state: 'idle',
        facing: 1,
        cabin: 'creativeCommons',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      frontend_architect: {
        id: 'frontend_architect',
        name: 'Frontend Architect',
        role: 'DOM & CSS Tech',
        emoji: '📐',
        color: '#0ea5e9',
        x: 210,
        y: 350,
        homeX: 210,
        homeY: 350,
        targetX: 210,
        targetY: 350,
        state: 'idle',
        facing: 1,
        cabin: 'creativeCommons',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      feature_architect: {
        id: 'feature_architect',
        name: 'Feature Architect',
        role: 'Behaviors',
        emoji: '⚡',
        color: '#8b5cf6',
        x: 330,
        y: 350,
        homeX: 330,
        homeY: 350,
        targetX: 330,
        targetY: 350,
        state: 'idle',
        facing: 1,
        cabin: 'creativeCommons',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      qa: {
        id: 'qa',
        name: 'QA Agent',
        role: 'Verification',
        emoji: '🛡️',
        color: '#3b82f6',
        x: 480,
        y: 350,
        homeX: 480,
        homeY: 350,
        targetX: 480,
        targetY: 350,
        state: 'idle',
        facing: -1,
        cabin: 'creativeCommons',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
    };

    this.furniture = [
      // Manager Cabin Furniture
      { type: 'desk', x: 120, y: 125, w: 70, h: 32, label: 'Executive Desk' },
      { type: 'whiteboard', x: 30, y: 35, w: 90, h: 12, label: 'Strategy Board' },
      { type: 'plant', x: 245, y: 40, r: 12 },

      // Dev Den Furniture
      { type: 'desk', x: 405, y: 125, w: 75, h: 34, label: 'Workstation', dev: true },
      { type: 'server', x: 535, y: 40, w: 30, h: 50 },
      { type: 'coffee', x: 475, y: 130, r: 6 },

      // Creative Commons Furniture
      { type: 'desk', x: 65, y: 370, w: 55, h: 30, label: 'Designer' },
      { type: 'desk', x: 185, y: 370, w: 55, h: 30, label: 'Frontend' },
      { type: 'desk', x: 305, y: 370, w: 55, h: 30, label: 'Features' },
      { type: 'desk', x: 450, y: 370, w: 60, h: 30, label: 'QA Lab' },
      { type: 'watercooler', x: 535, y: 280, w: 24, h: 40 },
    ];

    this.animationFrame = null;
    this.tick = 0;
    this.isRunning = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 600;
    this.height = rect.height || 500;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(dpr, dpr);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      this.update();
      this.draw();
      if (this.isRunning) {
        this.animationFrame = requestAnimationFrame(loop);
      }
    };
    loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  // Update Agent Positions & Behaviors
  update() {
    this.tick++;
    const now = Date.now();

    for (const agent of Object.values(this.agents)) {
      // 1. Moving towards target
      const dx = agent.targetX - agent.x;
      const dy = agent.targetY - agent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        const speed = agent.state === 'walking' ? 2.5 : 1.2;
        agent.x += (dx / dist) * Math.min(speed, dist);
        agent.y += (dy / dist) * Math.min(speed, dist);
        agent.facing = dx >= 0 ? 1 : -1;
      } else {
        // Arrived at target
        if (agent.state === 'walking') {
          agent.state = 'working';
        }
      }

      // 2. Behavior when Thinking: Pacing around room
      if (agent.state === 'thinking') {
        if (this.tick % 90 === 0) {
          const room = this.rooms[agent.cabin];
          if (room) {
            // Pick a random waypoint inside room
            agent.targetX = room.x + 40 + Math.random() * (room.w - 80);
            agent.targetY = room.y + 40 + Math.random() * (room.h - 80);
          }
        }
      }

      // 3. Murmuring generator
      if ((agent.state === 'thinking' || agent.state === 'working') && now - agent.lastMurmurTime > 4500) {
        const list = MURMURS[agent.id] || MURMURS.manager;
        const text = list[Math.floor(Math.random() * list.length)];
        this.showSpeechBubble(agent.id, text, 3500);
        agent.lastMurmurTime = now + Math.random() * 2000;
        if (this.onMurmur) {
          this.onMurmur(agent.id, text);
        }
      }

      // 4. Bubble timer countdown
      if (agent.bubbleTimer > 0) {
        agent.bubbleTimer--;
        if (agent.bubbleTimer <= 0) {
          agent.bubbleText = null;
        }
      }
    }
  }

  showSpeechBubble(agentId, text, durationMs = 3500) {
    const agent = this.agents[agentId];
    if (!agent) return;
    agent.bubbleText = text;
    agent.bubbleTimer = Math.round((durationMs / 1000) * 60);
  }

  // Orchestrator State Transitions
  setAgentState(agentId, state) {
    const agent = this.agents[agentId];
    if (!agent) return;

    agent.state = state.toLowerCase();

    if (agent.state === 'idle') {
      agent.targetX = agent.homeX;
      agent.targetY = agent.homeY;
      agent.bubbleText = null;
    } else if (agent.state === 'thinking') {
      this.showSpeechBubble(agentId, '💭 Thinking...');
    } else if (agent.state === 'working' || agent.state === 'streaming') {
      agent.targetX = agent.homeX;
      agent.targetY = agent.homeY;
    }
  }

  // Task Handover Animations
  triggerHandover(fromAgentId, toAgentId, note = 'Brief handed over') {
    const from = this.agents[fromAgentId];
    const to = this.agents[toAgentId];
    if (!from || !to) return;

    // Walk to the recipient agent
    from.state = 'walking';
    from.targetX = to.x + (from.x < to.x ? -35 : 35);
    from.targetY = to.y;
    this.showSpeechBubble(fromAgentId, `📋 ${note}`, 3000);

    // After arrival, return home
    setTimeout(() => {
      from.targetX = from.homeX;
      from.targetY = from.homeY;
      to.state = 'working';
      this.showSpeechBubble(toAgentId, '⚡ Received! Commencing work.', 2500);
    }, 2200);
  }

  // Handle Pipeline Events
  handlePipelineEvent(event) {
    const stage = event.stage;
    switch (stage) {
      case 'PIPELINE_STARTED':
      case 'MANAGER_PLAN_STARTED':
        this.setAgentState('manager', 'thinking');
        this.showSpeechBubble('manager', '👑 Formulating architecture and selecting agents...', 4000);
        break;

      case 'MANAGER_PLAN_COMPLETED':
        this.setAgentState('manager', 'working');
        // Dispatch specialists
        const specialists = event.plan?.selected_agents || ['designer', 'frontend_architect', 'feature_architect'];
        for (const specId of specialists) {
          const spec = this.agents[specId];
          if (spec) {
            // Walk to manager cabin, get assignment, return home
            spec.state = 'walking';
            spec.targetX = this.agents.manager.x + (Math.random() * 40 - 20);
            spec.targetY = this.agents.manager.y + 40;
            this.showSpeechBubble(specId, '🏃 Visiting Manager for brief...', 2000);

            setTimeout(() => {
              spec.targetX = spec.homeX;
              spec.targetY = spec.homeY;
              spec.state = 'working';
              this.showSpeechBubble(specId, '🎨 Generating technical specification...', 3500);
            }, 2000);
          }
        }
        break;

      case 'SPECIALISTS_STARTED':
        this.setAgentState('designer', 'working');
        this.setAgentState('frontend_architect', 'working');
        this.setAgentState('feature_architect', 'working');
        break;

      case 'SPECIALISTS_COMPLETED':
        this.setAgentState('designer', 'idle');
        this.setAgentState('frontend_architect', 'idle');
        this.setAgentState('feature_architect', 'idle');
        this.setAgentState('manager', 'thinking');
        this.showSpeechBubble('manager', '👑 Synthesizing Unified Implementation Specification...', 4000);
        break;

      case 'MANAGER_SYNTHESIS_COMPLETED':
        // Manager walks to Coding Agent cabin to hand over the unified spec
        this.triggerHandover('manager', 'coding_agent', 'Handing over Unified Implementation Spec');
        break;

      case 'CODING_AGENT_STARTED':
        this.setAgentState('coding_agent', 'working');
        this.showSpeechBubble('coding_agent', '💻 Coding single-file index.html with styles & scripts...', 4500);
        break;

      case 'CODING_AGENT_COMPLETED':
        this.setAgentState('coding_agent', 'idle');
        // Coding Agent walks to QA Lab
        this.triggerHandover('coding_agent', 'qa', 'Delivering index.html for compliance audit');
        break;

      case 'QA_STARTED':
        this.setAgentState('qa', 'working');
        this.showSpeechBubble('qa', '🛡️ Auditing DOM integrity, JS handlers & responsive design...', 4000);
        break;

      case 'QA_COMPLETED':
        this.setAgentState('qa', 'idle');
        const verdict = event.result === 'passed' ? '✨ Passed with zero defects!' : '⚠️ Detected defects for repair.';
        this.showSpeechBubble('qa', verdict, 4000);
        break;

      case 'QA_REPAIR_STARTED':
        this.setAgentState('qa', 'thinking');
        this.triggerHandover('qa', 'coding_agent', 'Handing over QA defects for automated repair');
        break;

      case 'QA_REPAIR_COMPLETED':
        this.setAgentState('coding_agent', 'idle');
        this.setAgentState('qa', 'idle');
        this.showSpeechBubble('coding_agent', '✨ Auto-repair complete! Zero defects.', 4000);
        break;

      case 'PIPELINE_COMPLETED':
        for (const id of Object.keys(this.agents)) {
          this.setAgentState(id, 'idle');
        }
        this.showSpeechBubble('manager', '🎉 Build completed! Live preview ready.', 4000);
        break;
    }
  }

  // Draw Rendering Loop
  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Clear & Background Floor Tile
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, w, h);

    // Floor Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Draw Rooms / Cabins
    for (const room of Object.values(this.rooms)) {
      // Room Floor
      ctx.fillStyle = room.color;
      ctx.beginPath();
      ctx.roundRect(room.x, room.y, room.w, room.h, 12);
      ctx.fill();

      // Glass Wall / Partition Border
      ctx.strokeStyle = room.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Room Title Badge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.beginPath();
      ctx.roundRect(room.x + 10, room.y + 8, room.name.length * 7 + 16, 20, 4);
      ctx.fill();

      ctx.fillStyle = room.border;
      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(room.name, room.x + 18, room.y + 22);
    }

    // 3. Draw Furniture
    for (const item of this.furniture) {
      if (item.type === 'desk') {
        // Desk shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(item.x + 2, item.y + 4, item.w, item.h);

        // Desk surface
        ctx.fillStyle = item.dev ? '#1a221f' : '#232730';
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.w, item.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Monitor / Laptop on desk
        ctx.fillStyle = item.dev ? '#059669' : '#3b82f6';
        ctx.fillRect(item.x + item.w / 2 - 12, item.y + 6, 24, 10);
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(item.x + item.w / 2 - 10, item.y + 8, 20, 6);

        // Code glow on dev desk
        if (item.dev && (this.agents.coding_agent.state === 'working' || this.agents.coding_agent.state === 'streaming')) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
          ctx.beginPath();
          ctx.arc(item.x + item.w / 2, item.y + 10, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.type === 'whiteboard') {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(item.x, item.y, item.w, item.h);

        // Colorful strategy notes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(item.x + 8, item.y + 3, 14, 6);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(item.x + 28, item.y + 3, 20, 6);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(item.x + 54, item.y + 3, 16, 6);
      } else if (item.type === 'plant') {
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(item.x - 3, item.y - 3, item.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'server') {
        ctx.fillStyle = '#181b20';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        // Blinking server lights
        const blink = Math.sin(this.tick * 0.1) > 0;
        ctx.fillStyle = blink ? '#10b981' : '#047857';
        ctx.fillRect(item.x + 6, item.y + 8, 4, 4);
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(item.x + 6, item.y + 16, 4, 4);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(item.x + 6, item.y + 24, 4, 4);
      } else if (item.type === 'watercooler') {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(item.x + 12, item.y + 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(item.x + 6, item.y + 22, 12, 18);
      }
    }

    // 4. Draw Agents
    for (const agent of Object.values(this.agents)) {
      this.drawAgent(agent);
    }

    // 5. Draw Speech / Thought Bubbles on Top
    for (const agent of Object.values(this.agents)) {
      if (agent.bubbleText) {
        this.drawSpeechBubble(agent);
      }
    }
  }

  drawAgent(agent) {
    const ctx = this.ctx;
    const x = agent.x;
    const y = agent.y;

    // Gentle bounce while walking or working
    const bounce = (agent.state === 'walking' || agent.state === 'working') 
      ? Math.sin(this.tick * 0.25) * 3 
      : Math.sin(this.tick * 0.05) * 1;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Active Halo Glow
    if (agent.state === 'working' || agent.state === 'thinking' || agent.state === 'streaming') {
      ctx.fillStyle = agent.color + '33';
      ctx.beginPath();
      ctx.arc(x, y + bounce, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body / Suit (Pill)
    ctx.fillStyle = agent.color;
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 6 + bounce, 20, 20, 8);
    ctx.fill();

    // Head
    ctx.fillStyle = '#fce7d2';
    ctx.beginPath();
    ctx.arc(x, y - 14 + bounce, 10, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (with facing direction)
    const eyeOffset = agent.facing * 3;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + eyeOffset - 3, y - 16 + bounce, 2, 3);
    ctx.fillRect(x + eyeOffset + 2, y - 16 + bounce, 2, 3);

    // Emoji Crown / Tool Indicator
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(agent.emoji, x, y - 24 + bounce);

    // Agent Name Tag below
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(agent.name, x, y + 28);

    // State Badge
    if (agent.state !== 'idle') {
      ctx.fillStyle = agent.state === 'working' ? '#10b981' : (agent.state === 'thinking' ? '#f59e0b' : '#3b82f6');
      ctx.beginPath();
      ctx.roundRect(x - 22, y + 32, 44, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(agent.state.toUpperCase(), x, y + 42);
    }
  }

  drawSpeechBubble(agent) {
    const ctx = this.ctx;
    const text = agent.bubbleText;
    const x = agent.x;
    const y = agent.y - 42;

    ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
    const textWidth = Math.min(ctx.measureText(text).width + 16, 240);
    const bubbleW = Math.max(textWidth, 80);
    const bubbleH = 26;
    const bx = Math.max(10, Math.min(x - bubbleW / 2, this.width - bubbleW - 10));
    const by = Math.max(10, y - bubbleH);

    // Bubble Background (Glassmorphic Dark Slate)
    ctx.fillStyle = '#1e222b';
    ctx.beginPath();
    ctx.roundRect(bx, by, bubbleW, bubbleH, 8);
    ctx.fill();

    // Border with Agent Color Accent
    ctx.strokeStyle = agent.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Speech Tail Pointer
    ctx.fillStyle = '#1e222b';
    ctx.beginPath();
    ctx.moveTo(x - 5, by + bubbleH);
    ctx.lineTo(x + 5, by + bubbleH);
    ctx.lineTo(x, by + bubbleH + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = agent.color;
    ctx.stroke();

    // Bubble Text
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    // Truncate text if needed
    let displayText = text;
    if (displayText.length > 34) {
      displayText = displayText.slice(0, 32) + '...';
    }
    ctx.fillText(displayText, bx + bubbleW / 2, by + 17);
  }
}
