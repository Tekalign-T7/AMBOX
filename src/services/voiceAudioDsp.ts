import { CircuitComponentValues } from './chapter2Dsp';

export const VOICE_SAMPLE_RATE = 44100;
export const AUDIBLE_FC_HZ = 4500; // Audible RF carrier so Baseband, LSB (1.1-4.3 kHz), Carrier (4.5 kHz), and USB (4.7-7.9 kHz) are all clearly audible

export type VoiceTrackId = 'baseband' | 'usb' | 'lsb' | 'modulated' | 'demodulated';
export type AuditionDomain = 'rf' | 'rx';

export interface VoiceBufferSource {
  name: string;
  isDefault: boolean;
  sampleRate: number;
  samples: Float32Array;
  durationSec: number;
}

export interface ProcessedVoiceTracks {
  sampleRate: number;
  durationSec: number;
  baseband: Float32Array;
  usbRF: Float32Array;
  lsbRF: Float32Array;
  usbRx: Float32Array;
  lsbRx: Float32Array;
  modulated: Float32Array;
  demodulated: Float32Array;
  // Precomputed spectral magnitudes (0..10 kHz) for visual USB/Carrier/LSB inspection
  spectra: Record<
    VoiceTrackId,
    { freqsHz: number[]; mags: number[] }
  >;
}

// ============================================================================
// FAST RADIX-2 FFT & HILBERT TRANSFORM
// ============================================================================
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function fftInPlace(re: Float64Array, im: Float64Array, invert: boolean): void {
  const N = re.length;
  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let k = N >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const ang = ((invert ? 2 : -2) * Math.PI) / len;
    const wStepR = Math.cos(ang);
    const wStepI = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let wr = 1;
      let wi = 0;
      for (let k = 0; k < half; k++) {
        const idx1 = i + k;
        const idx2 = i + k + half;
        const tr = wr * re[idx2] - wi * im[idx2];
        const ti = wr * im[idx2] + wi * re[idx2];
        re[idx2] = re[idx1] - tr;
        im[idx2] = im[idx1] - ti;
        re[idx1] += tr;
        im[idx1] += ti;
        const nwr = wr * wStepR - wi * wStepI;
        wi = wr * wStepI + wi * wStepR;
        wr = nwr;
      }
    }
  }

  if (invert) {
    for (let i = 0; i < N; i++) {
      re[i] /= N;
      im[i] /= N;
    }
  }
}

export function computeHilbertAudio(signal: Float32Array): Float32Array {
  const len = signal.length;
  const N = nextPow2(len);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < len; i++) {
    re[i] = signal[i];
  }

  fftInPlace(re, im, false);

  // Multiply positive frequencies by -j, negative frequencies by +j
  re[0] = 0;
  im[0] = 0;
  const half = N >> 1;
  re[half] = 0;
  im[half] = 0;
  for (let k = 1; k < half; k++) {
    const rPos = re[k];
    const iPos = im[k];
    re[k] = iPos;
    im[k] = -rPos;

    const kn = N - k;
    const rNeg = re[kn];
    const iNeg = im[kn];
    re[kn] = -iNeg;
    im[kn] = rNeg;
  }

  fftInPlace(re, im, true);

  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = re[i];
  }
  return out;
}

// ============================================================================
// BIQUAD FILTERS FOR SPEECH BANDLIMITING & FORMANT SYNTHESIS
// ============================================================================
function applyBandpassSpeechFilter(input: Float32Array, fs: number): Float32Array {
  const N = input.length;
  const M = nextPow2(N);
  const re = new Float64Array(M);
  const im = new Float64Array(M);
  for (let i = 0; i < N; i++) re[i] = input[i];

  fftInPlace(re, im, false);

  // Communications speech band: 220 Hz .. 3400 Hz with smooth cosine roll-off
  const fLow = 220;
  const fHigh = 3400;
  const transLow = 80;
  const transHigh = 350;

  for (let k = 0; k < M; k++) {
    const f = k <= M / 2 ? (k * fs) / M : ((M - k) * fs) / M;
    let gain = 1;
    if (f < fLow - transLow || f > fHigh + transHigh) {
      gain = 0;
    } else if (f < fLow) {
      const u = (f - (fLow - transLow)) / transLow;
      gain = 0.5 * (1 - Math.cos(Math.PI * u));
    } else if (f > fHigh) {
      const u = (fHigh + transHigh - f) / transHigh;
      gain = 0.5 * (1 - Math.cos(Math.PI * u));
    }
    re[k] *= gain;
    im[k] *= gain;
  }

  fftInPlace(re, im, true);

  const out = new Float32Array(N);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const v = re[i];
    out[i] = v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  if (peak > 1e-6) {
    const scale = 0.88 / peak;
    for (let i = 0; i < N; i++) out[i] *= scale;
  }
  return out;
}

