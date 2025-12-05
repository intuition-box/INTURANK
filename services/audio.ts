// PROCEDURAL AUDIO ENGINE V3 (Cyberpunk/Tech)
// High-tech, gritty, and futuristic UI sounds.

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

const initAudio = () => {
  try {
    if (!audioCtx) {
      // @ts-ignore
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.25; // Reduced global volume to 25% to prevent loudness issues
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    // Graceful fallback for browsers blocking audio or non-standard environments
    console.warn("Audio Init Failed:", e);
    return null;
  }
};

// --- HOVER: "Telemetry Chirp" ---
// A rapid, high-tech data flutter.
export const playHover = () => {
  try {
    const ctx = initAudio();
    if (!ctx || !masterGain) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // FM Synthesis for "Flutter" effect
    // Carrier: High pitch sine
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    
    // Modulator: Square wave for "digital" texture (Ring Mod style)
    const modulator = ctx.createOscillator();
    modulator.type = 'square';
    modulator.frequency.setValueAtTime(40, t); // Fast flutter (40Hz)

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(300, t); // Depth of flutter

    modulator.connect(modGain);
    modGain.connect(osc.frequency);
    
    osc.connect(gain);
    gain.connect(masterGain);

    // Envelope: Short, sharp, percussive
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.start(t);
    modulator.start(t);
    osc.stop(t + 0.1);
    modulator.stop(t + 0.1);
  } catch (e) {
    // Ignore audio errors during playback
  }
};

// --- CLICK: "Servo Lock" ---
// A punchy, mechanical engagement sound.
export const playClick = () => {
  try {
    const ctx = initAudio();
    if (!ctx || !masterGain) return;
    const t = ctx.currentTime;

    // 1. The "Kick" (Low impact)
    const oscLow = ctx.createOscillator();
    const gainLow = ctx.createGain();
    
    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(200, t);
    oscLow.frequency.exponentialRampToValueAtTime(50, t + 0.15); // Pitch drop
    
    gainLow.gain.setValueAtTime(0.8, t);
    gainLow.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    oscLow.connect(gainLow);
    gainLow.connect(masterGain);

    // 2. The "Servo" (High tech zip)
    const oscHigh = ctx.createOscillator();
    const gainHigh = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscHigh.type = 'sawtooth'; // Gritty
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
    // Ignore audio errors
  }
};

// --- SUCCESS: "System Override" ---
// A futuristic, rising power-up chord.
export const playSuccess = () => {
  try {
    const ctx = initAudio();
    if (!ctx || !masterGain) return;
    const t = ctx.currentTime;

    // Play a rapid arpeggio (C Major 9)
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Slight delay between notes for arpeggio
      const start = t + (i * 0.04);
      
      osc.type = 'triangle'; // Clean but with some body
      osc.frequency.setValueAtTime(freq, start);
      
      // Add a slight pitch bend up for "power up" feel
      osc.frequency.linearRampToValueAtTime(freq * 1.01, start + 0.3);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

      osc.connect(gain);
      gain.connect(masterGain!);
      
      osc.start(start);
      osc.stop(start + 0.6);
    });

    // Add a "Sparkle" Noise Sweep
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
    noiseFilter.frequency.exponentialRampToValueAtTime(8000, t + 0.5); // Upward sweep

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, t);
    noiseGain.gain.linearRampToValueAtTime(0, t + 0.5);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    
    noise.start(t);
  } catch (e) {
    // Ignore audio errors
  }
};