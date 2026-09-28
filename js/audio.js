// Gem TD - Procedural Web Audio Sound Engine (Zero external dependencies)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterVolume = 0.35;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.2, pitchDecay = true) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (pitchDecay) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.4), now + duration);
      }

      gain.gain.setValueAtTime(gainVal * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }

  // Gem placed: crystalline ping
  playGemPlace() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [880, 1320, 1760].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.12, 0.15, false);
      }, idx * 25);
    });
  }

  // Keep Gem: glorious bell
  playKeepGem() {
    if (this.muted) return;
    this.ensureContext();
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.35, 0.25, false);
      }, idx * 60);
    });
  }

  // Special Tower Combine: mystical fanfare
  playCombine() {
    if (this.muted) return;
    this.ensureContext();
    const chords = [440, 554.37, 659.25, 880, 1108.73];
    chords.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.5, 0.28, false);
      }, idx * 80);
    });
  }

  // Shoot projectile
  playShoot(type = 'normal') {
    if (this.muted) return;
    this.ensureContext();
    if (type === 'rapid') {
      this.playTone(900, 'sawtooth', 0.04, 0.08, true);
    } else if (type === 'pierce') {
      this.playTone(1200, 'square', 0.08, 0.12, true);
    } else if (type === 'ice') {
      this.playTone(1500, 'sine', 0.10, 0.12, true);
    } else {
      this.playTone(600, 'triangle', 0.07, 0.12, true);
    }
  }

  // Projectile impact
  playHit(isCrit = false) {
    if (this.muted) return;
    this.ensureContext();
    if (isCrit) {
      this.playTone(1600, 'sawtooth', 0.2, 0.3, true);
      setTimeout(() => this.playTone(900, 'triangle', 0.2, 0.25, true), 30);
    } else {
      this.playTone(280, 'sine', 0.05, 0.15, true);
    }
  }

  // Splash explosion
  playExplosion() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // White noise buffer for explosion
      const bufferSize = this.ctx.sampleRate * 0.25;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now);
      filter.frequency.exponentialRampToValueAtTime(50, now + 0.25);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4 * this.masterVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
    } catch (e) {}
  }

  // Chain lightning crackle
  playLightning() {
    if (this.muted) return;
    this.ensureContext();
    this.playTone(800, 'sawtooth', 0.08, 0.2, true);
    setTimeout(() => this.playTone(1200, 'sawtooth', 0.08, 0.18, true), 40);
  }

  // Creep death & gold drop
  playKill(isBoss = false) {
    if (this.muted) return;
    this.ensureContext();
    if (isBoss) {
      this.playExplosion();
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 'sine', 0.25, 0.25, false), i * 70);
      });
    } else {
      // Coin jingle
      this.playTone(987.77, 'sine', 0.09, 0.18, false);
      setTimeout(() => this.playTone(1318.51, 'sine', 0.14, 0.22, false), 50);
    }
  }

  // Life lost
  playLifeLost() {
    if (this.muted) return;
    this.ensureContext();
    this.playTone(130, 'sawtooth', 0.35, 0.45, true);
  }

  // Wave start horn
  playWaveStart() {
    if (this.muted) return;
    this.ensureContext();
    const notes = [220, 277.18, 329.63, 440];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.4, 0.25, false), i * 90);
    });
  }

  // Wave clear
  playWaveClear() {
    if (this.muted) return;
    this.ensureContext();
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.25, 0.2, false), i * 80);
    });
  }

  // Chance upgrade / purchase
  playUpgrade() {
    if (this.muted) return;
    this.ensureContext();
    [440, 660, 880, 1100].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.15, 0.2, false), i * 50);
    });
  }

  // Button click
  playClick() {
    if (this.muted) return;
    this.ensureContext();
    this.playTone(400, 'sine', 0.04, 0.1, true);
  }

  // Error / Invalid action
  playError() {
    if (this.muted) return;
    this.ensureContext();
    this.playTone(180, 'sawtooth', 0.15, 0.3, false);
    setTimeout(() => this.playTone(140, 'sawtooth', 0.2, 0.3, false), 100);
  }

  // Trap armed
  playTrapPlace() {
    if (this.muted) return;
    this.ensureContext();
    this.playTone(600, 'square', 0.06, 0.15, true);
    setTimeout(() => this.playTone(900, 'sine', 0.1, 0.15, false), 50);
  }

  // Trap triggered
  playTrapTrigger() {
    if (this.muted) return;
    this.ensureContext();
    this.playTone(280, 'sawtooth', 0.25, 0.3, true);
    setTimeout(() => this.playTone(150, 'triangle', 0.3, 0.35, true), 40);
  }

  // Rune socketed into tower
  playRuneSocket() {
    if (this.muted) return;
    this.ensureContext();
    [587.33, 880, 1174.66, 1760].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.25, 0.22, false), i * 45);
    });
  }

  // Tower relocated / swapped
  playTeleport() {
    if (this.muted) return;
    this.ensureContext();
    [300, 450, 600, 900, 1200].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.12, 0.2, true), i * 35);
    });
  }

  // Castle heal
  playHeal() {
    if (this.muted) return;
    this.ensureContext();
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.25, false), i * 60);
    });
  }
}

export const SOUND = new SoundEngine();
