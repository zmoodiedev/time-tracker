// Little sensory rewards: synthesized sounds (no audio files), haptics and confetti.
import confetti from "canvas-confetti";

let ctx: AudioContext | null = null;
const ac = () => (ctx ??= new AudioContext());

let soundOn = false;
let hapticsOn = true;
export function setFx(sounds: boolean, haptics: boolean) {
  soundOn = sounds;
  hapticsOn = haptics;
}

function tone(freq: number, at: number, dur: number, vol = 0.16) {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + at);
  g.gain.linearRampToValueAtTime(vol, a.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}

function play(notes: number[], gap: number, dur: number) {
  if (!soundOn) return;
  try {
    notes.forEach((f, i) => tone(f, i * gap, dur));
  } catch {
    /* audio not available */
  }
}

export function buzz(pattern: number | number[]) {
  if (hapticsOn && "vibrate" in navigator) navigator.vibrate(pattern);
}

export const fx = {
  start: () => {
    buzz(18);
    play([660, 880], 0.07, 0.18);
  },
  stop: () => {
    buzz([12, 40, 12]);
    play([880, 587], 0.08, 0.2);
  },
  tap: () => buzz(8),
  goal: () => {
    buzz([30, 60, 30, 60, 80]);
    play([523, 659, 784, 1047, 1319], 0.08, 0.45);
    burst();
  },
};

const COLORS = ["#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];

export function burst() {
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: COLORS, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors: COLORS, disableForReducedMotion: true }), 200);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors: COLORS, disableForReducedMotion: true }), 350);
}
