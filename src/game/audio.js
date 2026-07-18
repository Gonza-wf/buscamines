import * as Tone from 'tone';

let isInitialized = false;
let isMuted = false;

// Sintetizadores para efectos
let revealSynth;
let flagSynth;
let explodeSynth;
let winSynth;

// Sintetizadores para ambiente
let windNoise;
let windFilter;
let droneSynth;
let birdSynth;
let cricketSynth;
let cricketFilter;

let droneLoop;
let birdLoop;
let cricketLoop;

let isNightMode = false;

// Escala pentatónica para los descubrimientos en cadena (muy relajante)
const pentatonicScale = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];
let revealIndex = 0;
let revealTimeout = null;

export const initAudio = async () => {
  if (isInitialized) return;
  await Tone.start();
  
  // ─── Efectos de sonido ──────────────────────────────────────────

  revealSynth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3,
    modulationIndex: 2,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 1 },
    modulation: { type: 'square' },
    modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.2 }
  }).toDestination();
  revealSynth.volume.value = -12;

  flagSynth = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 2,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
  }).toDestination();
  flagSynth.volume.value = -6;

  explodeSynth = new Tone.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 0.05, decay: 0.8, sustain: 0.4, release: 2 }
  });
  const explodeFilter = new Tone.Filter(600, 'lowpass').toDestination();
  explodeSynth.connect(explodeFilter);
  explodeSynth.volume.value = 0;

  winSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 2 }
  }).toDestination();
  winSynth.volume.value = -10;

  // ─── Ambiente y Música Zen ──────────────────────────────────────

  // Viento (Ruido rosa con filtro paso-bajo)
  windNoise = new Tone.Noise('pink');
  windFilter = new Tone.Filter({
    type: 'lowpass',
    frequency: 300,
    rolloff: -24,
    Q: 1
  }).toDestination();
  windNoise.connect(windFilter);
  windNoise.volume.value = -30;
  windNoise.start();

  // Acordes suaves (Drone)
  droneSynth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 0.5,
    modulationIndex: 1.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 4, decay: 4, sustain: 1, release: 8 }
  }).toDestination();
  droneSynth.volume.value = -22;

  const progressions = [
    // 1. Progresión original (Relajante / Estable)
    [
      ['C3', 'G3', 'C4', 'E4'],
      ['F2', 'C3', 'A3', 'C4'],
      ['A2', 'E3', 'C4', 'E4'],
      ['G2', 'D3', 'B3', 'D4']
    ],
    // 2. Progresión etérea (Modo Lidio / Soñadora)
    [
      ['F2', 'A2', 'C3', 'E3'],
      ['G2', 'B2', 'D3', 'F#3'],
      ['E2', 'G2', 'B2', 'E3'],
      ['F2', 'A2', 'C3', 'E3']
    ],
    // 3. Progresión suspendida (Misteriosa / Flotante)
    [
      ['C3', 'G3', 'D4'],
      ['F2', 'C3', 'G3'],
      ['G2', 'D3', 'A3'],
      ['C3', 'G3', 'D4']
    ]
  ];
  let progIndex = 0;
  let chordIndex = 0;
  let cycleCount = 0;

  droneLoop = new Tone.Loop(time => {
    const currentProgression = progressions[progIndex];
    droneSynth.triggerAttackRelease(currentProgression[chordIndex], "4m", time);
    
    chordIndex++;
    if (chordIndex >= currentProgression.length) {
      chordIndex = 0;
      cycleCount++;
      // Cambiar de melodía suavemente cada 2 ciclos (aprox. 1 minuto)
      if (cycleCount >= 2) {
        cycleCount = 0;
        progIndex = (progIndex + 1) % progressions.length;
      }
    }
    // Modular el viento sutilmente para darle vida
    windFilter.frequency.rampTo(250 + Math.random() * 200, 4);
  }, "4m").start(0);

  // Pájaros (Micromelodías aleatorias muy agudas)
  birdSynth = new Tone.FMSynth({
    harmonicity: 2.1,
    modulationIndex: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.1, sustain: 0.1, release: 0.3 },
    modulation: { type: 'triangle' }
  }).toDestination();
  birdSynth.volume.value = -26;

  birdLoop = new Tone.Loop(time => {
    if (isNightMode) return; // No hay pájaros de noche
    if (Math.random() > 0.6) {
      const note = 1000 + Math.random() * 800; // Frecuencias altas (pájaros)
      birdSynth.triggerAttackRelease(note, "16n", time);
      if (Math.random() > 0.5) {
        birdSynth.triggerAttackRelease(note + 200, "16n", time + 0.15);
      }
    }
  }, "2m").start(1);

  // Grillos (Ruido blanco filtrado en banda muy alta con pulsos rápidos)
  cricketSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.05 }
  });
  
  cricketFilter = new Tone.Filter({
    type: 'bandpass',
    frequency: 6000,
    Q: 80
  }).toDestination();
  
  cricketSynth.connect(cricketFilter);
  cricketSynth.volume.value = -18;

  cricketLoop = new Tone.Loop(time => {
    if (!isNightMode) return; // Solo de noche
    // Probabilidad alta de hacer un "chirp"
    if (Math.random() > 0.4) {
      const chirps = Math.floor(Math.random() * 3) + 2; // 2 a 4 pulsos rápidos
      for (let i = 0; i < chirps; i++) {
        cricketSynth.triggerAttackRelease("64n", time + i * 0.04);
      }
    }
  }, "4n").start(2);

  // Iniciar la música de fondo
  Tone.Transport.bpm.value = 60;
  Tone.Transport.start();

  // Respetar estado previo si el usuario mutó antes de iniciar
  Tone.Destination.mute = isMuted;
  isInitialized = true;
};

