/**
 * AGENT ORCHESTRA — HOMEPAGE INTERACTIVE ENGINE
 * Powered by Lucide & Motion.dev
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Lucide Icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // 2. Agent Dossier Data for Interactive Org Hierarchy
  const agentDossiers = {
    atlas: {
      name: 'Atlas',
      role: 'Manager & Lead Orchestrator',
      model: 'Gemini 2.5 Flash / Claude 3.5 Sonnet',
      room: 'Conference Room & Boss Suite',
      focus: 'High-level task decomposition, quorum meeting convocator, executive QA audit validation & sign-off.',
      toolset: 'Orchestrator Protocol, Quorum Summoner, Task Allocator, Stage Gate Signer',
      color: '#3b82f6'
    },
    byte: {
      name: 'Byte',
      role: 'Lead Full-Stack Architect',
      model: 'Claude 3.5 Sonnet / Qwen 2.5 Coder',
      room: 'Workstation Desk #1',
      focus: 'System architecture, asynchronous event loops, WebGL / canvas integration, and high-concurrency algorithms.',
      toolset: 'Monaco Live Engine, AST Bundler, State Machine Core, Node Runtime',
      color: '#10b981'
    },
    query: {
      name: 'Query',
      role: 'Senior QA & Security Auditor',
      model: 'Kimi K3 / DeepSeek-V3',
      room: 'Workstation Desk #2',
      focus: 'Automated syntax & semantic static analysis, responsive layout verification, and mandatory 1-on-1 code review sessions.',
      toolset: 'AST Validator, DOM Inspector, Memory Leak Tracer, Audit Signer',
      color: '#ec4899'
    },
    nova: {
      name: 'Nova',
      role: 'Frontend & Interaction Specialist',
      model: 'Qwen 2.5 72B / GPT-4o',
      room: 'Workstation Desk #3',
      focus: 'Claymorphic & glassmorphic UI components, dynamic micro-animations, theme tokens, and 60fps responsive interactions.',
      toolset: 'CSS Micro-Engine, Component Library, Motion Integrator, Color Harmony',
      color: '#a855f7'
    },
    scout: {
      name: 'Scout',
      role: 'Feature & Research Engineer',
      model: 'DeepSeek-V3 / Gemini Flash',
      room: 'Workstation Desk #4',
      focus: 'Technical feasibility research, external library evaluation, dependency validation, and edge-case regression tests.',
      toolset: 'Web Context Crawler, NPM Dependency Auditor, Sandbox Probe',
      color: '#06b6d4'
    },
    pixel: {
      name: 'Pixel',
      role: 'Creative & Asset Designer',
      model: 'Flux / SVG Vector Generator',
      room: 'Workstation Desk #5',
      focus: 'Design tokens, layout visual weight, harmonious typography, vector icon synthesis, and theme aesthetics.',
      toolset: 'Vector SVG Engine, Palette Matrix, Typography Scaler, Asset Cache',
      color: '#f59e0b'
    }
  };

  // 3. Interactive Org Node Selection
  const orgNodes = document.querySelectorAll('.org-node');
  const dossierName = document.getElementById('dossierName');
  const dossierRole = document.getElementById('dossierRole');
  const dossierModel = document.getElementById('dossierModel');
  const dossierRoom = document.getElementById('dossierRoom');
  const dossierFocus = document.getElementById('dossierFocus');
  const dossierToolset = document.getElementById('dossierToolset');

  orgNodes.forEach(node => {
    node.addEventListener('click', () => {
      const agentKey = node.getAttribute('data-agent');
      const data = agentDossiers[agentKey];
      if (!data) return;

      orgNodes.forEach(n => n.classList.remove('node-active'));
      node.classList.add('node-active');

      if (dossierName) dossierName.textContent = data.name;
      if (dossierRole) dossierRole.textContent = data.role;
      if (dossierModel) dossierModel.textContent = data.model;
      if (dossierRoom) dossierRoom.textContent = data.room;
      if (dossierFocus) dossierFocus.textContent = data.focus;
      if (dossierToolset) dossierToolset.textContent = data.toolset;
    });
  });

  // 4. Interactive Spectrum Bars Hover
  const spectrumBars = document.querySelectorAll('.spectrum-pill-bar');
  spectrumBars.forEach(bar => {
    bar.addEventListener('click', () => {
      const agentKey = bar.getAttribute('data-agent')?.toLowerCase();
      const matchingNode = document.querySelector(`.org-node[data-agent="${agentKey}"]`);
      if (matchingNode) {
        matchingNode.click();
        matchingNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  // 5. Interactive Goal Alignment Tree Clicks
  const goalCards = document.querySelectorAll('.goal-card');
  goalCards.forEach(card => {
    card.addEventListener('click', () => {
      goalCards.forEach(c => c.classList.remove('active-step'));
      card.classList.add('active-step');
    });
  });

  // 6. Interactive Model Tier Selector
  const tierButtons = document.querySelectorAll('.tier-tab-btn');
  const tierDesc = document.getElementById('tierDesc');
  const tierCost = document.getElementById('tierCost');
  const tierLatency = document.getElementById('tierLatency');

  const tierInfo = {
    free: {
      desc: 'Free Tier defaults to open-source heavyweights (Qwen 2.5 72B & DeepSeek-V3). Ideal for rapid experimentation with zero API bill shock.',
      cost: '$0.00 / hr',
      latency: '~280ms'
    },
    pro: {
      desc: 'Pro Tier dynamically routes architectural blueprints to Kimi K3 & Gemini 2.5 Flash. Balanced high-throughput with 200k context.',
      cost: '$0.12 / hr',
      latency: '~140ms'
    },
    max: {
      desc: 'Max Tier unlocks Claude 3.5 Sonnet & GPT-4o for complex mathematical logic, zero-shot AST refactoring, and senior architectural audits.',
      cost: '$0.45 / hr',
      latency: '~190ms'
    }
  };

  tierButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = btn.getAttribute('data-tier');
      tierButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (tierInfo[tier]) {
        if (tierDesc) tierDesc.textContent = tierInfo[tier].desc;
        if (tierCost) tierCost.textContent = tierInfo[tier].cost;
        if (tierLatency) tierLatency.textContent = tierInfo[tier].latency;
      }
    });
  });

  // 7. Motion.dev Entrance Animations (if available)
  if (window.Motion && typeof window.Motion.animate === 'function') {
    try {
      window.Motion.animate('.hero-pill-badge', { opacity: [0, 1], y: [12, 0] }, { duration: 0.6 });
      window.Motion.animate('.hero-title', { opacity: [0, 1], y: [20, 0] }, { duration: 0.8, delay: 0.1 });
      window.Motion.animate('.hero-subtitle', { opacity: [0, 1], y: [20, 0] }, { duration: 0.8, delay: 0.2 });
      window.Motion.animate('.hero-actions', { opacity: [0, 1], y: [20, 0] }, { duration: 0.8, delay: 0.3 });
      window.Motion.animate('.hero-art-container', { opacity: [0, 1], scale: [0.96, 1] }, { duration: 0.9, delay: 0.4 });
    } catch (e) {
      console.warn('Motion animation note:', e);
    }
  }
});
