import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import BoardDecorations from './BoardDecorations';
import ParticleManager from './Particles';

const CELL_SIZE = 1.0;

const colors = {
  1: '#1976d2', 2: '#388e3c', 3: '#d32f2f',
  4: '#7b1fa2', 5: '#f57c00', 6: '#0097a7',
  7: '#212121', 8: '#757575',
};

// ─── Cámara controlada ─────────────────────────────────────────────────────────
export const CameraController = ({ difficulty, resetKey, fullReset, controlsRef }) => {
  const { camera } = useThree();
  useEffect(() => {
    if (fullReset) {
      const maxDim = Math.max(difficulty.rows, difficulty.cols);
      const dist   = maxDim * 1.35;
      camera.position.set(0, dist, dist * 0.6);
      camera.lookAt(0, 0, 0);
    } else if (controlsRef?.current) {
      // Retener el ángulo restando el offset del target a la posición de la cámara
      const targetOffset = controlsRef.current.target.clone();
      camera.position.sub(targetOffset);
    }
    if (controlsRef?.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

// ─── Grid overlay: UNA sola LineSegments para todo el tablero ────────────────
// Sustituye a los 480 componentes <Edges> individuales
const GridOverlay = ({ cols, rows, boardOffset, nightMode }) => {
  const geo = useMemo(() => {
    const pts = [];
    const y = 0.262;
    for (let r = 0; r <= rows; r++) {
      const z = r - boardOffset.z - 0.5;
      pts.push(-boardOffset.x - 0.5, y, z,  cols - boardOffset.x - 0.5, y, z);
    }
    for (let c = 0; c <= cols; c++) {
      const x = c - boardOffset.x - 0.5;
      pts.push(x, y, -boardOffset.z - 0.5,  x, y, rows - boardOffset.z - 0.5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [cols, rows, boardOffset]);

  const color = nightMode ? '#1b5e20' : '#558b2f';
  return (
    <lineSegments geometry={geo} renderOrder={1}>
      <lineBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
    </lineSegments>
  );
};

// ─── Número ──────────────────────────────────────────────────────────────────
const NumberText = ({ number }) => (
  <Text
    position={[0, 0.06, 0]}
    rotation={[-Math.PI / 2, 0, 0]}
    fontSize={0.55}
    color={colors[number] || '#333'}
    anchorX="center"
    anchorY="middle"
    fontWeight="900"
    renderOrder={2}
    depthOffset={-0.01}
  >
    {number}
  </Text>
);

// ─── Bandera mejorada ─────────────────────────────────────────────────────────
const FlagModel = ({ nightMode }) => {
  const groupRef = useRef();
  const flagRef  = useRef();

  const pennantShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.32, -0.1); s.lineTo(0, -0.22); s.closePath();
    return s;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (flagRef.current)  flagRef.current.rotation.y  = Math.sin(t * 2.0) * 0.12;
    if (groupRef.current) groupRef.current.rotation.z = Math.sin(t * 1.2) * 0.04;
  });

  const { scale } = useSpring({
    from: { scale: 0 }, to: { scale: 1 },
    config: { mass: 0.6, tension: 360, friction: 14 },
  });

  return (
    <animated.group ref={groupRef} position={[0, 0.26, 0]} scale={scale}>
      <mesh castShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.06, 8]} />
        <meshStandardMaterial color="#9e9e9e" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.52, 7]} />
        <meshStandardMaterial color="#bdbdbd" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0, 0.535, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.9} roughness={0.1} />
      </mesh>
      <group ref={flagRef} position={[0.01, 0.42, 0]}>
        <mesh castShadow>
          <shapeGeometry args={[pennantShape]} />
          <meshStandardMaterial color={nightMode ? '#ef5350' : '#e53935'} side={THREE.DoubleSide} roughness={0.7} />
        </mesh>
      </group>
    </animated.group>
  );
};

