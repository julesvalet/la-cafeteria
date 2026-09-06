/** Small, original Web Audio score. Audio is only unlocked by an explicit gesture. */
export class CasinoAudio {
  private context: AudioContext | null = null;
  private musicTimer: ReturnType<typeof setInterval> | undefined;
  async unlock() {
    try { this.context ??= new AudioContext(); await this.context.resume(); } catch { /* Audio is optional. */ }
  }
  tone(frequency: number, duration: number, delay = 0, type: OscillatorType = 'sine', volume = .055) {
    const ctx = this.context; if (!ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); const at = ctx.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .012);
    gain.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  play(kind: string) {
    if (kind === 'spin') { for (let i = 0; i < 14; i++) this.tone(180 + i * 19, .055, .3 + i * .07, 'triangle', .026); }
    else if (kind === 'bust') { this.tone(150, .4, 0, 'sawtooth', .025); this.tone(92, .5, .14, 'triangle'); }
    else if (kind === 'freeze') [1300, 1000, 700].forEach((n, i) => this.tone(n, .4, i * .09));
    else if (kind === 'double' || kind === 'flip7' || kind === 'saved') [523, 659, 784, 1047].forEach((n, i) => this.tone(n, .35, i * .08));
    else { this.tone(784, .2); this.tone(1047, .3, .09); }
  }
  music(enabled: boolean) {
    clearInterval(this.musicTimer);
    if (!enabled) return;
    let beat = 0; const notes = [196, 247, 294, 330, 294, 247, 220, 165];
    this.musicTimer = setInterval(() => { this.tone(notes[beat++ % notes.length], .5, 0, 'triangle', .013); }, 480);
  }
  dispose() { clearInterval(this.musicTimer); void this.context?.close(); this.context = null; }
}
