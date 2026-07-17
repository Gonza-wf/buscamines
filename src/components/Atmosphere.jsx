import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

// ─── Rayos de luz del sol (cáusticos) ────────────────────────────────────────
// Posicionados como si vinieran del sol en el cielo (ángulo 45°)
const GodRays = () => {
  const groupRef = useRef();
  const matRefs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Rotación muy lenta del conjunto
    if (groupRef.current) groupRef.current.rotation.y = t * 0.015;
    // Pulso de opacidad independiente por rayo
    matRefs.current.forEach((mat, i) => {
      if (mat) mat.opacity = 0.04 + Math.sin(t * 0.6 + i * 1.3) * 0.025;
    });
  });

  // Geometría de rayo: cono muy alargado y delgado
  const rayDefs = [
    { rotZ: 0.12, rotY: 0 },
    { rotZ: 0.18, rotY: 0.5 },
    { rotZ: 0.09, rotY: 1.1 },
    { rotZ: 0.22, rotY: 1.8 },
    { rotZ: 0.14, rotY: 2.6 },
    { rotZ: 0.10, rotY: 3.4 },
  ];

  return (
    <group ref={groupRef} position={[8, 30, -10]} rotation={[0, 0, -0.3]}>
      {rayDefs.map((def, i) => (
        <mesh key={i} rotation={[def.rotZ, def.rotY, 0]}>
          <coneGeometry args={[2.5, 40, 3, 1, true]} />
          <meshBasicMaterial
            ref={(el) => { matRefs.current[i] = el; }}
            color="#fff9e6"
            transparent
            opacity={0.05}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};

// ─── Luciérnagas ─────────────────────────────────────────────────────────────
const Fireflies = ({ count = 20, boardSize }) => {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => {
    const half = boardSize / 2;
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * boardSize * 1.3,
      y: Math.random() * 2.5 + 0.4,
      z: (Math.random() - 0.5) * boardSize * 1.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.4,
      radius: 0.2 + Math.random() * 0.5,
    }));
  }, [count, boardSize]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    data.forEach((d, i) => {
      dummy.position.set(
        d.x + Math.sin(t * d.speed + d.phase) * d.radius,
        d.y + Math.sin(t * 0.7 + d.phase * 1.5) * 0.3,
        d.z + Math.cos(t * d.speed + d.phase) * d.radius,
      );
      const pulse = (Math.sin(t * 2.5 + d.phase) + 1) / 2;
      dummy.scale.setScalar(0.025 + pulse * 0.04);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial
        color="#c6ff00"
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
};

// ─── Halos de luciérnagas (glows grandes) ────────────────────────────────────
const FireflyGlows = ({ count = 20, boardSize }) => {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * boardSize * 1.3,
    y: Math.random() * 2.5 + 0.4,
    z: (Math.random() - 0.5) * boardSize * 1.3,
    phase: Math.random() * Math.PI * 2,
    speed: 0.3 + Math.random() * 0.4,
    radius: 0.2 + Math.random() * 0.5,
  })), [count, boardSize]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    data.forEach((d, i) => {
      dummy.position.set(
        d.x + Math.sin(t * d.speed + d.phase) * d.radius,
        d.y + Math.sin(t * 0.7 + d.phase * 1.5) * 0.3,
        d.z + Math.cos(t * d.speed + d.phase) * d.radius,
      );
      const pulse = (Math.sin(t * 2.5 + d.phase) + 1) / 2;
      dummy.scale.setScalar(0.12 + pulse * 0.1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 5, 5]} />
      <meshBasicMaterial
        color="#76ff03"
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
};

// ─── Polvo de día ─────────────────────────────────────────────────────────────
const DustParticles = ({ boardSize }) => {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 25;

  const data = useMemo(() => Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * boardSize * 1.2,
    y: Math.random() * 6 + 1,
    z: (Math.random() - 0.5) * boardSize * 1.2,
    phase: Math.random() * Math.PI * 2,
  })), [boardSize]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime;
    data.forEach((d, i) => {
      dummy.position.set(
        d.x + Math.sin(t * 0.18 + d.phase) * 0.9,
        d.y + Math.sin(t * 0.12 + d.phase) * 0.6,
        d.z + Math.cos(t * 0.18 + d.phase) * 0.9,
      );
      dummy.scale.setScalar(0.012);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial
        color="#fffde7"
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const Atmosphere = ({ nightMode, boardSize }) => {
  return (
    <>
      {nightMode ? (
        <>
          {/* Cielo estrellado — no pitch black, sino añil profundo */}
          <Stars radius={70} depth={30} count={2500} factor={2.5} fade speed={0.3} />

          {/* Luna visible y brillante */}
          <mesh position={[12, 16, -18]}>
            <sphereGeometry args={[1.8, 20, 20]} />
            <meshBasicMaterial color="#fef9e7" />
          </mesh>
          {/* Halo de luna */}
          <mesh position={[12, 16, -18]}>
            <sphereGeometry args={[2.8, 20, 20]} />
            <meshBasicMaterial color="#e3f2fd" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>

          {/* Luz de luna cálida-fría */}
          <pointLight position={[12, 16, -18]} intensity={2.0} color="#dde9f5" distance={100} />

          {/* Luz ambiente nocturna tenue pero visible (azul índigo) */}
          <hemisphereLight skyColor="#1a237e" groundColor="#0a0a1a" intensity={0.55} />

          {/* Luciérnagas con halos */}
          <Fireflies count={22} boardSize={boardSize} />
          <FireflyGlows count={22} boardSize={boardSize} />
        </>
      ) : (
        <>
          {/* Luz de cielo de día (hemisférica cálida) */}
          <hemisphereLight skyColor="#87ceeb" groundColor="#4caf50" intensity={0.4} />
          <GodRays />
          <DustParticles boardSize={boardSize} />
        </>
      )}
    </>
  );
};

export default Atmosphere;