// ─── Anillo de progreso de long-press ─────────────────────────────────────────
const LongPressRing = ({ progress }) => {
  const { opacity, scale } = useSpring({
    opacity: progress > 0 ? 0.85 : 0,
    scale:   progress > 0 ? 0.55 : 0.3,
    config:  { tension: 300, friction: 20 },
  });
  return (
    <animated.mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]} scale={scale}>
      <ringGeometry args={[0.75, 0.9, 32, 1, 0, progress * Math.PI * 2]} />
      <animated.meshBasicMaterial color="#ffffff" transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
    </animated.mesh>
  );
};

// ─── Mina terrestre ───────────────────────────────────────────────────────────
const MineModel = ({ exploded }) => {
  const glowRef = useRef();
  useFrame(({ clock }) => {
    if (glowRef.current && exploded)
      glowRef.current.material.opacity = (Math.sin(clock.elapsedTime * 6) + 1) * 0.25 + 0.1;
  });
  return (
    <group position={[0, 0.05, 0]}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.07, 12]} />
        <meshStandardMaterial color={exploded ? '#bf360c' : '#263238'} roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 12]} />
        <meshStandardMaterial color={exploded ? '#e64a19' : '#1b5e20'} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.05, 6]} />
        <meshStandardMaterial color="#9e9e9e" />
      </mesh>
      {exploded && (
        <mesh ref={glowRef} position={[0, 0.07, 0]}>
          <sphereGeometry args={[0.5, 10, 10]} />
          <meshBasicMaterial color="#ff3d00" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
};

// ─── Celda (optimizada para rendimiento) ─────────────────────────────────────
// Optimizaciones clave:
//  1. useFrame + lerp en lugar de react-spring (sin overhead de springs)
//  2. Sin castShadow (elimina cómputo del shadow map × 480)
//  3. Sin <Edges> (eliminado en favor del GridOverlay compartido)
//  4. Custom React.memo comparator (evita re-renders innecesarios)
const Cell = React.memo(({
  r, c, cellData, onReveal, onFlag, boardOffset, isGameOver, nightMode,
}) => {
  const x = c * CELL_SIZE - boardOffset.x;
  const z = r * CELL_SIZE - boardOffset.z;

  // Refs para animación (sin react-spring)
  const meshRef   = useRef();
  const posY      = useRef(cellData.isRevealed ? -0.2 : 0);
  const scaleYRef = useRef(1);
  const [hovered, setHovered] = useState(false);

  // Target calculado en render (lectura barata en useFrame via closure)
  const tgtPosY   = cellData.isRevealed ? -0.2 : 0;
  const tgtScaleY = (hovered && !cellData.isRevealed && !isGameOver) ? 1.1 : 1.0;

  // Un único useFrame ligero por celda
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dP = tgtPosY   - posY.current;
    const dS = tgtScaleY - scaleYRef.current;
    if (Math.abs(dP) < 0.001 && Math.abs(dS) < 0.001) return; // sin cambio → salir
    posY.current    += dP * Math.min(1, delta * 12);
    scaleYRef.current += dS * Math.min(1, delta * 18);
    meshRef.current.position.y = posY.current;
    meshRef.current.scale.y    = scaleYRef.current;
  });

  const grassColor = nightMode ? '#2e7d32' : '#7cb342';
  const dirtColor  = nightMode ? '#4e342e' : '#a1887f';

  // Long-press
  const timerRef     = useRef(null);
  const animFrameRef = useRef(null);
  const movedRef     = useRef(false);
  const pressStart   = useRef(0);
  const [pressProgress, setPressProgress] = useState(0);
  const HOLD_MS = 380;

  const cancelPress = useCallback(() => {
    if (timerRef.current)     { clearTimeout(timerRef.current);             timerRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    setPressProgress(0);
  }, []);

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    if (isGameOver) return;
    // Si la celda ya está revelada, solo permitir chording (no long-press)
    if (cellData.isRevealed) return;
    movedRef.current = false;
    pressStart.current = performance.now();

    const animate = () => {
      const p = Math.min((performance.now() - pressStart.current) / HOLD_MS, 1);
      setPressProgress(p);
      if (p < 1) animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      setPressProgress(0);
      onFlag(r, c);
    }, HOLD_MS);
  }, [isGameOver, cellData.isRevealed, onFlag, r, c]);

  const handlePointerMove = useCallback(() => {
    movedRef.current = true;
    cancelPress();
  }, [cancelPress]);

  const handlePointerUp = useCallback((e) => {
    e.stopPropagation();
    if (isGameOver) return;
    // Celda ya revelada: tap activa chording
    if (cellData.isRevealed) {
      onReveal(r, c);
      return;
    }
    const wasHeld = !timerRef.current;
    cancelPress();
    if (!movedRef.current && !wasHeld) onReveal(r, c);
  }, [isGameOver, cellData.isRevealed, onReveal, r, c, cancelPress]);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    cancelPress();
  }, [cancelPress]);

  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerEnter={() => !cellData.isRevealed && !isGameOver && setHovered(true)}
        onPointerOut={handlePointerOut}
        receiveShadow
        /* SIN castShadow: elimina el recómputo del shadow map en cada frame */
      >
        <boxGeometry args={[CELL_SIZE, 0.5, CELL_SIZE]} />
        <meshStandardMaterial
          color={cellData.isRevealed ? dirtColor : grassColor}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {!cellData.isRevealed && !cellData.isFlagged && pressProgress > 0 && (
        <LongPressRing progress={pressProgress} />
      )}

      {cellData.isRevealed && !cellData.isMine && cellData.neighborMines > 0 && (
        <NumberText number={cellData.neighborMines} />
      )}

      {cellData.isRevealed && cellData.isMine && (
        <MineModel exploded={cellData.exploded} />
      )}

      {cellData.isFlagged && !cellData.isRevealed && (
        <FlagModel nightMode={nightMode} />
      )}
    </group>
  );
},
// ─── Comparador personalizado: sólo re-renderiza si cambió algo visible ───────
(prev, next) =>
  prev.cellData.isRevealed    === next.cellData.isRevealed    &&
  prev.cellData.isFlagged     === next.cellData.isFlagged     &&
  prev.cellData.exploded      === next.cellData.exploded      &&
  prev.cellData.neighborMines === next.cellData.neighborMines &&
  prev.nightMode              === next.nightMode              &&
  prev.isGameOver             === next.isGameOver             &&
  prev.onReveal               === next.onReveal               &&
  prev.boardOffset.x          === next.boardOffset.x          &&
  prev.boardOffset.z          === next.boardOffset.z

);

