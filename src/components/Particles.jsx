import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Partículas de tierra al revelar una celda
const DirtBurst = ({ x, z, onDone }) => {
  const meshRef = useRef();
  const count = 8;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dataRef = useRef(null);
  const timeRef = useRef(0);

  if (!dataRef.current) {
    dataRef.current = Array.from({ length: count }, () => ({
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 1.5,
      vz: (Math.random() - 0.5) * 3,
      py: 0.3,
    }));
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const particles = dataRef.current;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.vy -= 9.8 * delta;
      dummy.position.set(x + p.vx * timeRef.current, p.py + p.vy * timeRef.current, z + p.vz * timeRef.current);
      const scale = Math.max(0, 0.08 - timeRef.current * 0.08);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (timeRef.current > 0.9 && onDone) onDone();
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshStandardMaterial color="#795548" roughness={1} />
    </instancedMesh>
  );
};

// Partículas de explosión para minas
const ExplosionBurst = ({ x, z }) => {
  const meshRef = useRef();
  const count = 20;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dataRef = useRef(null);
  const timeRef = useRef(0);

  if (!dataRef.current) {
    dataRef.current = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      return {
        vx: Math.cos(angle) * speed,
        vy: Math.random() * 5 + 2,
        vz: Math.sin(angle) * speed,
        color: i % 3 === 0 ? '#ff6f00' : i % 3 === 1 ? '#e53935' : '#ffca28',
      };
    });
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    for (let i = 0; i < count; i++) {
      const p = dataRef.current[i];
      dummy.position.set(x + p.vx * t, 0.3 + p.vy * t - 5 * t * t, z + p.vz * t);
      const scale = Math.max(0, 0.12 - t * 0.08);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial color="#ff6f00" blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.85} />
    </instancedMesh>
  );
};

// Gestor de efectos de partículas
const ParticleManager = ({ events }) => {
  return (
    <>
      {events.map((ev) => {
        if (ev.type === 'dirt') return <DirtBurst key={ev.id} x={ev.x} z={ev.z} />;
        if (ev.type === 'explosion') return <ExplosionBurst key={ev.id} x={ev.x} z={ev.z} />;
        return null;
      })}
    </>
  );
};

export default ParticleManager;
