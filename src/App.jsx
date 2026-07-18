import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls, Sky, Environment } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, Flag, Moon, Sun, Eye, Volume2, VolumeX, HelpCircle, X, Trophy, Maximize, Minimize } from 'lucide-react';
import * as THREE from 'three';
import GameScene, { CameraController } from './components/GameScene';
import Atmosphere from './components/Atmosphere';
import Confetti from './components/Confetti';
import { generateEmptyBoard, placeMines, DIFFICULTIES, revealEmptyCells, checkWinCondition, chordReveal } from './game/logic';
import { initAudio, playReveal, playFlag, playExplosion, playWin, toggleAudioMute, setAudioNightMode, resetAudio } from './game/audio';

// ── Récords locales ─────────────────────────────────────────────────────

const RECORDS_KEY = 'minesweeper3d_records';

const loadRecords = () => {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; } catch { return {}; }
};

const saveRecord = (diffName, time) => {
  const records = loadRecords();
  if (!records[diffName] || time < records[diffName]) {
    records[diffName] = time;
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true; // nuevo récord
  }
  return false;
};

const haptic = (pattern) => {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
};

let particleIdCounter = 0;

const formatTime = (s) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

function App() {
  const [gameState, setGameState]       = useState('menu');
  const [difficulty, setDifficulty]     = useState(DIFFICULTIES.EASY);
  const [board, setBoard]               = useState([]);
  const boardRef                        = useRef([]);

  const setBoardSync = useCallback((newBoard) => {
    boardRef.current = newBoard;
    setBoard(newBoard);
  }, []);
  const [nightMode, setNightMode]       = useState(false);
  const [particleEvents, setParticleEvents] = useState([]);
  const [elapsedTime, setElapsedTime]   = useState(0);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [cameraFullReset, setCameraFullReset] = useState(true);
  const [isMuted, setIsMuted]           = useState(false);
  const [showHelp, setShowHelp]         = useState(false);
  const [records, setRecords]           = useState(loadRecords);
  const [isNewRecord, setIsNewRecord]   = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refreshRecords = useCallback(() => setRecords(loadRecords()), []);

  // ── Anti-zoom del sistema en móvil ─────────────────────────────────────────────
  useEffect(() => {
    const prevent = (e) => { if (e.touches?.length > 1) e.preventDefault(); };
    document.addEventListener('touchmove', prevent, { passive: false });
    document.addEventListener('gesturestart', prevent, { passive: false });
    // Fullscreen change listener
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('touchmove', prevent);
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const startTimeRef    = useRef(null);
  const timerIntervalRef= useRef(null);
  const controlsRef     = useRef(null);   // ref al MapControls de Three.js

  const boardSize = Math.max(difficulty.rows, difficulty.cols);
  const maxDist   = boardSize * 1.75;

  // ── Timer ────────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => clearInterval(timerIntervalRef.current), []);
  useEffect(() => () => clearInterval(timerIntervalRef.current), []);

  // ── Partículas ───────────────────────────────────────────────────────────────
  const addParticle = useCallback((type, r, c, diff) => {
    const d = diff || difficulty;
    const id = ++particleIdCounter;
    setParticleEvents(prev => [
      ...prev.slice(-15),
      { id, type, x: c - (d.cols / 2 - 0.5), z: r - (d.rows / 2 - 0.5) },
    ]);
    setTimeout(() => setParticleEvents(prev => prev.filter(e => e.id !== id)), 1300);
  }, [difficulty]);

  // ── Iniciar / cambiar dificultad ─────────────────────────────────────────────────────────
  // fullReset=true → desde menú o botón de reinicio (reposiciona cámara)
  // fullReset=false → desde pills de dificultad en HUD (mantén zoom, solo recentra)
  const startGame = useCallback((diff, fullReset = true) => {
    initAudio();
    resetAudio(nightMode);
    stopTimer();
    setIsNewRecord(false);
    setShowConfetti(false);
    setDifficulty(diff);
    setBoardSync(generateEmptyBoard(diff.rows, diff.cols));
    setParticleEvents([]);
    setElapsedTime(0);
    startTimeRef.current = null;
    setCameraFullReset(fullReset);
    setCameraResetKey(k => k + 1);
    setGameState('playing');
  }, [stopTimer, nightMode]);

  // ── Revelar ──────────────────────────────────────────────────────────────────
  const handleReveal = useCallback((r, c) => {
    if (gameState !== 'playing') return;
    
    const prevBoard = boardRef.current;
    if (!prevBoard || prevBoard.length === 0) return;

    const cell = prevBoard[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    const isFirstMove = prevBoard.every(row => row.every(cl => !cl.isRevealed));
    const newBoard = prevBoard.map(row => row.map(cl => ({ ...cl })));

    if (isFirstMove) {
      placeMines(newBoard, difficulty.rows, difficulty.cols, difficulty.mines, r, c);
      startTimer();
    }

    if (newBoard[r][c].isMine) {
      newBoard[r][c].isRevealed = true;
      newBoard[r][c].exploded   = true;

      // ── Cascada de minas: revelar de una en una con delay desde el epicentro ──
      // Paso 1: mostrar solo la mina explotada
      setBoardSync(newBoard.map(row => row.map(cl => ({ ...cl }))));
      addParticle('explosion', r, c);
      playExplosion();
      haptic([80, 40, 80]);
      stopTimer();
      setGameState('lost');

      // Paso 2: ir revelando el resto de minas en ola desde el epicentro
      const mines = [];
      for (let rr = 0; rr < difficulty.rows; rr++)
        for (let cc = 0; cc < difficulty.cols; cc++)
          if (newBoard[rr][cc].isMine && !(rr === r && cc === c))
            mines.push({ rr, cc, dist: Math.hypot(rr - r, cc - c) });
      mines.sort((a, b) => a.dist - b.dist);

      mines.forEach(({ rr, cc }, i) => {
        setTimeout(() => {
          setBoard(prev => {
            const nb = prev.map(row => row.map(cl => ({ ...cl })));
            nb[rr][cc].isRevealed = true;
            boardRef.current = nb;
            return nb;
          });
        }, 80 + i * 40);
      });
      return;
    }

    // ── Chording: click en celda revelada con número ──
    if (newBoard[r][c].isRevealed && newBoard[r][c].neighborMines > 0) {
      const chordResult = chordReveal(boardRef.current, r, c, difficulty.rows, difficulty.cols);
      if (!chordResult) return; // no aplica chording
      if (chordResult.hitMine) {
        setBoardSync(chordResult.board);
        addParticle('explosion', r, c);
        playExplosion();
        stopTimer();
        setGameState('lost');
        return;
      }
      const prevCount = boardRef.current.reduce((s, row) => s + row.filter(cl => cl.isRevealed).length, 0);
      const nowCount  = chordResult.board.reduce((s, row) => s + row.filter(cl => cl.isRevealed).length, 0);
      setBoardSync(chordResult.board);
      addParticle('dirt', r, c);
      playReveal(nowCount - prevCount);
      if (checkWinCondition(chordResult.board)) {
        const isNR = saveRecord(difficulty.name, elapsedTime);
        setIsNewRecord(isNR); refreshRecords();
        playWin();
        haptic([30, 20, 30, 20, 60]);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
        stopTimer();
        setGameState('won');
      }
      return;
    }

    const prevRevealed = boardRef.current.reduce((s, row) => s + row.filter(cl => cl.isRevealed).length, 0);

    const revealed = revealEmptyCells(newBoard, r, c, difficulty.rows, difficulty.cols);
    const nowRevealed = revealed.reduce((s, row) => s + row.filter(cl => cl.isRevealed).length, 0);
    const revealCount = nowRevealed - prevRevealed;

    setBoardSync(revealed);
    addParticle('dirt', r, c);
    playReveal(revealCount);

    if (checkWinCondition(revealed)) {
      const isNR = saveRecord(difficulty.name, elapsedTime);
      setIsNewRecord(isNR); refreshRecords();
      playWin();
      haptic([30, 20, 30, 20, 60]);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      stopTimer();
      setGameState('won');
    }
  }, [gameState, difficulty, addParticle, startTimer, stopTimer, setBoardSync, elapsedTime, refreshRecords]);

  // ── Bandera ──────────────────────────────────────────────────────────────────
  const handleFlag = useCallback((r, c) => {
    if (gameState !== 'playing') return;
    
    const prevBoard = boardRef.current;
    if (!prevBoard || prevBoard.length === 0) return;
    
    const cell = prevBoard[r][c];
    if (cell.isRevealed) return;
    
    const newBoard = prevBoard.map(row => row.map(cl => ({ ...cl })));
    const newCell = newBoard[r][c];

    if (!newCell.isFlagged) {
      const flagsPlaced = prevBoard.reduce((sum, row) => sum + row.filter(cl => cl.isFlagged).length, 0);
      if (difficulty.mines - flagsPlaced <= 0) return;
      newCell.isFlagged = true;
    } else {
      newCell.isFlagged = false;
    }
    
    setBoardSync(newBoard);
    playFlag();
    haptic([30]); // vibración corta al poner bandera (móvil)
  }, [gameState, difficulty, setBoardSync]);

  const handleToggleNightMode = () => {
    setNightMode(n => {
      setAudioNightMode(!n);
      return !n;
    });
  };

  const handleToggleMute = () => {
    setIsMuted(toggleAudioMute());
  };

  // ── Temas ────────────────────────────────────────────────────────────────────
  const bg = nightMode ? '#0f1923' : '#ddeeff';
  const skyProps = nightMode
    ? { sunPosition: [0, -1, 0], turbidity: 20, rayleigh: 0.1 }
    : { sunPosition: [1, 0.35, 0.2], turbidity: 0.4, rayleigh: 0.25 };

  const isGameOver = gameState === 'won' || gameState === 'lost';
  const isViewing  = gameState === 'viewing';

  // Calcular banderas restantes dinámicamente
  const flagsPlaced = board.reduce((sum, row) => sum + row.filter(cell => cell.isFlagged).length, 0);
  const flagsLeft = board.length > 0 ? difficulty.mines - flagsPlaced : difficulty.mines;
  
  // UI first move check
  const isFirstMoveUI = board.length === 0 || board.every(row => row.every(cell => !cell.isRevealed));

  // ── Estilos ───────────────────────────────────────────────────────────────────
  const iconBtn = {
    width: 38, height: 38, borderRadius: '50%', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'transparent',
  };

  const diffBtnStyle = (active) => ({
    padding: '4px 11px', borderRadius: '20px', border: 'none', cursor: 'pointer',
    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
    background: active ? 'linear-gradient(135deg,#66bb6a,#388e3c)' : nightMode ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.55)',
    color: active ? '#fff' : nightMode ? '#aaa' : '#555',
    backdropFilter: 'blur(6px)',
    transition: 'all 0.2s',
  });

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>

      {/* ── Canvas 3D ── */}
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 18, 12], fov: 45 }} style={{ background: bg }} shadows>
        <fog attach="fog" args={[bg, 15, 30]} />
        <Environment preset={nightMode ? "night" : "sunset"} />
        <ambientLight intensity={nightMode ? 0.18 : 0.6} color={nightMode ? '#3a4a6a' : '#fff8e1'} />
        <directionalLight
          position={nightMode ? [-5, 10, -5] : [10, 14, 8]}
          intensity={nightMode ? 0.3 : 1.15}
          color={nightMode ? '#b8d4f0' : '#fff9c4'}
          castShadow={false}
        />
        <Sky distance={450000} {...skyProps} />

        {/* Controlador de cámara */}
        <CameraController
          difficulty={difficulty}
          resetKey={cameraResetKey}
          fullReset={cameraFullReset}
          controlsRef={controlsRef}
        />

        {gameState !== 'menu' && board.length > 0 && (
          <>
            <GameScene
              board={board}
              onReveal={handleReveal}
              onFlag={handleFlag}
              difficulty={difficulty}
              gameState={gameState}
              nightMode={nightMode}
              particleEvents={particleEvents}
            />
            <Atmosphere nightMode={nightMode} boardSize={boardSize} />
          </>
        )}

        <MapControls
          ref={controlsRef}
          enableRotate={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={maxDist}
          touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        />
      </Canvas>

      {/* ── UI Overlay ── */}
      {/* IMPORTANTE: pointer-events:none en el wrapper, pointer-events:auto en los hijos interactivos */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>

        {/* HUD */}
        {gameState !== 'menu' && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', boxSizing: 'border-box', pointerEvents: 'auto' }}>

            {/* Izquierda: banderas + tiempo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div className={nightMode ? 'glass-dark' : 'glass'} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '6px 14px', borderRadius: '16px' }}>
                <Flag size={15} color="#e53935" />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: nightMode ? '#fff' : '#222' }}>{flagsLeft}</span>
              </div>
              {!isFirstMoveUI && (
                <div className={nightMode ? 'glass-dark' : 'glass'} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '4px 14px', borderRadius: '16px', fontSize: '0.8rem', color: nightMode ? '#aaa' : '#555' }}>
                  ⏱ {formatTime(elapsedTime)}
                </div>
              )}
            </div>

            {/* Derecha */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <motion.button whileTap={{ scale: 0.88 }} onClick={toggleFullscreen}
                  className={nightMode ? 'glass-dark' : 'glass'} style={iconBtn}>
                  {isFullscreen ? <Minimize size={17} color={nightMode ? '#90caf9' : '#546e7a'} /> : <Maximize size={17} color={nightMode ? '#90caf9' : '#546e7a'} />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={handleToggleMute}
                  className={nightMode ? 'glass-dark' : 'glass'} style={iconBtn}>
                  {isMuted ? <VolumeX size={17} color="#e53935" /> : <Volume2 size={17} color={nightMode ? '#90caf9' : '#546e7a'} />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={handleToggleNightMode}
                  className={nightMode ? 'glass-dark' : 'glass'} style={iconBtn}>
                  {nightMode ? <Sun size={17} color="#ffd54f" /> : <Moon size={17} color="#546e7a" />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => startGame(difficulty, false)}
                  className={nightMode ? 'glass-dark' : 'glass'} style={iconBtn}>
                  <RefreshCcw size={17} color={nightMode ? '#90caf9' : '#546e7a'} />
                </motion.button>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {Object.entries(DIFFICULTIES).map(([key, diff]) => (
                  <motion.button key={key} whileTap={{ scale: 0.88 }}
                    onClick={() => startGame(diff, difficulty.name !== diff.name)}  /* resetea cámara solo si cambia la dificultad */
                    style={diffBtnStyle(difficulty.name === diff.name)}>
                    {diff.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Menú principal ── */}
        <AnimatePresence>
          {gameState === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', damping: 18 }}
              className="glass-dark"
              style={{
                pointerEvents: 'auto',
                padding: '2rem 2.4rem',
                borderRadius: '26px',
                textAlign: 'center',
                minWidth: '290px',
                margin: 'auto',
              }}
            >
              <p style={{ margin: '0 0 0.3rem 0', opacity: 0.5, color: '#ccc', fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Buscaminas 3D
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.4rem' }}>
                {Object.values(DIFFICULTIES).map((diff) => (
                  <motion.button key={diff.name} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    className="btn" onClick={() => startGame(diff)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.8rem' }}>
                      <span>{diff.name}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                        <span style={{ opacity: 0.55, fontSize: '0.72em' }}>{diff.mines} minas · {diff.rows}×{diff.cols}</span>
                        {records[diff.name] && (
                          <span style={{ opacity: 0.9, fontSize: '0.68em', color: '#a5d6a7', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Trophy size={9} /> {formatTime(records[diff.name])}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
              <div style={{ marginTop: '1.2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <motion.button whileTap={{ scale: 0.9 }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: nightMode ? '#90caf9' : '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                  onClick={handleToggleNightMode}>
                  {nightMode ? <Sun size={14} /> : <Moon size={14} />}
                  {nightMode ? 'Modo Día' : 'Modo Noche'}
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: nightMode ? '#90caf9' : '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                  onClick={() => setShowHelp(true)}>
                  <HelpCircle size={14} /> Cómo jugar
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Panel de fin de partida ── */}
          {isGameOver && !isViewing && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, y: 70 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', damping: 16, delay: 0.1 }}
              className={nightMode ? 'glass-dark' : 'glass'}
              style={{
                pointerEvents: 'auto',
                padding: '1.6rem 2rem', borderRadius: '24px',
                textAlign: 'center', marginTop: 'auto', marginBottom: '2rem', minWidth: '260px',
              }}
            >
              <div style={{ fontSize: '2.2rem' }}>{gameState === 'won' ? '🎉' : '💥'}</div>
              <h2 style={{ color: nightMode ? '#fff' : '#212121', margin: '0.5rem 0 0.25rem', fontSize: '1.5rem' }}>
                {gameState === 'won' ? '¡Misión Cumplida!' : '¡BOOM!'}
              </h2>
              {isNewRecord && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', delay: 0.4, damping: 10 }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'linear-gradient(135deg,#ffd54f,#ff8f00)', color: '#000', borderRadius: '12px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.5rem' }}
                >
                  <Trophy size={12} /> ¡NUEVO RÉCORD!
                </motion.div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', marginBottom: '1.3rem', color: nightMode ? '#90caf9' : '#666', fontSize: '1rem' }}>
                <span>⏱</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatTime(elapsedTime)}</span>
                {records[difficulty.name] && !isNewRecord && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(récord: {formatTime(records[difficulty.name])})</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <motion.button whileTap={{ scale: 0.96 }} className="btn" onClick={() => startGame(difficulty, false)}>
                  Intentar de nuevo
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                  onClick={() => setGameState('viewing')}>
                  <Eye size={16} /> Ver tablero
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Botón "Nueva partida" en modo ver tablero ── */}
          {isViewing && (
            <motion.div
              key="viewing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ marginTop: 'auto', marginBottom: '2rem', pointerEvents: 'auto' }}
            >
              <motion.button whileTap={{ scale: 0.95 }} className="btn" onClick={() => startGame(difficulty, false)}>
                Nueva partida
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Modal de ayuda ── */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              key="help"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto', backdropFilter: 'blur(4px)', zIndex: 20,
              }}
              onClick={() => setShowHelp(false)}
            >
              <motion.div
                className="glass-dark"
                onClick={e => e.stopPropagation()}
                style={{ padding: '2rem', borderRadius: '24px', maxWidth: '320px', width: '90%', position: 'relative' }}
              >
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => setShowHelp(false)}
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}
                ><X size={18} /></motion.button>
                <h3 style={{ color: '#fff', margin: '0 0 1.2rem', fontSize: '1.1rem' }}>¿Cómo jugar?</h3>
                {[
                  ['🖱️ / 👆', 'Clic / Tap para destapar una casilla'],
                  ['⏱️ Mantén', 'Mantén presionado para poner o quitar una bandera'],
                  ['🔢 + 🚩', 'Clic en un número con todas sus banderas puestas para revelar vecinos automáticamente (Chording)'],
                  ['🚩', 'Las banderas marcan posibles minas'],
                  ['✅', 'Ganas cuando destapar todas las casillas sin minas'],
                ].map(([icon, text]) => (
                  <div key={icon} style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.85rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0, width: '2rem' }}>{icon}</span>
                    <span style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confetti al ganar — canvas 2D separado, sin costo en el canvas 3D */}
      <Confetti active={showConfetti} />
    </div>
  );
}

export default App;