// ─── Tablero completo ─────────────────────────────────────────────────────────
const GameScene = ({ board, onReveal, onFlag, difficulty, gameState, nightMode, particleEvents }) => {
  const boardOffset = useMemo(() => ({
    x: (difficulty.cols * CELL_SIZE) / 2 - CELL_SIZE / 2,
    z: (difficulty.rows * CELL_SIZE) / 2 - CELL_SIZE / 2,
  }), [difficulty]);

  const isGameOver = gameState === 'won' || gameState === 'lost' || gameState === 'viewing';

  return (
    <group>
      {board.map((row, r) =>
        row.map((cell, c) => (
          <Cell
            key={`${r}-${c}`}
            r={r} c={c}
            cellData={cell}
            onReveal={onReveal}
            onFlag={onFlag}
            boardOffset={boardOffset}
            isGameOver={isGameOver}
            nightMode={nightMode}
          />
        ))
      )}

      {/* Grid compartido: 1 draw call para toda la cuadrícula */}
      <GridOverlay
        cols={difficulty.cols}
        rows={difficulty.rows}
        boardOffset={boardOffset}
        nightMode={nightMode}
      />

      <BoardDecorations board={board} difficulty={difficulty} boardOffset={boardOffset} nightMode={nightMode} />
      <ParticleManager events={particleEvents} />

      {/* Base del tablero */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[difficulty.cols * CELL_SIZE + 1, 0.4, difficulty.rows * CELL_SIZE + 1]} />
        <meshStandardMaterial color={nightMode ? '#2c1810' : '#5d4037'} roughness={1} />
      </mesh>

      {!nightMode && <pointLight position={[0, 8, 0]} intensity={0.5} color="#fff9c4" distance={30} />}
      {nightMode  && <pointLight position={[0, 12, 5]} intensity={0.6} color="#90caf9" distance={40} />}
    </group>
  );
};

export default GameScene;