function lowpassAudio(input: Float32Array, cutoffHz: number, fs: number): Float32Array {
  const N = input.length;
  const out = new Float32Array(N);
  const fc = Math.max(80, Math.min(cutoffHz, fs * 0.44));
  const wc = Math.tan((Math.PI * fc) / fs);
  const k1 = Math.SQRT2 * wc;
  const k2 = wc * wc;
  const norm = 1 / (1 + k1 + k2);
  const b0 = k2 * norm;
  const b1 = 2 * b0;
  const b2 = b0;
  const a1 = 2 * (k2 - 1) * norm;
  const a2 = (1 - k1 + k2) * norm;

  // Cascade 2 passes (4th-order) for crisp carrier rejection
  const tmp = new Float32Array(N);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < N; i++) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    tmp[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  for (let i = 0; i < N; i++) {
    const x0 = tmp[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

function highpassDCBlock(input: Float32Array, cutoffHz: number, fs: number): Float32Array {
  const N = input.length;
  const out = new Float32Array(N);
  const r = Math.exp((-2 * Math.PI * cutoffHz) / fs);
  let prevX = input[0] || 0;
  let prevY = 0;
  for (let i = 0; i < N; i++) {
    const x = input[i];
    const y = x - prevX + r * prevY;
    out[i] = y;
    prevX = x;
    prevY = y;
  }
  return out;
}

function normalizePeak(input: Float32Array, targetPeak = 0.86): Float32Array {
  let peak = 0;
  for (let i = 0; i < input.length; i++) {
    const a = Math.abs(input[i]);
    if (a > peak) peak = a;
  }
  if (peak < 1e-6) return input;
  const out = new Float32Array(input.length);
  const g = targetPeak / peak;
  for (let i = 0; i < input.length; i++) out[i] = input[i] * g;
  return out;
}

// ============================================================================
// DEFAULT VOICE SYNTHESIZER (Multi-Syllable Klatt-Style Formant Speech)
// Speaks clear articulated vowel-consonant syllables across 3.2 seconds:
// "ah-eh-oo ... ee-oh-ah ... ss-ee ... oo-ah"
// ============================================================================
interface PhonemeSegment {
  duration: number;
  f0Start: number;
  f0End: number;
  F1: number;
  F2: number;
  F3: number;
  voiced: number;
  fricative: number;
}

const DEFAULT_PHONEMES: PhonemeSegment[] = [
  // Silence lead-in
  { duration: 0.08, f0Start: 130, f0End: 130, F1: 500, F2: 1500, F3: 2500, voiced: 0.0, fricative: 0.0 },
  // "He-" (/h/ + /ɛ/)
  { duration: 0.07, f0Start: 132, f0End: 136, F1: 550, F2: 1850, F3: 2550, voiced: 0.15, fricative: 0.55 },
  { duration: 0.24, f0Start: 136, f0End: 146, F1: 550, F2: 1800, F3: 2550, voiced: 0.95, fricative: 0.02 },
  // "-llo" (/l/ + /oʊ/)
  { duration: 0.10, f0Start: 146, f0End: 142, F1: 360, F2: 1100, F3: 2450, voiced: 0.72, fricative: 0.0 },
  { duration: 0.28, f0Start: 142, f0End: 124, F1: 460, F2: 880, F3: 2350, voiced: 0.92, fricative: 0.0 },
  // Short pause
  { duration: 0.12, f0Start: 124, f0End: 126, F1: 450, F2: 1200, F3: 2400, voiced: 0.0, fricative: 0.0 },
  // "Upper" (/ʌ/ + /p/ + /ɚ/)
  { duration: 0.20, f0Start: 144, f0End: 150, F1: 640, F2: 1200, F3: 2400, voiced: 0.94, fricative: 0.0 },
  { duration: 0.07, f0Start: 146, f0End: 142, F1: 420, F2: 1150, F3: 2200, voiced: 0.05, fricative: 0.35 },
  { duration: 0.22, f0Start: 142, f0End: 130, F1: 490, F2: 1350, F3: 1750, voiced: 0.88, fricative: 0.02 },
  // "side-" (/s/ + /aɪ/)
  { duration: 0.14, f0Start: 134, f0End: 136, F1: 400, F2: 1800, F3: 2800, voiced: 0.0, fricative: 0.72 },
  { duration: 0.26, f0Start: 138, f0End: 148, F1: 720, F2: 1280, F3: 2500, voiced: 0.96, fricative: 0.0 },
  { duration: 0.14, f0Start: 148, f0End: 142, F1: 310, F2: 2250, F3: 2950, voiced: 0.85, fricative: 0.0 },
  // "-band" (/b/ + /æ/ + /n/)
  { duration: 0.06, f0Start: 136, f0End: 136, F1: 320, F2: 1100, F3: 2200, voiced: 0.25, fricative: 0.1 },
  { duration: 0.26, f0Start: 136, f0End: 126, F1: 660, F2: 1720, F3: 2450, voiced: 0.95, fricative: 0.0 },
  { duration: 0.14, f0Start: 126, f0End: 118, F1: 280, F2: 1450, F3: 2350, voiced: 0.65, fricative: 0.0 },
  // Short pause
  { duration: 0.12, f0Start: 120, f0End: 124, F1: 400, F2: 1400, F3: 2400, voiced: 0.0, fricative: 0.0 },
  // "Lower" (/l/ + /oʊ/ + /ɚ/)
  { duration: 0.10, f0Start: 134, f0End: 138, F1: 360, F2: 1050, F3: 2450, voiced: 0.72, fricative: 0.0 },
  { duration: 0.22, f0Start: 138, f0End: 128, F1: 440, F2: 860, F3: 2320, voiced: 0.92, fricative: 0.0 },
  { duration: 0.22, f0Start: 128, f0End: 116, F1: 490, F2: 1350, F3: 1750, voiced: 0.86, fricative: 0.0 },
  // "check" (/tʃ/ + /ɛ/ + /k/)
  { duration: 0.09, f0Start: 126, f0End: 130, F1: 420, F2: 1950, F3: 2700, voiced: 0.0, fricative: 0.68 },
  { duration: 0.20, f0Start: 132, f0End: 118, F1: 540, F2: 1840, F3: 2560, voiced: 0.90, fricative: 0.0 },
  { duration: 0.08, f0Start: 118, f0End: 116, F1: 400, F2: 1500, F3: 2300, voiced: 0.0, fricative: 0.30 },
  // Tail silence
  { duration: 0.12, f0Start: 116, f0End: 116, F1: 400, F2: 1400, F3: 2300, voiced: 0.0, fricative: 0.0 },
];

export function generateDefaultVoiceBuffer(fs = VOICE_SAMPLE_RATE): VoiceBufferSource {
  const totalDuration = DEFAULT_PHONEMES.reduce((acc, p) => acc + p.duration, 0);
  const totalSamples = Math.floor(totalDuration * fs);
  const raw = new Float32Array(totalSamples);

  // Deterministic pseudo-random generator for crisp repeatable fricatives
  let seed = 133742;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  // Three formant resonator states (2nd-order IIR)
  let y1a = 0, y1b = 0;
  let y2a = 0, y2b = 0;
  let y3a = 0, y3b = 0;

  let glottalPhase = 0;
  let segIdx = 0;
  let segStartSample = 0;
  let segSamples = Math.max(1, Math.floor(DEFAULT_PHONEMES[0].duration * fs));

  // Smooth formant parameters to avoid clicks between phonemes
  let curF1 = DEFAULT_PHONEMES[0].F1;
  let curF2 = DEFAULT_PHONEMES[0].F2;
  let curF3 = DEFAULT_PHONEMES[0].F3;
  let curVoiced = 0;
  let curFric = 0;

  const evalResonator = (
    x: number,
    freq: number,
    bw: number,
    s1: number,
    s2: number
  ): [number, number, number] => {
    const r = Math.exp((-Math.PI * bw) / fs);
    const a1 = -2 * r * Math.cos((2 * Math.PI * freq) / fs);
    const a2 = r * r;
    const g = 1 + a1 + a2;
    const y = g * x - a1 * s1 - a2 * s2;
    return [y, y, s1];
  };

  for (let n = 0; n < totalSamples; n++) {
    while (segIdx < DEFAULT_PHONEMES.length - 1 && n - segStartSample >= segSamples) {
      segStartSample += segSamples;
      segIdx++;
      segSamples = Math.max(1, Math.floor(DEFAULT_PHONEMES[segIdx].duration * fs));
    }
    const seg = DEFAULT_PHONEMES[segIdx];
    const u = Math.min(1, (n - segStartSample) / segSamples);

    const alpha = 0.0045; // ~5 ms smooth vocal tract coarticulation
    curF1 += (seg.F1 - curF1) * alpha;
    curF2 += (seg.F2 - curF2) * alpha;
    curF3 += (seg.F3 - curF3) * alpha;
    curVoiced += (seg.voiced - curVoiced) * 0.008;
    curFric += (seg.fricative - curFric) * 0.012;

    const f0 =
      seg.f0Start + (seg.f0End - seg.f0Start) * u + 1.8 * Math.sin((2 * Math.PI * 5.2 * n) / fs);
    glottalPhase += f0 / fs;
    if (glottalPhase >= 1) glottalPhase -= 1;

    // Rosenberg glottal pulse (rich natural harmonic slope)
    let glottal = 0;
    const tp = 0.42;
    const tn = 0.16;
    if (glottalPhase < tp) {
      glottal = 0.5 * (1 - Math.cos((Math.PI * glottalPhase) / tp));
    } else if (glottalPhase < tp + tn) {
      glottal = Math.cos((Math.PI * (glottalPhase - tp)) / (2 * tn));
    }
    // Differentiate glottal pulse (lip radiation +6 dB/oct)
    const glottalDeriv = glottal - 0.5;

    const exc = curVoiced * glottalDeriv + curFric * 0.45 * rand();

    // Cascade + parallel vocal tract resonances
    const [r1, ny1a, ny1b] = evalResonator(exc, curF1, 65, y1a, y1b);
    y1a = ny1a;
    y1b = ny1b;

    const [r2, ny2a, ny2b] = evalResonator(r1 * 0.8 + exc * 0.25, curF2, 95, y2a, y2b);
    y2a = ny2a;
    y2b = ny2b;

    const [r3, ny3a, ny3b] = evalResonator(r2 * 0.7 + exc * 0.2, curF3, 140, y3a, y3b);
    y3a = ny3a;
    y3b = ny3b;

    raw[n] = 0.55 * r1 + 0.35 * r2 + 0.2 * r3;
  }

  const clean = applyBandpassSpeechFilter(raw, fs);
  return {
    name: 'Default Voice (Articulated Speech)',
    isDefault: true,
    sampleRate: fs,
    samples: clean,
    durationSec: clean.length / fs,
  };
}

// ============================================================================
// AUDIO FILE / MIC DECODER & RESAMPLER
// ============================================================================
export async function decodeAudioBlobToVoice(
  blob: Blob,
  name: string,
  targetFs = VOICE_SAMPLE_RATE
): Promise<VoiceBufferSource> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arrayBuf = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    const srcRate = decoded.sampleRate;
    const chCount = decoded.numberOfChannels;
    const maxSrcSamples = Math.min(decoded.length, Math.floor(srcRate * 7.5)); // cap at 7.5s for snappy real-time DSP

    // Mix down to mono
    const monoSrc = new Float32Array(maxSrcSamples);
    for (let c = 0; c < chCount; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < maxSrcSamples; i++) {
        monoSrc[i] += ch[i] / chCount;
      }
    }

    // Linear resample to targetFs
    const targetLen = Math.max(1024, Math.floor((maxSrcSamples * targetFs) / srcRate));
    const resampled = new Float32Array(targetLen);
    const ratio = (maxSrcSamples - 1) / Math.max(1, targetLen - 1);
    for (let i = 0; i < targetLen; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(maxSrcSamples - 1, i0 + 1);
      const frac = pos - i0;
      resampled[i] = monoSrc[i0] * (1 - frac) + monoSrc[i1] * frac;
    }

    const clean = applyBandpassSpeechFilter(resampled, targetFs);
    return {
      name,
      isDefault: false,
      sampleRate: targetFs,
      samples: clean,
      durationSec: clean.length / targetFs,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ============================================================================
// COMPUTE AUDIO SPECTRUM (0 .. 10 kHz) FOR VISUALIZING LSB / CARRIER / USB
// ============================================================================
function computeAudioSpectrum10k(signal: Float32Array, fs: number): { freqsHz: number[]; mags: number[] } {
  const N = 4096;
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  // Average energy across a representative active segment near middle of clip
  const start = Math.max(0, Math.min(signal.length - N, Math.floor(signal.length * 0.25)));
  const len = Math.min(N, signal.length - start);
  for (let i = 0; i < len; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, len - 1)));
    re[i] = signal[start + i] * w;
  }

  fftInPlace(re, im, false);

  const maxFreq = 10000;
  const maxBin = Math.min(N / 2, Math.floor((maxFreq * N) / fs));
  const freqsHz: number[] = [];
  const mags: number[] = [];
  let peak = 0;

  for (let k = 0; k <= maxBin; k++) {
    const f = (k * fs) / N;
    const m = Math.hypot(re[k], im[k]);
    freqsHz.push(f);
    mags.push(m);
    if (m > peak) peak = m;
  }

  if (peak > 1e-9) {
    for (let i = 0; i < mags.length; i++) {
      mags[i] /= peak;
    }
  }

  return { freqsHz, mags };
}

