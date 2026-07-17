import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Un solo InstancedMesh para toda la hierba + uno para piedras.
// Antes teníamos ~1440 useFrame individuales → ahora 1 total.
const BoardDecorations = ({ board, difficulty, boardOffset, nightMode }) => {
  const grassRef  = useRef();
  const pebbleRef = useRef();
  const dummy     = useMemo(() => new THREE.Object3D(), []);

  // Generar posiciones de hierba / piedras (determinístico por coordenada)
  const { blades, pebbles } = useMemo(() => {
    const rng = (seed) => {
      let s = seed;
      return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    };

    const blades  = [];
    const pebbles = [];

    for (let r = 0; r < difficulty.rows; r++) {
      for (let c = 0; c < difficulty.cols; c++) {
        const rand = rng(r * 1000 + c * 37 + 7);
        const bx   = c - boardOffset.x;
        const bz   = r - boardOffset.z;

        // 2-4 briznas de hierba por celda
        const count = Math.floor(rand() * 3) + 2;
        for (let b = 0; b < count; b++) {
          blades.push({
            r, c,
            x:     bx + (rand() - 0.5) * 0.7,
            z:     bz + (rand() - 0.5) * 0.7,
            phase: rand() * Math.PI * 2,
            scaleH: 0.9 + rand() * 0.6,
          });
        }

        // Piedrita (30 % de probabilidad)
        if (rand() < 0.3) {
          pebbles.push({
            r, c,
            x:     bx + (rand() - 0.5) * 0.5,
            z:     bz + (rand() - 0.5) * 0.5,
            rotY:  rand() * Math.PI,
            scale: rand() * 0.055 + 0.04,
          });
        }
      }
    }
    return { blades, pebbles };
  }, [difficulty, boardOffset]);

  // Mapa de celdas reveladas (actualizado por referencia para no re-generar datos)
  const revealedRef = useRef({});
  useEffect(() => {
    const r = {};
    board.forEach((row, ri) =>
      row.forEach((cell, ci) => { if (cell.isRevealed) r[`${ri},${ci}`] = true; })
    );
    revealedRef.current = r;
  }, [board]);

  // Colores según modo
  const grassColor  = nightMode ? '#2e7d32' : '#558b2f';
  const pebbleColor = nightMode ? '#546e7a' : '#78909c';

  // Un único useFrame para TODA la hierba → sin coste por celda
  useFrame(({ clock }) => {
    const t        = clock.elapsedTime;
    const revealed = revealedRef.current;

    if (grassRef.current) {
      for (let i = 0; i < blades.length; i++) {
        const b = blades[i];
        if (revealed[`${b.r},${b.c}`]) {
          dummy.scale.setScalar(0);
        } else {
          dummy.position.set(b.x, 0.29, b.z);
          dummy.rotation.set(0, 0, Math.sin(t * 1.2 + b.phase) * 0.18);
          dummy.scale.set(1, b.scaleH, 1);
        }
        dummy.updateMatrix();
        grassRef.current.setMatrixAt(i, dummy.matrix);
      }
      grassRef.current.instanceMatrix.needsUpdate = true;
    }

    if (pebbleRef.current) {
      for (let i = 0; i < pebbles.length; i++) {
        const p = pebbles[i];
        if (revealed[`${p.r},${p.c}`]) {
          dummy.scale.setScalar(0);
        } else {
          dummy.position.set(p.x, 0.27, p.z);
          dummy.rotation.set(0, p.rotY, 0);
          dummy.scale.setScalar(p.scale);
        }
        dummy.updateMatrix();
        pebbleRef.current.setMatrixAt(i, dummy.matrix);
      }
      pebbleRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (!blades.length) return null;

  return (
    <group>
      <instancedMesh ref={grassRef} args={[null, null, blades.length]} frustumCulled={false}>
        <boxGeometry args={[0.04, 0.18, 0.04]} />
        <meshStandardMaterial color={grassColor} roughness={1} />
      </instancedMesh>

      {pebbles.length > 0 && (
        <instancedMesh ref={pebbleRef} args={[null, null, pebbles.length]} frustumCulled={false}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={pebbleColor} roughness={0.9} metalness={0.1} />
        </instancedMesh>
      )}
    </group>
  );
};

export default BoardDecorations;
