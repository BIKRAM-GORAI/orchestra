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

  // 5. Scroll-Driven Scaling Video Showcase Frame (Freeze when small -> expand & play to max size)
  const videoFrame = document.getElementById('zoom-video-frame');
  const showcaseVideo = document.getElementById('showcase-video');
  const showcaseSection = document.getElementById('showcase');

  if (videoFrame && showcaseSection) {
    let ticking = false;

    // Freeze video initially until scrolled into view
    if (showcaseVideo) {
      showcaseVideo.pause();
    }

    const updateVideoZoom = () => {
      const rect = showcaseSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Start scaling when top of section enters 95% of window
      // Reach max scale (1.0) when top of section reaches 35% of window
      const startOffset = windowHeight * 0.95;
      const endOffset = windowHeight * 0.35;

      let progress = (startOffset - rect.top) / (startOffset - endOffset);
      progress = Math.max(0, Math.min(1, progress));

      // Interpolate scale from 0.65 (very small & frozen) up to 1.0 (max frame size)
      const minScale = 0.65;
      const maxScale = 1.0;
      const currentScale = minScale + (maxScale - minScale) * progress;

      videoFrame.style.transform = `scale(${currentScale.toFixed(4)})`;

      // Glow intensity scales with expansion
      const glowOpacity = 0.08 + progress * 0.12;
      videoFrame.style.boxShadow = `0 ${Math.round(20 + progress * 16)}px ${Math.round(40 + progress * 32)}px rgba(0, 0, 0, 0.75), 0 0 ${Math.round(20 + progress * 30)}px rgba(56, 189, 248, ${glowOpacity.toFixed(2)})`;

      // Unfreeze / play when expanding into view, freeze/pause when small/above
      if (showcaseVideo) {
        if (progress > 0.25) {
          if (showcaseVideo.paused) {
            showcaseVideo.play().catch(() => {});
          }
        } else {
          if (!showcaseVideo.paused) {
            showcaseVideo.pause();
          }
        }
      }

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateVideoZoom);
        ticking = true;
      }
    }, { passive: true });

    window.addEventListener('resize', updateVideoZoom, { passive: true });
    // Run once on initial load
    updateVideoZoom();
  }
});
