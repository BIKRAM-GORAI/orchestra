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
  const glowSpinner = document.getElementById('video-glow-spinner');
  const hoverCursor = document.getElementById('video-hover-cursor');

  if (videoFrame && showcaseSection) {
    let ticking = false;
    let activeScale = 0.28;

    // Freeze video initially until scrolled into view
    if (showcaseVideo) {
      showcaseVideo.pause();
    }

    const updateVideoZoom = () => {
      const rect = showcaseSection.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Zooming starts AFTER more scrolling: starts when section top reaches 38% of window
      // Expands gradually over a comfortable scroll distance until top reaches -12% of window
      const startOffset = windowHeight * 0.38;
      const endOffset = -windowHeight * 0.12;

      let progress = (startOffset - rect.top) / (startOffset - endOffset);
      progress = Math.max(0, Math.min(1, progress));

      // At first small (0.28) and slowly increases to 1.0 (max frame size)
      const minScale = 0.28;
      const maxScale = 1.0;
      const currentScale = minScale + (maxScale - minScale) * progress;
      activeScale = currentScale;

      videoFrame.style.transform = `scale(${currentScale.toFixed(4)})`;

      // Keep cursor unscale synced with frame scale
      if (hoverCursor) {
        const unscale = currentScale > 0 ? (1 / currentScale) : 1;
        hoverCursor.style.setProperty('--frame-unscale', unscale.toFixed(3));
      }

      // Frame border glow rotates dynamically while zooming!
      if (glowSpinner) {
        const angle = progress * 720; // 2 complete revolutions while zooming
        glowSpinner.style.transform = `rotate(${angle.toFixed(1)}deg)`;
        const rotatorOpacity = 0.38 + progress * 0.58;
        glowSpinner.style.opacity = rotatorOpacity.toFixed(2);
      }

      // Subtle, refined exterior white glow
      const glowOpacity = 0.03 + progress * 0.06;
      videoFrame.style.boxShadow = `0 ${Math.round(20 + progress * 24)}px ${Math.round(40 + progress * 36)}px rgba(0, 0, 0, 0.88), 0 0 ${Math.round(16 + progress * 24)}px rgba(255, 255, 255, ${glowOpacity.toFixed(2)})`;

      // Unfreeze / play when expanding into view, freeze/pause when small/above
      if (showcaseVideo) {
        if (progress > 0.30) {
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

    // 6. Interactive Floating Cursor Circle: Blooms smoothly from size 0 to max size on hover
    if (hoverCursor) {
      let isHovered = false;
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      let cursorRaf = null;

      const renderCursor = () => {
        // Ultra-fluid trailing interpolation (0.35 lerp)
        currentX += (targetX - currentX) * 0.35;
        currentY += (targetY - currentY) * 0.35;
        hoverCursor.style.left = `${currentX.toFixed(1)}px`;
        hoverCursor.style.top = `${currentY.toFixed(1)}px`;

        if (isHovered || Math.abs(targetX - currentX) > 0.2 || Math.abs(targetY - currentY) > 0.2) {
          cursorRaf = requestAnimationFrame(renderCursor);
        } else {
          cursorRaf = null;
        }
      };

      videoFrame.addEventListener('mouseenter', (e) => {
        isHovered = true;
        const rect = videoFrame.getBoundingClientRect();
        if (rect.width && rect.height) {
          targetX = ((e.clientX - rect.left) / rect.width) * videoFrame.offsetWidth;
          targetY = ((e.clientY - rect.top) / rect.height) * videoFrame.offsetHeight;
          currentX = targetX;
          currentY = targetY;
          hoverCursor.style.left = `${currentX.toFixed(1)}px`;
          hoverCursor.style.top = `${currentY.toFixed(1)}px`;
        }
        hoverCursor.classList.add('active');
        if (!cursorRaf) {
          cursorRaf = requestAnimationFrame(renderCursor);
        }
      });

      videoFrame.addEventListener('mouseleave', () => {
        isHovered = false;
        hoverCursor.classList.remove('active');
      });

      videoFrame.addEventListener('mousemove', (e) => {
        const rect = videoFrame.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        targetX = ((e.clientX - rect.left) / rect.width) * videoFrame.offsetWidth;
        targetY = ((e.clientY - rect.top) / rect.height) * videoFrame.offsetHeight;
        if (!cursorRaf) {
          cursorRaf = requestAnimationFrame(renderCursor);
        }
      });
    }

    // Direct click navigation to simple mode
    videoFrame.addEventListener('click', (e) => {
      if (!e.ctrlKey && !e.metaKey && e.button === 0) {
        window.location.href = './simple.html';
      }
    });

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