// ============================================================================
// FULL REAL-TIME VOICE MODULATION & DEMODULATION ENGINE (DSB-FC, DSB-SC, SSB, VSB)
// ============================================================================
export interface VoiceProcessingParams {
  topic: 'conventional-am' | 'dsb-sc' | 'ssb' | 'vsb';
  Ac: number;
  mu: number;
  rcTimeMs: number;
  amModulatorMode: 'linear' | 'square-law';
  dsbTopology: 'product' | 'ring';
  dsbRxMode: 'coherent' | 'costas';
  loPhaseErrorDeg: number;
  loFreqOffsetHz: number;
  costasInitDeg: number;
  costasGain: number;
  ssbSideband: 'USB' | 'LSB';
  ssbMethod: 'phase' | 'frequency';
  ssbFilterOrder: number;
  ssbPhaseErrDeg: number;
  vsbVestigeRatio: number;
  vsbSkew: number;
  circuit: CircuitComponentValues;
}

export function processVoiceThroughScheme(
  voice: VoiceBufferSource,
  params: VoiceProcessingParams
): ProcessedVoiceTracks {
  const fs = voice.sampleRate;
  const m = voice.samples;
  const N = m.length;
  const mHat = computeHilbertAudio(m);
  const fc = AUDIBLE_FC_HZ;

  const usbRF = new Float32Array(N);
  const lsbRF = new Float32Array(N);
  const modulated = new Float32Array(N);

  // Build pure USB & LSB passband signals first
  for (let i = 0; i < N; i++) {
    const t = i / fs;
    const cosC = Math.cos(2 * Math.PI * fc * t);
    const sinC = Math.sin(2 * Math.PI * fc * t);
    usbRF[i] = 0.72 * (m[i] * cosC - mHat[i] * sinC);
    lsbRF[i] = 0.72 * (m[i] * cosC + mHat[i] * sinC);
  }

  // Coherent demodulation of USB and LSB individually (for receiver-baseband listening)
  const usbMix = new Float32Array(N);
  const lsbMix = new Float32Array(N);
  const phiRadTopic =
    params.topic === 'ssb'
      ? (params.ssbPhaseErrDeg * Math.PI) / 180
      : (params.loPhaseErrorDeg * Math.PI) / 180;

  for (let i = 0; i < N; i++) {
    const t = i / fs;
    const lo = 2 * Math.cos(2 * Math.PI * fc * t + phiRadTopic);
    usbMix[i] = usbRF[i] * lo;
    lsbMix[i] = lsbRF[i] * lo;
  }
  const usbRx = normalizePeak(lowpassAudio(usbMix, 3500, fs), 0.85);
  const lsbRx = normalizePeak(lowpassAudio(lsbMix, 3500, fs), 0.85);

  // Demodulated output for the active scheme
  let demodulated: Float32Array = new Float32Array(N);

  if (params.topic === 'conventional-am') {
    const { mu, rcTimeMs, amModulatorMode, circuit } = params;
    const biasGain =
      amModulatorMode === 'square-law'
        ? 0.7 / Math.max(0.25, circuit.amTxVbbV)
        : circuit.amTxRfK / Math.max(0.5, circuit.amTxR1K);
    const effMu = Math.min(2.2, mu * biasGain);

    for (let i = 0; i < N; i++) {
      const t = i / fs;
      const env = 1 + effMu * m[i];
      const lin = env * Math.cos(2 * Math.PI * fc * t);
      modulated[i] = amModulatorMode === 'square-law' ? lin + 0.08 * lin * lin : lin;
    }

    // Half-wave diode + RC envelope detector scaled to fc = 4.5 kHz
    // Ideal RC for fc=4.5kHz, fm~1kHz is around 0.4-0.7 ms; map slider [0.05..2.0 ms] directly with scale 1.4x
    const tauSec = Math.max(0.00008, (rcTimeMs / 1000) * 1.4);
    const decay = Math.exp(-1 / (fs * tauSec));
    const rcOut = new Float32Array(N);
    let vc = 0;
    for (let i = 0; i < N; i++) {
      const s = modulated[i];
      const rect = s > 0 ? s : 0;
      if (rect >= vc) {
        vc = rect;
      } else {
        vc *= decay;
      }
      rcOut[i] = vc;
    }
    const acOnly = highpassDCBlock(rcOut, 95, fs);
    demodulated = normalizePeak(lowpassAudio(acOnly, 3800, fs), 0.85);
  } else if (params.topic === 'dsb-sc') {
    const { loPhaseErrorDeg, loFreqOffsetHz, dsbRxMode, costasInitDeg, costasGain } = params;
    for (let i = 0; i < N; i++) {
      const t = i / fs;
      modulated[i] = m[i] * Math.cos(2 * Math.PI * fc * t);
    }

    const mix = new Float32Array(N);
    if (dsbRxMode === 'costas') {
      let phi = (costasInitDeg * Math.PI) / 180;
      const stepScale = costasGain * 0.00045;
      for (let i = 0; i < N; i++) {
        const t = i / fs;
        const s = modulated[i];
        const iArm = s * 2 * Math.cos(2 * Math.PI * fc * t + phi);
        const qArm = s * 2 * Math.sin(2 * Math.PI * fc * t + phi);
        const err = iArm * qArm;
        phi -= stepScale * err;
        mix[i] = iArm;
      }
    } else {
      const phi = (loPhaseErrorDeg * Math.PI) / 180;
      // Scale RF offset slightly into audible beating range (e.g., 10-250 Hz -> 2-25 Hz audible flutter)
      const fOffAud = loFreqOffsetHz * 0.08;
      for (let i = 0; i < N; i++) {
        const t = i / fs;
        mix[i] = modulated[i] * 2 * Math.cos(2 * Math.PI * (fc + fOffAud) * t + phi);
      }
    }

    // Preserve quadrature null attenuation instead of normalizing tiny residual noise
    const filtered = lowpassAudio(mix, 3500, fs);
    const phiAbs = Math.abs(loPhaseErrorDeg);
    if (dsbRxMode === 'coherent' && Math.abs(phiAbs - 90) < 3 && loFreqOffsetHz === 0) {
      // Near quadrature null: keep signal nearly silent as cos(phi) -> 0
      demodulated = filtered;
    } else {
      demodulated = normalizePeak(filtered, 0.85);
    }
  } else if (params.topic === 'ssb') {
    const { ssbSideband, ssbMethod, ssbFilterOrder, ssbPhaseErrDeg } = params;
    const unwantedLeak =
      ssbMethod === 'frequency'
        ? Math.max(0.02, 0.55 / Math.max(1, ssbFilterOrder))
        : 0;

    for (let i = 0; i < N; i++) {
      const primary = ssbSideband === 'USB' ? usbRF[i] : lsbRF[i];
      const secondary = ssbSideband === 'USB' ? lsbRF[i] : usbRF[i];
      modulated[i] = primary + unwantedLeak * secondary;
    }

    const phi = (ssbPhaseErrDeg * Math.PI) / 180;
    const mix = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / fs;
      mix[i] = modulated[i] * 2 * Math.cos(2 * Math.PI * fc * t + phi);
    }
    demodulated = normalizePeak(lowpassAudio(mix, 3500, fs), 0.85);
  } else {
    // VSB: Full USB + shaped vestige of LSB around fc
    const { vsbVestigeRatio, vsbSkew } = params;
    const W = 3400;
    const fv = Math.max(180, W * vsbVestigeRatio);
    const M = nextPow2(N);
    const re = new Float64Array(M);
    const im = new Float64Array(M);

    for (let i = 0; i < N; i++) {
      const t = i / fs;
      re[i] = m[i] * Math.cos(2 * Math.PI * fc * t); // DSB-SC input to VSB filter
    }
    fftInPlace(re, im, false);

    for (let k = 0; k < M; k++) {
      const f = k <= M / 2 ? (k * fs) / M : ((M - k) * fs) / M;
      let H = 0;
      if (f >= fc + fv) {
        H = f <= fc + W + 400 ? 1 : 0;
      } else if (f <= fc - fv) {
        H = 0;
      } else {
        // Complementary odd-symmetric transition across [fc - fv, fc + fv]
        const u = (f - fc) / fv; // -1 .. +1
        H = Math.max(0, Math.min(1, 0.5 + 0.5 * u + vsbSkew * (1 - u * u)));
      }
      re[k] *= H;
      im[k] *= H;
    }
    fftInPlace(re, im, true);
    for (let i = 0; i < N; i++) {
      modulated[i] = re[i] * 1.4;
    }

    const mix = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / fs;
      mix[i] = modulated[i] * 2 * Math.cos(2 * Math.PI * fc * t);
    }
    demodulated = normalizePeak(lowpassAudio(mix, 3600, fs), 0.85);
  }

  const modNorm = normalizePeak(modulated, 0.82);

  return {
    sampleRate: fs,
    durationSec: N / fs,
    baseband: m,
    usbRF: normalizePeak(usbRF, 0.82),
    lsbRF: normalizePeak(lsbRF, 0.82),
    usbRx,
    lsbRx,
    modulated: modNorm,
    demodulated,
    spectra: {
      baseband: computeAudioSpectrum10k(m, fs),
      usb: computeAudioSpectrum10k(usbRF, fs),
      lsb: computeAudioSpectrum10k(lsbRF, fs),
      modulated: computeAudioSpectrum10k(modNorm, fs),
      demodulated: computeAudioSpectrum10k(demodulated, fs),
    },
  };
}