// Efecto de revelar (arpegio mágico si se revelan muchas de golpe)
export const playReveal = (count = 1) => {
  if (!isInitialized || isMuted) return;
  try {
    const now = Tone.now();
    // Limitar el arpegio a 8 notas como máximo para que no sea muy largo
    const notesToPlay = Math.min(count, 8);
    for (let i = 0; i < notesToPlay; i++) {
      const note = pentatonicScale[(revealIndex + i) % pentatonicScale.length];
      revealSynth.triggerAttackRelease(note, 0.1, now + i * 0.06);
    }
    
    revealIndex = (revealIndex + notesToPlay) % pentatonicScale.length;
    if (revealTimeout) clearTimeout(revealTimeout);
    revealTimeout = setTimeout(() => { revealIndex = 0; }, 1000);
  } catch (e) {
    console.error("Audio error in playReveal:", e);
  }
};

export const playFlag = () => {
  if (!isInitialized || isMuted) return;
  try {
    flagSynth.triggerAttackRelease("C3", 0.05);
  } catch (e) {
    console.error("Audio error in playFlag:", e);
  }
};

export const playExplosion = () => {
  if (!isInitialized || isMuted) return;
  try {
    explodeSynth.triggerAttackRelease(1.5);
    // Apagar la música relajante gradualmente
    droneSynth.releaseAll();
    windNoise.volume.rampTo(-60, 2);
  } catch (e) {
    console.error("Audio error in playExplosion:", e);
  }
};

export const playWin = () => {
  if (!isInitialized || isMuted) return;
  try {
    const now = Tone.now();
    winSynth.triggerAttackRelease("C4", 0.2, now);
    winSynth.triggerAttackRelease("E4", 0.2, now + 0.15);
    winSynth.triggerAttackRelease("G4", 0.2, now + 0.3);
    winSynth.triggerAttackRelease("C5", 1.0, now + 0.45);
  } catch (e) {
    console.error("Audio error in playWin:", e);
  }
};

export const toggleAudioMute = () => {
  isMuted = !isMuted;
  if (isInitialized) {
    Tone.Destination.mute = isMuted;
  }
  return isMuted;
};

export const isAudioMuted = () => isMuted;

export const resetAudio = (isNight) => {
  if (!isInitialized) return;
  try {
    setAudioNightMode(isNight); // Restore volume to normal mode settings
  } catch(e) {
    console.error("Audio error in resetAudio:", e);
  }
};

export const setAudioNightMode = (isNight) => {
  if (!isInitialized) return;
  isNightMode = isNight;
  
  if (isNight) {
    // Ambiente de noche: Viento más sordo, grillos
    windFilter.frequency.rampTo(200, 2);
    droneSynth.volume.rampTo(-26, 2);
  } else {
    // Ambiente de día: Pájaros y viento fresco
    windFilter.frequency.rampTo(300, 2);
    droneSynth.volume.rampTo(-22, 2);
  }
};
