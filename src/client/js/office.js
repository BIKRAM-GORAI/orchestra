/**
 * Agent Orchestra — Virtual Office Atelier Floor Engine
 * 
 * Renders an animated architectural floorplan with dedicated rooms for each
 * logical agent (Manager Suite, Dev Cabin, Design Atelier, Architecture & QA Lab).
 * Features individual desks, roaming pathfinding, task handover walking animations,
 * and floating thought bubbles with humorous murmurs.
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
    "Contemplating the subtle emotional resonance of warm cream and dusty rose...",
    "Adding smooth cubic-bezier transitions to all hover micro-interactions...",
    "Making sure typography hierarchy breathes on mobile viewports...",
    "Balancing negative space with rich editorial card aesthetics..."
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

    this.width = 640;
    this.height = 360;

    // Room Layout Coordinates (Adaptive 2x2 architectural grid)
    this.rooms = {
      managerSuite: {
        id: 'managerSuite',
        name: "Manager's Suite",
        icon: '👑',
        x: 16,
        y: 16,
        w: 290,
        h: 155,
        bg: '#FDFBF7',
        border: '#D4A359',
        tagColor: '#B8860B',
      },
      devCabin: {
        id: 'devCabin',
        name: "Dev Den (Coding Agent)",
        icon: '💻',
        x: 322,
        y: 16,
        w: 302,
        h: 155,
        bg: '#F5F9F6',
        border: '#5B7B6D',
        tagColor: '#2E5A44',
      },
      designStudio: {
        id: 'designStudio',
        name: "Design & UX Atelier",
        icon: '🎨',
        x: 16,
        y: 185,
        w: 290,
        h: 160,
        bg: '#FDF8F9',
        border: '#C86D7C',
        tagColor: '#A84D5C',
      },
      qaArchLab: {
        id: 'qaArchLab',
        name: "Architecture & QA Lab",
        icon: '📐',
        x: 322,
        y: 185,
        w: 302,
        h: 160,
        bg: '#F6F8FB',
        border: '#6B82A8',
        tagColor: '#3B5998',
      },
    };

    // All 6 Dedicated Agents with Home Desks
    this.agents = {
      manager: {
        id: 'manager',
        name: 'Manager',
        role: 'Orchestrator',
        emoji: '👑',
        suitColor: '#D4A359',
        x: 150,
        y: 85,
        homeX: 150,
        homeY: 85,
        targetX: 150,
        targetY: 85,
        state: 'idle',
        facing: 1,
        roomKey: 'managerSuite',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      coding_agent: {
        id: 'coding_agent',
        name: 'Coding Agent',
        role: 'Implementer',
        emoji: '💻',
        suitColor: '#2E5A44',
        x: 470,
        y: 85,
        homeX: 470,
        homeY: 85,
        targetX: 470,
        targetY: 85,
        state: 'idle',
        facing: -1,
        roomKey: 'devCabin',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      designer: {
        id: 'designer',
        name: 'Designer',
        role: 'Visuals & UI',
        emoji: '🎨',
        suitColor: '#C86D7C',
        x: 150,
        y: 260,
        homeX: 150,
        homeY: 260,
        targetX: 150,
        targetY: 260,
        state: 'idle',
        facing: 1,
        roomKey: 'designStudio',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      frontend_architect: {
        id: 'frontend_architect',
        name: 'Frontend Arch',
        role: 'DOM & CSS',
        emoji: '📐',
        suitColor: '#3B7A98',
        x: 390,
        y: 245,
        homeX: 390,
        homeY: 245,
        targetX: 390,
        targetY: 245,
        state: 'idle',
        facing: 1,
        roomKey: 'qaArchLab',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      feature_architect: {
        id: 'feature_architect',
        name: 'Feature Arch',
        role: 'Behaviors',
        emoji: '⚡',
        suitColor: '#7C5295',
        x: 460,
        y: 285,
        homeX: 460,
        homeY: 285,
        targetX: 460,
        targetY: 285,
        state: 'idle',
        facing: 1,
        roomKey: 'qaArchLab',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
      qa: {
        id: 'qa',
        name: 'QA Inspector',
        role: 'Compliance',
        emoji: '🛡️',
        suitColor: '#4A6274',
        x: 545,
        y: 245,
        homeX: 545,
        homeY: 245,
        targetX: 545,
        targetY: 245,
        state: 'idle',
        facing: -1,
        roomKey: 'qaArchLab',
        bubbleText: null,
        bubbleTimer: 0,
        lastMurmurTime: 0,
      },
    };

    // Dedicated Architectural Furniture
    this.furniture = [
      // Manager Suite
      { type: 'desk', x: 120, y: 100, w: 60, h: 26, color: '#E8DFC8' },
      { type: 'whiteboard', x: 32, y: 28, w: 75, h: 10 },
      { type: 'plant', x: 280, y: 35, r: 9 },

      // Dev Den
      { type: 'desk', x: 440, y: 100, w: 62, h: 26, color: '#DCE8DF', isDev: true },
      { type: 'server', x: 585, y: 30, w: 26, h: 40 },
      { type: 'coffee', x: 505, y: 105, r: 5 },

      // Design Studio
      { type: 'desk', x: 120, y: 275, w: 60, h: 26, color: '#F2DFE2' },
      { type: 'easel', x: 45, y: 220, w: 30, h: 35 },
      { type: 'plant', x: 280, y: 320, r: 9 },

      // Architecture & QA Lab
      { type: 'desk', x: 365, y: 260, w: 50, h: 22, color: '#DCE4EE' },
      { type: 'desk', x: 435, y: 300, w: 50, h: 22, color: '#E5DCEE' },
      { type: 'desk', x: 520, y: 260, w: 52, h: 22, color: '#DEE4EA' },
    ];

    this.animationFrame = null;
    this.tick = 0;
    this.isRunning = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.clientWidth = rect.width || 640;
    this.clientHeight = rect.height || 360;

    this.canvas.width = Math.max(1, Math.floor(this.clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.clientHeight * dpr));
    this.canvas.style.width = `${this.clientWidth}px`;
    this.canvas.style.height = `${this.clientHeight}px`;

    this.dpr = dpr;
    this.scaleX = (this.clientWidth || 640) / 640;
    this.scaleY = (this.clientHeight || 360) / 360;
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

  update() {
    this.tick++;
    const now = Date.now();

    for (const agent of Object.values(this.agents)) {
      // 1. Move towards target waypoint
      const dx = agent.targetX - agent.x;
      const dy = agent.targetY - agent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1.5) {
        const speed = agent.state === 'walking' ? 2.2 : 1.1;
        agent.x += (dx / dist) * Math.min(speed, dist);
        agent.y += (dy / dist) * Math.min(speed, dist);
        agent.facing = dx >= 0 ? 1 : -1;
      } else {
        if (agent.state === 'walking') {
          agent.state = 'working';
        }
      }

      // 2. Pacing in dedicated room when thinking
      if (agent.state === 'thinking') {
        if (this.tick % 80 === 0) {
          const room = this.rooms[agent.roomKey];
          if (room) {
            agent.targetX = room.x + 30 + Math.random() * (room.w - 60);
            agent.targetY = room.y + 35 + Math.random() * (room.h - 60);
          }
        }
      }

      // 3. Humorous Murmurs
      if ((agent.state === 'thinking' || agent.state === 'working') && now - agent.lastMurmurTime > 5000) {
        const list = MURMURS[agent.id] || MURMURS.manager;
        const text = list[Math.floor(Math.random() * list.length)];
        this.showSpeechBubble(agent.id, text, 3600);
        agent.lastMurmurTime = now + Math.random() * 2500;
        if (this.onMurmur) {
          this.onMurmur(agent.id, text);
        }
      }

      // 4. Bubble countdown
      if (agent.bubbleTimer > 0) {
        agent.bubbleTimer--;
        if (agent.bubbleTimer <= 0) {
          agent.bubbleText = null;
        }
      }
    }
  }

  showSpeechBubble(agentId, text, durationMs = 3600) {
    const agent = this.agents[agentId];
    if (!agent) return;
    agent.bubbleText = text;
    agent.bubbleTimer = Math.round((durationMs / 1000) * 60);
  }

  setAgentState(agentId, state) {
    const agent = this.agents[agentId];
    if (!agent) return;

    agent.state = state.toLowerCase();

    if (agent.state === 'idle') {
      agent.targetX = agent.homeX;
      agent.targetY = agent.homeY;
      agent.bubbleText = null;
    } else if (agent.state === 'thinking') {
      this.showSpeechBubble(agentId, '💭 Formulating plan...');
    } else if (agent.state === 'working' || agent.state === 'streaming') {
      agent.targetX = agent.homeX;
      agent.targetY = agent.homeY;
    }
  }

  // Task Handover Animations (walking between rooms)
  triggerHandover(fromAgentId, toAgentId, note = 'Brief delivered') {
    const from = this.agents[fromAgentId];
    const to = this.agents[toAgentId];
    if (!from || !to) return;

    from.state = 'walking';
    from.targetX = to.x + (from.x < to.x ? -30 : 30);
    from.targetY = to.y;
    this.showSpeechBubble(fromAgentId, `📋 ${note}`, 3000);

    setTimeout(() => {
      from.targetX = from.homeX;
      from.targetY = from.homeY;
      to.state = 'working';
      this.showSpeechBubble(toAgentId, '✨ Received! Implementing.', 2500);
    }, 2000);
  }

  handlePipelineEvent(event) {
    const stage = event.stage;
    switch (stage) {
      case 'PIPELINE_STARTED':
      case 'MANAGER_PLAN_STARTED':
        this.setAgentState('manager', 'thinking');
        this.showSpeechBubble('manager', '👑 Analyzing requirements and dispatching team...', 4000);
        break;

      case 'MANAGER_PLAN_COMPLETED':
        this.setAgentState('manager', 'working');
        const specialists = event.plan?.selected_agents || ['designer', 'frontend_architect', 'feature_architect'];
        for (const specId of specialists) {
          const spec = this.agents[specId];
          if (spec) {
            spec.state = 'walking';
            spec.targetX = this.agents.manager.x + (Math.random() * 30 - 15);
            spec.targetY = this.agents.manager.y + 35;
            this.showSpeechBubble(specId, '🏃 Walking to Manager suite...', 2000);

            setTimeout(() => {
              spec.targetX = spec.homeX;
              spec.targetY = spec.homeY;
              spec.state = 'working';
              this.showSpeechBubble(specId, '🎨 Authoring technical specs...', 3500);
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
        this.showSpeechBubble('manager', '👑 Synthesizing Unified Specification...', 4000);
        break;

      case 'MANAGER_SYNTHESIS_COMPLETED':
        this.triggerHandover('manager', 'coding_agent', 'Delivering Unified Spec to Dev Den');
        break;

      case 'CODING_AGENT_STARTED':
        this.setAgentState('coding_agent', 'working');
        this.showSpeechBubble('coding_agent', '💻 Assembling standalone index.html...', 4500);
        break;

      case 'CODING_AGENT_COMPLETED':
        this.setAgentState('coding_agent', 'idle');
        this.triggerHandover('coding_agent', 'qa', 'Delivering build for QA compliance audit');
        break;

      case 'QA_STARTED':
        this.setAgentState('qa', 'working');
        this.showSpeechBubble('qa', '🛡️ Auditing DOM, styles, and script handlers...', 4000);
        break;

      case 'QA_COMPLETED':
        this.setAgentState('qa', 'idle');
        const verdict = event.result === 'passed' ? '✨ Passed with zero defects!' : '⚠️ Identified defects for auto-repair.';
        this.showSpeechBubble('qa', verdict, 4000);
        break;

      case 'QA_REPAIR_STARTED':
        this.setAgentState('qa', 'thinking');
        this.triggerHandover('qa', 'coding_agent', 'Returning defects for auto-repair');
        break;

      case 'QA_REPAIR_COMPLETED':
        this.setAgentState('coding_agent', 'idle');
        this.setAgentState('qa', 'idle');
        this.showSpeechBubble('coding_agent', '✨ Auto-repair resolved all defects!', 4000);
        break;

      case 'PIPELINE_COMPLETED':
        for (const id of Object.keys(this.agents)) {
          this.setAgentState(id, 'idle');
        }
        this.showSpeechBubble('manager', '🎉 Build complete! Live preview ready.', 4000);
        break;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const dpr = this.dpr || 1;
    const sx = (this.scaleX || 1) * dpr;
    const sy = (this.scaleY || 1) * dpr;
    ctx.scale(sx, sy);

    const w = 640;
    const h = 360;

    // 1. Warm Editorial Background Floor
    ctx.fillStyle = '#F4EFE6';
    ctx.fillRect(0, 0, w, h);

    // Subtle parquet grid
    ctx.strokeStyle = 'rgba(141, 43, 66, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Draw 4 Dedicated Rooms with Warm Editorial Borders
    for (const room of Object.values(this.rooms)) {
      // Room floor
      ctx.fillStyle = room.bg;
      ctx.beginPath();
      ctx.roundRect(room.x, room.y, room.w, room.h, 10);
      ctx.fill();

      // Soft architectural shadow
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Crisp inner room border
      ctx.strokeStyle = room.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Room Header Badge
      ctx.fillStyle = room.border;
      ctx.beginPath();
      ctx.roundRect(room.x + 8, room.y + 8, 18, 18, 4);
      ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(room.icon, room.x + 17, room.y + 21);

      ctx.fillStyle = room.tagColor;
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(room.name, room.x + 32, room.y + 21);
    }

    // 3. Draw Furniture
    for (const item of this.furniture) {
      if (item.type === 'desk') {
        // Shadow
        ctx.fillStyle = 'rgba(40, 30, 20, 0.08)';
        ctx.fillRect(item.x + 2, item.y + 3, item.w, item.h);

        // Desk
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.w, item.h, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Monitor
        ctx.fillStyle = item.isDev ? '#2E5A44' : '#6B7280';
        ctx.fillRect(item.x + item.w / 2 - 10, item.y + 4, 20, 8);
        ctx.fillStyle = item.isDev ? '#A7F3D0' : '#E5E7EB';
        ctx.fillRect(item.x + item.w / 2 - 8, item.y + 5, 16, 5);

        // Dev Monitor code glow
        if (item.isDev && (this.agents.coding_agent.state === 'working' || this.agents.coding_agent.state === 'streaming')) {
          ctx.fillStyle = 'rgba(46, 90, 68, 0.25)';
          ctx.beginPath();
          ctx.arc(item.x + item.w / 2, item.y + 8, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (item.type === 'whiteboard') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.strokeStyle = '#D4A359';
        ctx.lineWidth = 1;
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        // Colored notes
        ctx.fillStyle = '#C86D7C';
        ctx.fillRect(item.x + 6, item.y + 2, 10, 6);
        ctx.fillStyle = '#5B7B6D';
        ctx.fillRect(item.x + 20, item.y + 2, 14, 6);
      } else if (item.type === 'plant') {
        ctx.fillStyle = '#5B7B6D';
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7A9A8A';
        ctx.beginPath();
        ctx.arc(item.x - 2, item.y - 2, item.r * 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'easel') {
        ctx.fillStyle = '#C86D7C';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(item.x + 3, item.y + 3, item.w - 6, item.h - 6);
        // Color palette strokes on easel
        ctx.fillStyle = '#E07A5F';
        ctx.fillRect(item.x + 6, item.y + 8, 12, 4);
        ctx.fillStyle = '#7A9A8A';
        ctx.fillRect(item.x + 6, item.y + 16, 15, 4);
      } else if (item.type === 'server') {
        ctx.fillStyle = '#2A332C';
        ctx.fillRect(item.x, item.y, item.w, item.h);
        const blink = Math.sin(this.tick * 0.12) > 0;
        ctx.fillStyle = blink ? '#34D399' : '#059669';
        ctx.fillRect(item.x + 5, item.y + 8, 3, 3);
        ctx.fillRect(item.x + 12, item.y + 8, 3, 3);
      }
    }

    // 4. Draw Characters (All 6 Agents)
    for (const agent of Object.values(this.agents)) {
      this.drawAgent(agent);
    }

    // 5. Draw Speech / Thought Bubbles
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

    const bounce = (agent.state === 'walking' || agent.state === 'working')
      ? Math.sin(this.tick * 0.25) * 2.5
      : Math.sin(this.tick * 0.05) * 0.8;

    // Shadow
    ctx.fillStyle = 'rgba(50, 40, 30, 0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Active Halo Glow
    if (agent.state === 'working' || agent.state === 'thinking' || agent.state === 'streaming') {
      ctx.fillStyle = agent.suitColor + '22';
      ctx.beginPath();
      ctx.arc(x, y + bounce, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Suit Body (Rounded Pill)
    ctx.fillStyle = agent.suitColor;
    ctx.beginPath();
    ctx.roundRect(x - 9, y - 5 + bounce, 18, 17, 6);
    ctx.fill();

    // Head
    ctx.fillStyle = '#FDDFC6';
    ctx.beginPath();
    ctx.arc(x, y - 12 + bounce, 9, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeOffset = agent.facing * 2.5;
    ctx.fillStyle = '#2B2B2B';
    ctx.fillRect(x + eyeOffset - 3, y - 14 + bounce, 2, 2.5);
    ctx.fillRect(x + eyeOffset + 1.5, y - 14 + bounce, 2, 2.5);

    // Emoji Crown / Role Tool
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(agent.emoji, x, y - 22 + bounce);

    // Agent Name Pill
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(x - 26, y + 21, 52, 13, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#333A36';
    ctx.font = '600 8.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(agent.name, x, y + 30.5);

    // State Badge
    if (agent.state !== 'idle') {
      ctx.fillStyle = agent.state === 'working' ? '#2E5A44' : (agent.state === 'thinking' ? '#C86D7C' : '#3B7A98');
      ctx.beginPath();
      ctx.roundRect(x - 20, y + 36, 40, 11, 3);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 7px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(agent.state.toUpperCase(), x, y + 44);
    }
  }

  drawSpeechBubble(agent) {
    const ctx = this.ctx;
    const text = agent.bubbleText;
    const x = agent.x;
    const y = agent.y - 36;

    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    const textWidth = Math.min(ctx.measureText(text).width + 16, 210);
    const bubbleW = Math.max(textWidth, 70);
    const bubbleH = 22;
    const bx = Math.max(10, Math.min(x - bubbleW / 2, 640 - bubbleW - 10));
    const by = Math.max(8, y - bubbleH);

    // Clean Porcelain White Speech Bubble
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(bx, by, bubbleW, bubbleH, 6);
    ctx.fill();

    // Border in Agent Signature Accent
    ctx.strokeStyle = agent.suitColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bubble Tail
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x - 4, by + bubbleH);
    ctx.lineTo(x + 4, by + bubbleH);
    ctx.lineTo(x, by + bubbleH + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = agent.suitColor;
    ctx.stroke();

    // Bubble Text
    ctx.fillStyle = '#1E2420';
    ctx.textAlign = 'center';
    let displayText = text;
    if (displayText.length > 32) {
      displayText = displayText.slice(0, 30) + '...';
    }
    ctx.fillText(displayText, bx + bubbleW / 2, by + 14.5);
  }
}
