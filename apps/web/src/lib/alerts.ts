// Gentle sound and vibration for timers (workout rest, cook-mode step timers).

let audio: AudioContext | null = null;

/** Create or resume the audio context. Call from a tap so mobile browsers allow sound later. */
export function primeAudio() {
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

/** A soft two-note chime. */
export function chime() {
  const ctx = audio;
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime + 0.02;
  for (const [freq, at] of [
    [784, 0],
    [1046.5, 0.17],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.14, t0 + at + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + 0.95);
  }
}

export function buzz() {
  try {
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    // Not supported.
  }
}
