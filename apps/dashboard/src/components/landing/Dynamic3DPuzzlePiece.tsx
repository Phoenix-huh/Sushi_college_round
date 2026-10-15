import React, { useEffect, useRef, useState } from 'react';

interface Dynamic3DPuzzlePieceProps {
  baseRotateX: number;
  baseRotateY: number;
  baseRotateZ: number;
  depth?: number;
  floatSpeed?: number;
  floatAmp?: number;
  phaseOffset?: number;
  className?: string;
  children: React.ReactNode;
}

export function Dynamic3DPuzzlePiece({
  baseRotateX,
  baseRotateY,
  baseRotateZ,
  depth = 1.0,
  floatSpeed = 1.0,
  floatAmp = 6,
  phaseOffset = 0,
  className = '',
  children,
}: Dynamic3DPuzzlePieceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [glarePos, setGlarePos] = useState<{ x: number; y: number; opacity: number }>({
    x: 50,
    y: 50,
    opacity: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let targetOffsetX = 0;
    let targetOffsetY = 0;
    let currentOffsetX = 0;
    let currentOffsetY = 0;

    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    let isHovered = false;
    let animId: number | null = null;
    let startTime = performance.now();

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      // Normalized mouse coords [-1, 1]
      const nx = (e.clientX - w / 2) / (w / 2);
      const ny = (e.clientY - h / 2) / (h / 2);

      targetOffsetX = nx * 10 * depth;
      targetOffsetY = ny * 8 * depth;
      targetTiltX = -ny * 8;
      targetTiltY = nx * 10;

      if (el) {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          isHovered = true;
          const localX = ((e.clientX - rect.left) / rect.width) * 100;
          const localY = ((e.clientY - rect.top) / rect.height) * 100;
          setGlarePos({ x: localX, y: localY, opacity: 0.35 });
        } else {
          isHovered = false;
          setGlarePos((prev) => (prev.opacity > 0 ? { ...prev, opacity: 0 } : prev));
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const updateLoop = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      // Smooth lerp for motion and tilt
      currentOffsetX += (targetOffsetX - currentOffsetX) * 0.08;
      currentOffsetY += (targetOffsetY - currentOffsetY) * 0.08;
      currentTiltX += (targetTiltX - currentTiltX) * 0.08;
      currentTiltY += (targetTiltY - currentTiltY) * 0.08;

      // Gentle continuous 3D sine-wave levitation
      const levY = Math.sin(elapsed * floatSpeed + phaseOffset) * floatAmp;
      const levZ = Math.cos(elapsed * floatSpeed * 0.8 + phaseOffset) * (floatAmp * 0.5);
      const levRotZ = Math.sin(elapsed * floatSpeed * 0.6 + phaseOffset) * 1.0;

      const totalX = currentOffsetX;
      const totalY = currentOffsetY + levY;
      const totalZ = isHovered ? levZ + 25 : levZ;

      const finalRotX = baseRotateX + currentTiltX * (isHovered ? 0.3 : 1.0);
      const finalRotY = baseRotateY + currentTiltY * (isHovered ? 0.3 : 1.0);
      const finalRotZ = baseRotateZ + levRotZ;
      const scale = isHovered ? 1.03 : 1.0;

      el.style.transform = `perspective(1200px) translate3d(${totalX.toFixed(2)}px, ${totalY.toFixed(2)}px, ${totalZ.toFixed(2)}px) rotateX(${finalRotX.toFixed(2)}deg) rotateY(${finalRotY.toFixed(2)}deg) rotateZ(${finalRotZ.toFixed(2)}deg) scale(${scale})`;

      animId = requestAnimationFrame(updateLoop);
    };

    animId = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [baseRotateX, baseRotateY, baseRotateZ, depth, floatAmp, floatSpeed, phaseOffset]);

  const hasPosition = className.includes('absolute') || className.includes('fixed');

  return (
    <div
      ref={containerRef}
      className={`will-change-transform transition-shadow duration-300 ${hasPosition ? '' : 'relative'} ${className}`}
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Dynamic 3D Specular Glare Layer */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl z-30 transition-opacity duration-300"
        style={{
          opacity: glarePos.opacity,
          background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 59, 129, 0.15) 30%, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}
