// PROCEDURAL AUDIO ENGINE V3 (Cyberpunk/Tech)
// High-tech, gritty, and futuristic UI sounds.

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Only initialize on user interaction to comply with browser autoplay policies
const initAudio = () => {
  try {
    if (!audioCtx) {
      // @ts-ignore
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.25; // Reduced global volume to 25%
        masterGain.connect(audioCtx.destination);
      }
    }
    
    // Always try to resume if suspended
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch((e) => console.warn("Audio resume prevented:", e));
    }
    
    return audioCtx;
  } catch (e) {
    console.warn("Audio Init Failed:", e);
    return null;
  }
};

// --- HOVER: "Telemetry Chirp" ---
// Removed at architect request to reduce sensory noise
export const playHover = () => {
    // Operation Decommissioned
};

// --- CLICK: "Servo Lock" ---
export const playClick = () => {
  try {
    const ctx = initAudio();
    if (!ctx || !masterGain || ctx.state !== 'running') return;
    
    const t = ctx.currentTime;

    // 1. The "Kick"
    const oscLow = ctx.createOscillator();
    const gainLow = ctx.createGain();
    
    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(200, t);
    oscLow.frequency.exponentialRampToValueAtTime(50, t + 0.15); 
    
    gainLow.gain.setValueAtTime(0.8, t);
    gainLow.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    oscLow.connect(gainLow);
    gainLow.connect(masterGain);

    // 2. The "Servo"
    const oscHigh = ctx.createOscillator();
    const gainHigh = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscHigh.type = 'sawtooth';
    oscHigh.frequency.setValueAtTime(800, t);
    oscHigh.frequency.exponentialRampToValueAtTime(200, t + 0.1);

    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.linearRampToValueAtTime(500, t + 0.1);

    gainHigh.gain.setValueAtTime(0.15, t);
    gainHigh.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    oscHigh.connect(filter);
    filter.connect(gainHigh);
    gainHigh.connect(masterGain);

    oscLow.start(t);
    oscHigh.start(t);
    oscLow.stop(t + 0.2);
    oscHigh.stop(t + 0.2);
  } catch (e) {
    // Silent fail
  }
};

// --- SUCCESS: "System Override" ---
export const playSuccess = () => {
  try {
    const ctx = initAudio();
    if (!ctx || !masterGain || ctx.state !== 'running') return;
    
    const t = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50]; 
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const start = t + (i * 0.04);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.linearRampToValueAtTime(freq * 1.01, start + 0.3);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

      osc.connect(gain);
      gain.connect(masterGain!);
      
      osc.start(start);
      osc.stop(start + 0.6);
    });

    const noiseBufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.Q.value = 10;
    noiseFilter.frequency.setValueAtTime(1000, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(8000, t + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, t);
    noiseGain.gain.linearRampToValueAtTime(0, t + 0.5);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    
    noise.start(t);
  } catch (e) {
    // Silent fail
  }
};