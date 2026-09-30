/**
 * AGENT ORCHESTRA — MINIMAL HOMEPAGE CONTROLLER
 * Ultra-clean, lightweight interactions & Lucide icon hydration
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Lucide Icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // 2. Interactive Paperclip Capsules: Click to view Agent Hierarchy
  const capsules = document.querySelectorAll('.capsule');
  capsules.forEach(capsule => {
    capsule.addEventListener('click', () => {
      const target = document.getElementById('orgchart');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 3. Smooth Anchor Scrolling for all navigation links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 4. Subtle Interactivity on Agent Pills
  const agentPills = document.querySelectorAll('.agent-pill');
  agentPills.forEach(pill => {
    pill.addEventListener('mouseenter', () => {
      pill.style.transform = 'translateY(-2px)';
    });
    pill.addEventListener('mouseleave', () => {
      pill.style.transform = 'translateY(0)';
    });
  });
});
