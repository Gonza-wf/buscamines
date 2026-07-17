// Confetti.jsx — lluvia de partículas CSS puras (sin costo en el canvas 3D)
import React, { useEffect, useRef } from 'react';

const COLORS = ['#ffd54f', '#ef5350', '#66bb6a', '#42a5f5', '#ab47bc', '#ff7043', '#26c6da', '#fff'];
const COUNT  = 80;

const rand = (min, max) => min + Math.random() * (max - min);

export default function Confetti({ active }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Crear partículas
    particles.current = Array.from({ length: COUNT }, () => ({
      x:     rand(0, canvas.width),
      y:     rand(-canvas.height * 0.5, -10),
      vx:    rand(-1.5, 1.5),
      vy:    rand(2, 5),
      size:  rand(6, 12),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot:   rand(0, Math.PI * 2),
      rotV:  rand(-0.08, 0.08),
      alpha: 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles.current) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.rot += p.rotV;
        p.vy  += 0.05; // gravedad
        if (p.y > canvas.height + 20) p.alpha = 0;
        if (p.alpha <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle   = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (alive) animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
}
