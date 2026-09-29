import assert from 'node:assert';
import test from 'node:test';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import { AgentRegistry } from '../agents/agentRegistry.js';
import { createProject, saveProjectHtml, getProject, getProjectHtml } from '../services/projectService.js';

test('Phase 7: Human Feedback Loop with Minimal Change Preservation', async () => {
  const registry = new AgentRegistry();
  const orchestrator = new Orchestrator(registry);

  const project = await createProject({
    name: 'Feedback Test Project',
    prompt: 'Build sports site with blue theme',
  });

  const originalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sports Gear</title>
  <style>
    :root { --primary: #3b82f6; --bg: #0b0d14; }
    body { background: var(--bg); color: #fff; }
    .hero-btn { background: var(--primary); padding: 10px 20px; }
  </style>
</head>
<body>
  <nav id="navbar"><a href="#">Home</a></nav>
  <header id="hero">
    <h1>Premier Sports</h1>
    <button class="hero-btn" id="shopNow">Shop Now</button>
  </header>
  <div id="cart-container"></div>
  <script>
    console.log('Cart logic active');
  </script>
</body>
</html>`;

  await saveProjectHtml(project.id, originalHtml, 'Initial v1 build');

  const modifiedHtml = originalHtml.replace(
    ':root { --primary: #3b82f6; --bg: #0b0d14; }',
    ':root { --primary: #10b981; --bg: #0b0d14; }'
  );

  const mockGateway = {
    async generate({ messages }) {
      const msgStr = JSON.stringify(messages);
      assert.ok(msgStr.includes('MINIMAL CHANGE PRESERVATION RULE'), 'Instruction contains Minimal Change rule');
      assert.ok(msgStr.includes('Change primary color to emerald green'), 'Feedback request passed to model');
      assert.ok(msgStr.includes('Premier Sports'), 'Existing HTML provided as source of truth');

      return {
        text: JSON.stringify({
          agent: 'coding_agent',
          status: 'completed',
          file: {
            path: 'index.html',
            content: modifiedHtml,
          },
          summary: {
            changes: ['Updated --primary color from #3b82f6 to #10b981'],
            preserved: ['Navbar', 'Hero button', 'Cart logic', 'Layout'],
          },
        }),
        reasoningText: 'Identified --primary color variable and replaced it while preserving all DOM and script',
        model: 'moonshotai/kimi-k3',
        durationMs: 15,
        attempts: 1,
      };
    },
  };

  const feedbackEvents = [];
  orchestrator.on('pipeline', (ev) => feedbackEvents.push(ev.stage));

  const result = await orchestrator.applyFeedback({
    projectId: project.id,
    feedback: 'Change primary color to emerald green',
    gateway: mockGateway,
  });

  assert.strictEqual(result.htmlContent, modifiedHtml);
  assert.ok(feedbackEvents.includes('FEEDBACK_STARTED'));
  assert.ok(feedbackEvents.includes('FEEDBACK_COMPLETED'));

  // Verify persistence and version increment in isolated project
  const savedHtml = await getProjectHtml(project.id);
  assert.strictEqual(savedHtml, modifiedHtml);
  assert.ok(savedHtml.includes('--primary: #10b981;'), 'Primary color updated');
  assert.ok(savedHtml.includes('Premier Sports'), 'Hero heading strictly preserved');
  assert.ok(savedHtml.includes('Cart logic active'), 'Script strictly preserved');

  const updatedProject = await getProject(project.id);
  assert.strictEqual(updatedProject.version, 3, 'Version incremented after feedback');
  assert.ok(updatedProject.history.length >= 2, 'History recorded modification note');
});
