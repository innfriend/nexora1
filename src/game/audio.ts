/**
 * 100% procedural Web Audio API sound synthesizer for Nexora Games.
 * Generates engine note, gear shifts, nitro turbine boost, tire screech, collisions,
 * countdown beeps, split chimes, and UI feedback.
 */
export class RaceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;

  private nitroGain: GainNode | null = null;
  private nitroOsc: OscillatorNode | null = null;

  private skidGain: GainNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidSource: AudioBufferSourceNode | null = null;

  private enabled = true;
  private volume = 0.75;
  private running = false;
  private lastCollisionAt = 0;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupNodes();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private setupNodes(): void {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.enabled ? this.volume : 0;
    this.masterGain.connect(this.ctx.destination);

    // Engine voice: sawtooth + triangle sub through resonant lowpass
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 260;
    this.engineFilter.Q.value = 2.2;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.oscPrimary = this.ctx.createOscillator();
    this.oscPrimary.type = 'sawtooth';
    this.oscPrimary.frequency.value = 55;

    this.oscSub = this.ctx.createOscillator();
    this.oscSub.type = 'triangle';
    this.oscSub.frequency.value = 27.5;

    this.oscPrimary.connect(this.engineFilter);
    this.oscSub.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.oscPrimary.start();
    this.oscSub.start();

    // Nitro Turbine Booster Layer
    this.nitroOsc = this.ctx.createOscillator();
    this.nitroOsc.type = 'sine';
    this.nitroOsc.frequency.value = 240;

    this.nitroGain = this.ctx.createGain();
    this.nitroGain.gain.value = 0;

    this.nitroOsc.connect(this.nitroGain);
    this.nitroGain.connect(this.masterGain);
    this.nitroOsc.start();

    // Tire skid noise loop
    const sampleRate = this.ctx.sampleRate;
    const bufferLength = sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.skidSource = this.ctx.createBufferSource();
    this.skidSource.buffer = noiseBuffer;
    this.skidSource.loop = true;

    this.skidFilter = this.ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1350;
    this.skidFilter.Q.value = 4.5;

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.value = 0;

    this.skidSource.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.masterGain);
    this.skidSource.start();
  }

  public setSettings(enabled: boolean, volume: number): void {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.enabled ? this.volume : 0,
        this.ctx.currentTime,
        0.04,
      );
    }
  }

  public setDrivingState(
    active: boolean,
    rpmRatio: number,
    throttle: boolean,
    skidIntensity: number,
    nitroActive = false,
  ): void {
    if (
      !this.ctx ||
      !this.engineGain ||
      !this.oscPrimary ||
      !this.oscSub ||
      !this.engineFilter ||
      !this.skidGain
    ) {
      return;
    }
    this.running = active;
    const now = this.ctx.currentTime;

    if (!active || !this.enabled) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      this.skidGain.gain.setTargetAtTime(0, now, 0.06);
      if (this.nitroGain) {
        this.nitroGain.gain.setTargetAtTime(0, now, 0.06);
      }
      return;
    }

    const clampedRpm = Math.max(0, Math.min(1, rpmRatio));
    const nitroPitch = nitroActive ? 1.18 : 1.0;
    const baseFreq = (48 + clampedRpm * 145) * nitroPitch;
    this.oscPrimary.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);

    const filterCutoff =
      220 + clampedRpm * 950 + (throttle ? 260 : 0) + (nitroActive ? 520 : 0);
    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);

    const targetEngineVol =
      0.075 + (throttle ? 0.055 : 0.015) + clampedRpm * 0.04 + (nitroActive ? 0.035 : 0);
    this.engineGain.gain.setTargetAtTime(targetEngineVol, now, 0.06);

    if (this.nitroGain && this.nitroOsc) {
      this.nitroOsc.frequency.setTargetAtTime(260 + clampedRpm * 240, now, 0.05);
      this.nitroGain.gain.setTargetAtTime(nitroActive ? 0.065 : 0, now, 0.05);
    }

    const clampedSkid = Math.max(0, Math.min(1, skidIntensity));
    this.skidGain.gain.setTargetAtTime(clampedSkid * 0.14, now, 0.04);
    if (this.skidFilter) {
      this.skidFilter.frequency.setTargetAtTime(1150 + clampedSkid * 650, now, 0.05);
    }
  }

  public playNitroBurst(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.16);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playPerfectLaunch(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    [523.25, 783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = this.ctx.currentTime + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playSplitDelta(isFaster: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const notes = isFaster ? [659.25, 987.77] : [392.0, 329.63];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  public playCollision(impactStrength: number): void {
    if (!this.ctx || !this.masterGain || !this.enabled || !this.running) return;
    const nowMs = performance.now();
    if (nowMs - this.lastCollisionAt < 140) return;
    this.lastCollisionAt = nowMs;

    const now = this.ctx.currentTime;
    const strength = Math.max(0.2, Math.min(1, impactStrength));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);

    gain.gain.setValueAtTime(0.28 * strength, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playCountdownTone(isGo: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

    const duration = isGo ? 0.36 : 0.18;
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playLapChime(isFinish: boolean): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const notes = isFinish ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const start = this.ctx.currentTime + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  public playUiClick(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.045);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public dispose(): void {
    try {
      this.oscPrimary?.stop();
      this.oscSub?.stop();
      this.nitroOsc?.stop();
      this.skidSource?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore cleanup errors
    }
    this.ctx = null;
  }
}
