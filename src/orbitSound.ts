function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function synth(kind: "tick" | "seat", sr: number) {
  // Fine, high, very short "tsk" modelled on the reference: energy at 7-11 kHz, ~1 ms to -20 dB, ~5 ms total.
  const P = kind === "tick"
    ? { dur: .006, seed: 7, bp: Math.min(8400, sr * .18), q: 2.4, nDecay: .0006, ring: [Math.min(9300, sr * .2), .0009, .22] }
    : { dur: .007, seed: 11, bp: Math.min(7800, sr * .17), q: 1.6, nDecay: .0007, ring: [Math.min(8200, sr * .17), .001, .15] };
  const n = Math.floor(P.dur * sr), out = new Float32Array(n), r = rng(P.seed);
  const w0 = 2 * Math.PI * P.bp / sr, al = Math.sin(w0) / (2 * P.q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, xi = r() * 2 - 1;
    const y = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = y;
    const att = Math.min(1, t / .00012), fade = Math.min(1, (n - i) / (sr * .0015));
    const [fr = 0, dc = .001, g = 0] = P.ring;
    out[i] = (y * Math.exp(-t / P.nDecay) + Math.sin(2 * Math.PI * fr * t) * Math.exp(-t / dc) * g) * att * fade;
    peak = Math.max(peak, Math.abs(out[i]!));
  }
  for (let i = 0; i < n; i++) out[i] = out[i]! * .9 / peak;
  return out;
}
export function createOrbitSound() {
  let context: AudioContext | undefined;
  let buffers: Partial<Record<"tick" | "seat", AudioBuffer>> = {};
  let last = -Infinity;
  let flip = false;
  const random = rng(42);
  return {
    prepare() {
      try {
        if (!context) {
          context = new AudioContext();
          for (const kind of ["tick", "seat"] as const) {
            const samples = synth(kind, context.sampleRate);
            const buffer = context.createBuffer(1, samples.length, context.sampleRate);
            buffer.copyToChannel(samples, 0);
            buffers[kind] = buffer;
          }
        }
        if (context.state === "suspended") void context.resume().catch(() => {});
      } catch {}
    },
    play(kind: "tick" | "seat", speed = 0) {
      const buffer = buffers[kind];
      if (!context || !buffer || context.state !== "running") return;
      const now = performance.now();
      if (kind === "tick" && now - last < 16) return;
      if (kind === "tick") { last = now; flip = !flip; }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = kind === "seat" ? .14 : (.24 + .05 * random()) * (Math.abs(speed) > 12 ? .8 : 1);
      source.playbackRate.value = kind === "seat" ? 1 : (flip ? 1 : .9) * (1 + (random() - .5) * .08);
      source.connect(gain).connect(context.destination);
      source.start();
    },
    close() { if (context) void context.close().catch(() => {}); context = undefined; buffers = {}; },
  };
}
