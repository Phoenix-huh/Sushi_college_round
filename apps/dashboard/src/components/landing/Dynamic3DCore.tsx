import { useEffect, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Node3D {
  x: number;
  y: number;
  z: number;
  label?: string;
  color: string;
  size: number;
  pulseSpeed: number;
}

interface Edge3D {
  from: number;
  to: number;
  color: string;
  dash?: boolean;
}

interface Satellite {
  orbitRadiusX: number;
  orbitRadiusZ: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  angle: number;
  speed: number;
  color: string;
  size: number;
  trail: { x: number; y: number; alpha: number }[];
}

export function Dynamic3DCore() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animId: number | null = null;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    // 3D Geometry: Cyber Lattice Core
    const S = 85;
    const baseNodes: Node3D[] = [
      // Outer cube vertices
      { x: -S, y: -S, z: -S, color: '#ff3b81', size: 3.5, pulseSpeed: 2 },
      { x:  S, y: -S, z: -S, color: '#ffb0cf', size: 3.5, pulseSpeed: 2.2 },
      { x:  S, y:  S, z: -S, color: '#38bdf8', size: 3.5, pulseSpeed: 1.8 },
      { x: -S, y:  S, z: -S, color: '#ff3b81', size: 3.5, pulseSpeed: 2.5 },
      { x: -S, y: -S, z:  S, color: '#ffb0cf', size: 3.5, pulseSpeed: 2.1 },
      { x:  S, y: -S, z:  S, color: '#38bdf8', size: 3.5, pulseSpeed: 1.9 },
      { x:  S, y:  S, z:  S, color: '#ff3b81', size: 3.5, pulseSpeed: 2.3 },
      { x: -S, y:  S, z:  S, color: '#ffb0cf', size: 3.5, pulseSpeed: 2.0 },
      // Inner core diamonds
      { x: 0, y: -S * 1.3, z: 0, color: '#ffffff', size: 4.5, pulseSpeed: 3.2, label: 'PATCH' },
      { x: 0, y:  S * 1.3, z: 0, color: '#ffffff', size: 4.5, pulseSpeed: 3.2, label: 'RUNTIME' },
      { x: -S * 1.3, y: 0, z: 0, color: '#38bdf8', size: 4, pulseSpeed: 2.8 },
      { x:  S * 1.3, y: 0, z: 0, color: '#ff3b81', size: 4, pulseSpeed: 2.8 },
      { x: 0, y: 0, z: -S * 1.3, color: '#ffb0cf', size: 4, pulseSpeed: 2.8 },
      { x: 0, y: 0, z:  S * 1.3, color: '#38bdf8', size: 4, pulseSpeed: 2.8 },
    ];

    // Edges connecting the 3D lattice
    const edges: Edge3D[] = [
      // Outer cube box
      { from: 0, to: 1, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 1, to: 2, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 2, to: 3, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 3, to: 0, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 4, to: 5, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 5, to: 6, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 6, to: 7, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 7, to: 4, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 0, to: 4, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 1, to: 5, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 2, to: 6, color: 'rgba(255, 59, 129, 0.45)' },
      { from: 3, to: 7, color: 'rgba(255, 59, 129, 0.45)' },
      // Central spines
      { from: 8, to: 0, color: 'rgba(255, 176, 207, 0.25)', dash: true },
      { from: 8, to: 1, color: 'rgba(255, 176, 207, 0.25)', dash: true },
      { from: 8, to: 4, color: 'rgba(255, 176, 207, 0.25)', dash: true },
      { from: 8, to: 5, color: 'rgba(255, 176, 207, 0.25)', dash: true },
      { from: 9, to: 2, color: 'rgba(56, 189, 248, 0.25)', dash: true },
      { from: 9, to: 3, color: 'rgba(56, 189, 248, 0.25)', dash: true },
      { from: 9, to: 6, color: 'rgba(56, 189, 248, 0.25)', dash: true },
      { from: 9, to: 7, color: 'rgba(56, 189, 248, 0.25)', dash: true },
      // Inner cross links
      { from: 10, to: 11, color: 'rgba(255, 255, 255, 0.3)' },
      { from: 12, to: 13, color: 'rgba(255, 255, 255, 0.3)' },
      { from: 8, to: 9, color: 'rgba(255, 59, 129, 0.5)' },
    ];

    // Satellites orbiting around the 3D structure
    const satellites: Satellite[] = [
      {
        orbitRadiusX: 140,
        orbitRadiusZ: 140,
        tiltX: 0.4,
        tiltY: 0.2,
        tiltZ: 0.1,
        angle: 0,
        speed: 0.016,
        color: '#ff3b81',
        size: 3.5,
        trail: [],
      },
      {
        orbitRadiusX: 170,
        orbitRadiusZ: 170,
        tiltX: -0.5,
        tiltY: 0.6,
        tiltZ: -0.3,
        angle: Math.PI,
        speed: -0.012,
        color: '#38bdf8',
        size: 3,
        trail: [],
      },
      {
        orbitRadiusX: 120,
        orbitRadiusZ: 120,
        tiltX: 0.8,
        tiltY: -0.4,
        tiltZ: 0.5,
        angle: Math.PI / 2,
        speed: 0.02,
        color: '#ffc1e3',
        size: 2.8,
        trail: [],
      },
    ];

    // Rotation angles and interactive physics
    let rotX = 0.25;
    let rotY = 0.45;
    let rotZ = 0.05;
    let targetRotX = 0.25;
    let targetRotY = 0.45;

    let velX = 0;
    let velY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let autoRotate = true;

    // Mouse tracking for parallax tilt
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        velY = dx * 0.005;
        velX = -dy * 0.005;
        targetRotY += velY;
        targetRotX += velX;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      } else {
        targetRotY = (mouseX / (rect.width / 2)) * 0.45;
        targetRotX = -(mouseY / (rect.height / 2)) * 0.35;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      autoRotate = false;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const handleMouseUp = () => {
      isDragging = false;
      autoRotate = true;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousedown', handleMouseDown);

    // 3D Matrix Math Helper
    const rotatePoint = (p: Point3D, rx: number, ry: number, rz: number): Point3D => {
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const y1 = p.y * cosX - p.z * sinX;
      const z1 = p.y * sinX + p.z * cosX;

      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const x2 = p.x * cosY + z1 * sinY;
      const z2 = -p.x * sinY + z1 * cosY;

      const cosZ = Math.cos(rz);
      const sinZ = Math.sin(rz);
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = x2 * sinZ + y1 * cosZ;

      return { x: x3, y: y3, z: z2 };
    };

    // Perspective Projection
    const FOV = 480;
    const project = (p: Point3D, cx: number, cy: number) => {
      const depth = FOV + p.z;
      const scale = depth > 10 ? FOV / depth : 1;
      return {
        x: cx + p.x * scale,
        y: cy + p.y * scale,
        scale,
        depth: p.z,
      };
    };

    let clock = 0;

    const render = () => {
      clock += 0.016;

      if (autoRotate && !isDragging) {
        rotY += 0.005;
        rotX += Math.sin(clock * 0.5) * 0.002;
        rotX += (targetRotX - rotX) * 0.05;
        rotY += (targetRotY - (rotY % (Math.PI * 2))) * 0.02;
      } else {
        rotX += velX;
        rotY += velY;
        velX *= 0.94;
        velY *= 0.94;
      }

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw faint background 3D depth grid rings
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 59, 129, 0.07)';
      ctx.lineWidth = 1;
      for (let r = 80; r <= 220; r += 70) {
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, r, r * 0.35, rotZ, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Transform all base nodes
      const projectedNodes = baseNodes.map((n, idx) => {
        const pulse = 1 + Math.sin(clock * n.pulseSpeed + idx) * 0.12;
        const pRot = rotatePoint(
          { x: n.x * pulse, y: n.y * pulse, z: n.z * pulse },
          rotX,
          rotY,
          rotZ
        );
        const proj = project(pRot, centerX, centerY);
        return { ...n, ...proj, z: pRot.z };
      });

      // Sort edges by depth
      const sortedEdges = [...edges].sort((a, b) => {
        const depthA = (projectedNodes[a.from].z + projectedNodes[a.to].z) / 2;
        const depthB = (projectedNodes[b.from].z + projectedNodes[b.to].z) / 2;
        return depthA - depthB;
      });

      // Draw 3D Edges
      sortedEdges.forEach((edge) => {
        const p1 = projectedNodes[edge.from];
        const p2 = projectedNodes[edge.to];
        const avgDepth = (p1.z + p2.z) / 2;
        const alpha = Math.max(0.12, Math.min(0.65, (avgDepth + 180) / 360));

        ctx.save();
        ctx.strokeStyle = edge.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(0.8, 1.4 * ((p1.scale + p2.scale) / 2));
        if (edge.dash) {
          ctx.setLineDash([4, 4]);
        }
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      });

      // Draw 3D Satellites and Orbital Trails
      satellites.forEach((sat) => {
        sat.angle += sat.speed;
        const rawX = Math.cos(sat.angle) * sat.orbitRadiusX;
        const rawZ = Math.sin(sat.angle) * sat.orbitRadiusZ;
        const pRot = rotatePoint(
          { x: rawX, y: 0, z: rawZ },
          rotX + sat.tiltX,
          rotY + sat.tiltY,
          rotZ + sat.tiltZ
        );
        const proj = project(pRot, centerX, centerY);

        sat.trail.push({ x: proj.x, y: proj.y, alpha: 0.6 });
        if (sat.trail.length > 14) sat.trail.shift();

        if (sat.trail.length > 1) {
          ctx.save();
          for (let i = 0; i < sat.trail.length - 1; i++) {
            const t1 = sat.trail[i];
            const t2 = sat.trail[i + 1];
            ctx.strokeStyle = sat.color;
            ctx.globalAlpha = (i / sat.trail.length) * 0.35;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(t1.x, t1.y);
            ctx.lineTo(t2.x, t2.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = sat.color;
        ctx.shadowColor = sat.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, sat.size * proj.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw 3D Nodes
      projectedNodes.forEach((node) => {
        const nodeAlpha = Math.max(0.2, Math.min(1, (node.z + 200) / 400));
        ctx.save();
        ctx.globalAlpha = nodeAlpha;
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = node.size * 2.5;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * node.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, (node.size * 0.4) * node.scale, 0, Math.PI * 2);
        ctx.fill();

        if (node.label && node.scale > 0.95) {
          ctx.font = `700 ${Math.floor(9 * node.scale)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#ffb0cf';
          ctx.textAlign = 'center';
          ctx.fillText(node.label, node.x, node.y - 8 * node.scale);
        }
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full max-w-[1400px] max-h-[850px] cursor-grab active:cursor-grabbing opacity-50 transition-opacity hover:opacity-75"
        title="Interactive 3D Hotfix Core — Drag to spin"
      />
    </div>
  );
}
