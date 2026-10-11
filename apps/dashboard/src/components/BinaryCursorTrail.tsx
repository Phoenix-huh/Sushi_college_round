import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  char: '0' | '1';
  alpha: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export function BinaryCursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];
    let lastX = 0;
    let lastY = 0;
    let animId: number | null = null;
    let isRunning = false;

    // Gentle cyber color palette for the 1s and 0s trail
    const colors = ['#ff3b81', '#ffb1c2', '#ffffff', '#f48fb1', '#ffc1e3'];

    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.028; // Gracefully fade out over ~35-40 frames

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.font = `600 ${p.size}px "JetBrains Mono", monospace`;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.shadowColor = '#ff3b81';
        ctx.shadowBlur = 4;
        ctx.fillText(p.char, p.x, p.y);
        ctx.restore();
      }

      if (particles.length > 0) {
        animId = requestAnimationFrame(render);
      } else {
        isRunning = false;
        animId = null;
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      // Spawn a new binary digit every 9px of movement
      if (dist >= 9) {
        lastX = e.clientX;
        lastY = e.clientY;

        const char = Math.random() > 0.5 ? '1' : '0';
        const color = colors[Math.floor(Math.random() * colors.length)];

        particles.push({
          x: e.clientX + (Math.random() * 6 - 3),
          y: e.clientY + 14 + (Math.random() * 6 - 3),
          char,
          alpha: 0.95,
          vx: (Math.random() - 0.5) * 0.4,
          vy: Math.random() * 0.6 + 0.3, // floats gently downwards
          size: Math.floor(Math.random() * 2) + 11, // 11px - 12px
          color,
        });

        // Limit maximum particle count for silky-smooth performance
        if (particles.length > 50) {
          particles.shift();
        }

        if (!isRunning) {
          isRunning = true;
          animId = requestAnimationFrame(render);
        }
      }
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      aria-hidden="true"
    />
  );
}
