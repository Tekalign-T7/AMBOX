import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Square,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AUDIBLE_FC_HZ,
  AuditionDomain,
  decodeAudioBlobToVoice,
  generateDefaultVoiceBuffer,
  ProcessedVoiceTracks,
  processVoiceThroughScheme,
  VoiceBufferSource,
  VoiceTrackId,
} from '../../services/voiceAudioDsp';
import { CircuitComponentValues, computeSallenKeyCutoffHz } from '../../services/chapter2Dsp';
import { StudioBenchTopic } from '../../views/studio/OverviewStudioView';

type BenchSubTab = 'instrument' | 'receiver' | 'equations';

interface SoundExplanationStep {
  id: string;
  track: VoiceTrackId;
  domain?: AuditionDomain;
  badge: string;
  title: string;
  narration: string;
}

interface VoiceSoundStudioPanelProps {
  topic: StudioBenchTopic;
  subTab: BenchSubTab;
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
  circuitValues: CircuitComponentValues;
}

export const VoiceSoundStudioPanel: React.FC<VoiceSoundStudioPanelProps> = ({
  topic,
  subTab,
  Ac,
  mu,
  rcTimeMs,
  amModulatorMode,
  dsbTopology,
  dsbRxMode,
  loPhaseErrorDeg,
  loFreqOffsetHz,
  costasInitDeg,
  costasGain,
  ssbSideband,
  ssbMethod,
  ssbFilterOrder,
  ssbPhaseErrDeg,
  vsbVestigeRatio,
  vsbSkew,
  circuitValues,
}) => {
  const defaultVoice = useMemo(() => generateDefaultVoiceBuffer(), []);
  const [voiceSource, setVoiceSource] = useState<VoiceBufferSource>(defaultVoice);
  const [auditionDomain, setAuditionDomain] = useState<AuditionDomain>('rf');
  const [activeTrack, setActiveTrack] = useState<VoiceTrackId | null>(null);
  const [isPlayingTrack, setIsPlayingTrack] = useState<boolean>(false);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Mic recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Guided "Explain Whole Thing Using Sound" tour
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [explainStepIdx, setExplainStepIdx] = useState<number>(0);
  const [speakNarrationEnabled, setSpeakNarrationEnabled] = useState<boolean>(true);
  const explainCancelledRef = useRef<boolean>(true);
  const speechFinishRef = useRef<(() => void) | null>(null);
  const audioFinishRef = useRef<(() => void) | null>(null);

  // Web Audio playback refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Process the voice buffer through the exact active AM scheme + circuit parameters
  const processed: ProcessedVoiceTracks = useMemo(() => {
    return processVoiceThroughScheme(voiceSource, {
      topic,
      Ac,
      mu,
      rcTimeMs,
      amModulatorMode,
      dsbTopology,
      dsbRxMode,
      loPhaseErrorDeg,
      loFreqOffsetHz,
      costasInitDeg,
      costasGain,
      ssbSideband,
      ssbMethod,
      ssbFilterOrder,
      ssbPhaseErrDeg,
      vsbVestigeRatio,
      vsbSkew,
      circuit: circuitValues,
    });
  }, [
    voiceSource,
    topic,
    Ac,
    mu,
    rcTimeMs,
    amModulatorMode,
    dsbTopology,
    dsbRxMode,
    loPhaseErrorDeg,
    loFreqOffsetHz,
    costasInitDeg,
    costasGain,
    ssbSideband,
    ssbMethod,
    ssbFilterOrder,
    ssbPhaseErrDeg,
    vsbVestigeRatio,
    vsbSkew,
    circuitValues,
  ]);

  const skCutoffHz = useMemo(() => computeSallenKeyCutoffHz(circuitValues), [circuitValues]);

  // Build topic- and sub-topic-specific spoken + acoustic walkthrough steps
  const explanationSteps: SoundExplanationStep[] = useMemo(() => {
    const isCircuit = subTab === 'receiver';
    const isEquations = subTab === 'equations';

    if (topic === 'conventional-am') {
      return [
        {
          id: 'baseband',
          track: 'baseband',
          domain: 'rf',
          badge: '01 · BASEBAND m(t)',
          title: 'Original Voice Message',
          narration: isCircuit
            ? 'Step one: Your voice enters the bias op-amp set by resistors R1 and Rf between 220 hertz and 3.4 kilohertz. Listen to the clean baseband voice.'
            : 'Step one: Here is your original baseband voice signal m of t, occupying 220 hertz to 3.4 kilohertz before modulation.',
        },
        {
          id: 'usb',
          track: 'usb',
          domain: 'rf',
          badge: '02 · UPPER SIDEBAND (USB)',
          title: 'USB = fc + fm',
          narration:
            'Step two: Upper Sideband, or USB. Multiplication shifts every voice frequency upward above the 4.5 kilohertz carrier, from 4.7 to 7.9 kilohertz. Listen to the USB voice alone.',
        },
        {
          id: 'lsb',
          track: 'lsb',
          domain: 'rf',
          badge: '03 · LOWER SIDEBAND (LSB)',
          title: 'LSB = fc − fm',
          narration:
            'Step three: Lower Sideband, or LSB. Frequencies are mirrored and inverted below the carrier from 1.1 to 4.3 kilohertz, making low formants sound high. Listen to the LSB sound.',
        },
        {
          id: 'modulated',
          track: 'modulated',
          domain: 'rf',
          badge: '04 · DSB-FC PASSBAND',
          title: isCircuit
            ? amModulatorMode === 'square-law'
              ? 'Square-Law Diode + Tank'
              : 'Class-C Collector Tank'
            : `Full Carrier + USB + LSB (μ = ${mu.toFixed(2)})`,
          narration: isCircuit
            ? `Step four: ${
                amModulatorMode === 'square-law'
                  ? 'Nonlinear diode D1 creates cross-terms and parallel tank Lt Ct isolates the carrier plus both USB and LSB.'
                  : 'The Class-C collector tank combines the carrier tone with both USB and LSB.'
              } Listen to the steady carrier whistle alongside both sidebands.`
            : isEquations
            ? `Step four: At modulation index mu equals ${mu.toFixed(2)}, efficiency is ${(
                ((mu * mu) / (2 + mu * mu)) *
                100
              ).toFixed(1)} percent, because most power sits in the constant carrier tone plus USB and LSB.`
            : `Step four: Full Conventional AM combines the 4.5 kilohertz carrier tone with both USB and LSB at modulation index ${mu.toFixed(2)}.`,
        },
        {
          id: 'demodulated',
          track: 'demodulated',
          domain: 'rx',
          badge: '05 · DIODE + RC DEMOD',
          title: 'Envelope Recovery yo(t)',
          narration: isCircuit
            ? `Step five: Diode D1 rectifies the signal and capacitor C discharges through Rl with time constant ${rcTimeMs.toFixed(
                2
              )} milliseconds, then coupling capacitor Cc strips DC. Listen to the recovered voice.`
            : mu > 1
            ? `Step five: Because mu is ${mu.toFixed(2)}, greater than 1, the envelope reverses phase and the diode clips the voice. Listen to the over-modulation distortion.`
            : 'Step five: The diode and RC envelope detector recovers the baseband voice directly from USB and LSB without needing a local oscillator.',
        },
      ];
    }

    if (topic === 'dsb-sc') {
      return [
        {
          id: 'baseband',
          track: 'baseband',
          domain: 'rf',
          badge: '01 · BASEBAND m(t)',
          title: 'Original Voice Message',
          narration:
            'Step one: Original baseband voice m of t entering the balanced modulator before carrier suppression.',
        },
        {
          id: 'usb',
          track: 'usb',
          domain: 'rf',
          badge: '02 · UPPER SIDEBAND (USB)',
          title: 'USB = fc + fm',
          narration:
            'Step two: Half of the DSB-SC power lives in the Upper Sideband above the suppressed carrier. Listen to the USB component.',
        },
        {
          id: 'lsb',
          track: 'lsb',
          domain: 'rf',
          badge: '03 · LOWER SIDEBAND (LSB)',
          title: 'LSB = fc − fm',
          narration:
            'Step three: The other half of the power is mirrored in the Lower Sideband below the carrier. Listen to the inverted LSB component.',
        },
        {
          id: 'modulated',
          track: 'modulated',
          domain: 'rf',
          badge: '04 · DSB-SC SUPPRESSED',
          title: isCircuit
            ? dsbTopology === 'ring'
              ? '4-Diode Ring Bridge'
              : 'Balanced Null Bridge'
            : 'USB + LSB (No Carrier)',
          narration: isCircuit
            ? `Step four: ${
                dsbTopology === 'ring'
                  ? 'The 4-diode ring between transformers T1 and T2 switches polarity at fc, cancelling the carrier completely.'
                  : 'Opposing bridge resistors R1 and R2 null out the carrier in transformer T2.'
              } Listen: the 4.5 kilohertz carrier whistle is gone, leaving only USB and LSB.`
            : 'Step four: DSB-SC transmits 100 percent of power in USB and LSB with zero carrier whistle. Listen to the suppressed-carrier sound.',
        },
        {
          id: 'demodulated',
          track: 'demodulated',
          domain: 'rx',
          badge: dsbRxMode === 'costas' ? '05 · COSTAS I/Q LOOP' : '05 · COHERENT LO + LPF',
          title: 'Synchronous Recovery yo(t)',
          narration:
            dsbRxMode === 'costas'
              ? 'Step five: The Costas I and Q loop locks onto the suppressed carrier phase and the Sallen-Key low-pass filter isolates clean voice.'
              : Math.abs(Math.abs(loPhaseErrorDeg) - 90) < 4
              ? 'Step five: At 90 degrees local oscillator phase error, cosine of 90 is zero, causing a quadrature null. Listen to the voice vanish.'
              : `Step five: Coherent mixing followed by the ${(skCutoffHz / 1000).toFixed(
                  1
                )} kilohertz Sallen-Key filter folds USB and LSB back together cleanly.`,
        },
      ];
    }

    if (topic === 'ssb') {
      return [
        {
          id: 'baseband',
          track: 'baseband',
          domain: 'rf',
          badge: '01 · BASEBAND m(t)',
          title: 'Original Voice Message',
          narration:
            'Step one: Original baseband voice m of t before single-sideband cancellation.',
        },
        {
          id: 'usb',
          track: 'usb',
          domain: 'rf',
          badge: '02 · UPPER SIDEBAND (USB)',
          title: 'USB Only (fc + fm)',
          narration: isCircuit
            ? 'Step two: Using the 90-degree Hilbert branch RH CH, subtracting the quadrature term cancels LSB and leaves pure Upper Sideband. Listen to USB.'
            : 'Step two: Single Sideband USB keeps only frequencies above the carrier, cutting bandwidth in half. Listen to the USB voice.',
        },
        {
          id: 'lsb',
          track: 'lsb',
          domain: 'rf',
          badge: '03 · LOWER SIDEBAND (LSB)',
          title: 'LSB Only (fc − fm)',
          narration: isCircuit
            ? 'Step three: Adding the Hilbert quadrature branch cancels USB and keeps only the inverted Lower Sideband. Listen to LSB.'
            : 'Step three: Lower Sideband LSB keeps only frequencies below the carrier, mirrored in pitch. Listen to the LSB voice.',
        },
        {
          id: 'modulated',
          track: 'modulated',
          domain: 'rf',
          badge: `04 · ACTIVE SSB (${ssbSideband})`,
          title: ssbMethod === 'phase' ? 'Hilbert Phase SSB' : `Crystal BPF (${ssbSideband})`,
          narration: `Step four: Your transmitter is currently set to ${ssbSideband} using the ${
            ssbMethod === 'phase' ? 'Hartley Hilbert phase method' : `order ${ssbFilterOrder} crystal bandpass filter`
          }. Listen to the transmitted ${ssbSideband} signal.`,
        },
        {
          id: 'demodulated',
          track: 'demodulated',
          domain: 'rx',
          badge: '05 · COHERENT SSB RX',
          title: 'Recovered Voice yo(t)',
          narration:
            ssbPhaseErrDeg !== 0
              ? `Step five: With ${ssbPhaseErrDeg} degrees phase error, Hilbert quadrature distortion colors the recovered voice through the Sallen-Key low-pass filter.`
              : `Step five: Coherent down-conversion translates ${ssbSideband} back to baseband, and the Sallen-Key filter restores your natural voice.`,
        },
      ];
    }

    // VSB
    return [
      {
        id: 'baseband',
        track: 'baseband',
        domain: 'rf',
        badge: '01 · BASEBAND m(t)',
        title: 'Original Voice Message',
        narration:
          'Step one: Original baseband voice m of t containing low frequencies close to DC that make brick-wall SSB difficult.',
      },
      {
        id: 'usb',
        track: 'usb',
        domain: 'rf',
        badge: '02 · UPPER SIDEBAND (USB)',
        title: 'Full Transmitted USB',
        narration:
          'Step two: Vestigial Sideband transmits the full Upper Sideband above fc. Listen to the crisp USB spectrum.',
      },
      {
        id: 'lsb',
        track: 'lsb',
        domain: 'rf',
        badge: '03 · LOWER SIDEBAND (LSB)',
        title: 'Full LSB (Before Shaping)',
        narration:
          'Step three: Here is the full Lower Sideband before the VSB shaping filter trims away most of it, leaving only a vestige.',
      },
      {
        id: 'modulated',
        track: 'modulated',
        domain: 'rf',
        badge: `04 · VSB SHAPED (${Math.round(vsbVestigeRatio * 100)}% VESTIGE)`,
        title: isCircuit ? 'LC Ladder + Op-Amp Trap' : 'USB + Vestige fv',
        narration: isCircuit
          ? 'Step four: The passive LC ladder L1 C1 L2 C2 shapes the gradual vestige roll-off while series trap L3 C4 notches out the unwanted LSB.'
          : `Step four: VSB combines full USB with a ${Math.round(
              vsbVestigeRatio * 100
            )} percent vestige slice of LSB around fc. Listen to the shaped VSB passband.`,
      },
      {
        id: 'demodulated',
        track: 'demodulated',
        domain: 'rx',
        badge: '05 · COMPLEMENTARY RX',
        title: 'Sallen-Key Recovery yo(t)',
        narration:
          Math.abs(vsbSkew) > 0.02
            ? `Step five: Because symmetry skew is ${vsbSkew.toFixed(
                2
              )}, complementary symmetry H of f plus fc plus H of f minus fc equals 1 is broken, distorting the low-frequency voice.`
            : 'Step five: Because the vestige transition is odd-symmetric around fc, coherent mixing plus the Sallen-Key filter recovers the voice without distortion.',
      },
    ];
  }, [
    topic,
    subTab,
    amModulatorMode,
    mu,
    rcTimeMs,
    dsbTopology,
    dsbRxMode,
    loPhaseErrorDeg,
    skCutoffHz,
    ssbSideband,
    ssbMethod,
    ssbFilterOrder,
    ssbPhaseErrDeg,
    vsbVestigeRatio,
    vsbSkew,
  ]);

  const stopAudioPlayback = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore already stopped
      }
      sourceNodeRef.current = null;
    }
    if (audioFinishRef.current) {
      const done = audioFinishRef.current;
      audioFinishRef.current = null;
      done();
    }
    setIsPlayingTrack(false);
    setPlayProgress(0);
  }, []);

  const stopExplanation = useCallback(() => {
    explainCancelledRef.current = true;
    setIsExplaining(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (speechFinishRef.current) {
      const done = speechFinishRef.current;
      speechFinishRef.current = null;
      done();
    }
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  // Stop audio cleanly on unmount or when switching main topic
  useEffect(() => {
    return () => {
      explainCancelledRef.current = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  useEffect(() => {
    stopExplanation();
    setActiveTrack(null);
  }, [topic, stopExplanation]);

  const getTrackSamples = useCallback(
    (track: VoiceTrackId, domainOverride?: AuditionDomain): Float32Array => {
      const dom = domainOverride ?? auditionDomain;
      if (track === 'baseband') return processed.baseband;
      if (track === 'usb') return dom === 'rf' ? processed.usbRF : processed.usbRx;
      if (track === 'lsb') return dom === 'rf' ? processed.lsbRF : processed.lsbRx;
      if (track === 'modulated') return processed.modulated;
      return processed.demodulated;
    },
    [auditionDomain, processed]
  );

  const playTrackAsync = useCallback(
    (track: VoiceTrackId, domainOverride?: AuditionDomain): Promise<void> => {
      return new Promise((resolve) => {
        stopAudioPlayback();

        const samples = getTrackSamples(track, domainOverride);
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioCtx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const buffer = ctx.createBuffer(1, samples.length, processed.sampleRate);
        buffer.getChannelData(0).set(samples);

        const src = ctx.createBufferSource();
        src.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.value = 0.85;
        src.connect(gain);
        gain.connect(ctx.destination);

        sourceNodeRef.current = src;
        setActiveTrack(track);
        setIsPlayingTrack(true);
        setPlayProgress(0);

        const startTime = ctx.currentTime;
        const duration = buffer.duration;

        const tick = () => {
          if (!sourceNodeRef.current) return;
          const elapsed = ctx.currentTime - startTime;
          const pct = Math.min(1, Math.max(0, elapsed / Math.max(0.01, duration)));
          setPlayProgress(pct);
          if (pct < 1) {
            rafRef.current = requestAnimationFrame(tick);
          }
        };
        rafRef.current = requestAnimationFrame(tick);

        let settled = false;
        const finishAudio = () => {
          if (!settled) {
            settled = true;
            if (audioFinishRef.current === finishAudio) {
              audioFinishRef.current = null;
            }
            resolve();
          }
        };
        audioFinishRef.current = finishAudio;

        src.onended = () => {
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          if (sourceNodeRef.current === src) {
            sourceNodeRef.current = null;
          }
          setIsPlayingTrack(false);
          setPlayProgress(0);
          finishAudio();
        };

        src.start();
      });
    },
    [getTrackSamples, processed.sampleRate, stopAudioPlayback]
  );

  const handleTrackClick = (track: VoiceTrackId) => {
    if (isExplaining) {
      stopExplanation();
    }
    if (isPlayingTrack && activeTrack === track) {
      stopAudioPlayback();
      return;
    }
    void playTrackAsync(track);
  };

  const speakAsync = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!speakNarrationEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
          resolve();
          return;
        }
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.rate = 1.04;
          utter.pitch = 1.0;
          let settled = false;
          let timer = 0;
          const finish = () => {
            if (!settled) {
              settled = true;
              window.clearTimeout(timer);
              if (speechFinishRef.current === finish) {
                speechFinishRef.current = null;
              }
              resolve();
            }
          };
          speechFinishRef.current = finish;
          // Safety timeout in case a browser stalls speechSynthesis
          const estMs = Math.max(3000, text.length * 75);
          timer = window.setTimeout(finish, estMs);
          utter.onend = finish;
          utter.onerror = finish;
          window.speechSynthesis.speak(utter);
        } catch {
          resolve();
        }
      });
    },
    [speakNarrationEnabled]
  );

  const runExplanationFrom = useCallback(
    async (startIdx: number) => {
      stopExplanation();
      explainCancelledRef.current = false;
      setIsExplaining(true);

      for (let i = startIdx; i < explanationSteps.length; i++) {
        if (explainCancelledRef.current) break;
        const step = explanationSteps[i];
        setExplainStepIdx(i);
        if (step.domain) {
          setAuditionDomain(step.domain);
        }
        setActiveTrack(step.track);

        await speakAsync(step.narration);
        if (explainCancelledRef.current) break;

        await playTrackAsync(step.track, step.domain);
        if (explainCancelledRef.current) break;

        // Brief pause between stages
        await new Promise((r) => setTimeout(r, 250));
      }

      if (!explainCancelledRef.current) {
        explainCancelledRef.current = true;
        setIsExplaining(false);
      }
    },
    [explanationSteps, playTrackAsync, speakAsync, stopExplanation]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    stopExplanation();
    try {
      const decoded = await decodeAudioBlobToVoice(file, file.name);
      setVoiceSource(decoded);
      setActiveTrack('baseband');
    } catch {
      setUploadError('Could not decode audio file. Please use WAV, MP3, OGG, M4A, or WebM.');
    }
  };

  const handleToggleRecord = async () => {
    setUploadError(null);
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    stopExplanation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(recordedChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        try {
          const decoded = await decodeAudioBlobToVoice(blob, 'Mic Recording');
          setVoiceSource(decoded);
          setActiveTrack('baseband');
        } catch {
          setUploadError('Failed to process microphone recording.');
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setUploadError('Microphone permission denied or unavailable.');
    }
  };

  // Draw crisp LSB / Carrier / USB Audio Spectrum Preview (0..10 kHz)
  useEffect(() => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 520;
    const height = 84;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padL = 26;
    const padR = 10;
    const padT = 14;
    const padB = 18;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const maxF = 10000;
    const fToX = (f: number) => padL + (f / maxF) * plotW;

    // Background band shading for LSB (1.1..4.5 kHz) and USB (4.5..7.9 kHz)
    ctx.fillStyle = 'rgba(2, 132, 199, 0.07)';
    ctx.fillRect(fToX(1100), padT, fToX(AUDIBLE_FC_HZ) - fToX(1100), plotH);

    ctx.fillStyle = 'rgba(0, 122, 255, 0.08)';
    ctx.fillRect(fToX(AUDIBLE_FC_HZ), padT, fToX(7900) - fToX(AUDIBLE_FC_HZ), plotH);

    // Band Labels
    ctx.font = '600 9px "Nura", "Jura", "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#0284C7';
    ctx.fillText('LSB (fc−fm)', fToX(1600), padT + 9);
    ctx.fillStyle = '#007AFF';
    ctx.fillText('USB (fc+fm)', fToX(5100), padT + 9);

    // Carrier marker line at 4.5 kHz
    const fcX = fToX(AUDIBLE_FC_HZ);
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.45)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(fcX, padT);
    ctx.lineTo(fcX, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#1D1D1F';
    ctx.fillText('fc', fcX - 5, padT + 9);

    // Grid baseline & ticks
    ctx.strokeStyle = '#E5E5EA';
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = '#6E6E73';
    ctx.font = '9px "Nura", "Jura", "Plus Jakarta Sans", sans-serif';
    [0, 2, 4.5, 7, 10].forEach((khz) => {
      const x = fToX(khz * 1000);
      ctx.fillText(`${khz}k`, x - 8, height - 4);
    });

    // Draw selected track spectrum (defaults to modulated)
    const specKey: VoiceTrackId = activeTrack ?? 'modulated';
    const spec = processed.spectra[specKey];
    if (spec && spec.freqsHz.length > 0) {
      const strokeColor =
        specKey === 'usb'
          ? '#007AFF'
          : specKey === 'lsb'
          ? '#0284C7'
          : specKey === 'demodulated'
          ? '#1D1D1F'
          : specKey === 'baseband'
          ? '#52525B'
          : '#007AFF';

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < spec.freqsHz.length; i++) {
        const x = fToX(spec.freqsHz[i]);
        const y = padT + plotH - spec.mags[i] * (plotH - 6);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [processed, activeTrack]);

  const trackButtons: {
    id: VoiceTrackId;
    label: string;
    sub: string;
    accent: string;
  }[] = [
    {
      id: 'baseband',
      label: 'Baseband m(t)',
      sub: '0.2–3.4 kHz',
      accent: 'border-[#0284C7]/50 bg-[#0284C7]/10 text-[#1D1D1F]',
    },
    {
      id: 'usb',
      label: 'USB Sound',
      sub: auditionDomain === 'rf' ? 'fc + fm (4.7–7.9k)' : 'USB Demodulated',
      accent: 'border-[#007AFF]/50 bg-[#007AFF]/10 text-[#007AFF]',
    },
    {
      id: 'lsb',
      label: 'LSB Sound',
      sub: auditionDomain === 'rf' ? 'fc − fm (1.1–4.3k)' : 'LSB Demodulated',
      accent: 'border-[#3898FF]/60 bg-[#3898FF]/12 text-[#1D1D1F]',
    },
    {
      id: 'modulated',
      label: 'Modulated s(t)',
      sub:
        topic === 'conventional-am'
          ? 'Carrier + USB + LSB'
          : topic === 'dsb-sc'
          ? 'USB + LSB (No Carrier)'
          : topic === 'ssb'
          ? `${ssbSideband} Only`
          : 'USB + Vestige',
      accent: 'border-[#007AFF] bg-[#007AFF]/12 text-[#007AFF]',
    },
    {
      id: 'demodulated',
      label: 'Demodulated yo(t)',
      sub: subTab === 'receiver' ? 'Circuit Output' : 'Recovered Voice',
      accent: 'border-[#1D1D1F] bg-[#1D1D1F] text-white',
    },
  ];

  const currentExplainStep = explanationSteps[explainStepIdx] ?? explanationSteps[0];

  return (
    <div className="bg-white border border-[#AAAAAA]/30 rounded-2xl p-3.5 md:p-4 space-y-3 shadow-xs font-nura">
      {/* Top Bar: Voice Uploader + Default Voice + Explain with Sound */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#AAAAAA]/25 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#007AFF]/10 border border-[#007AFF]/25 text-[#007AFF] flex items-center justify-center shrink-0">
            <AudioLines className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6E73]">
              VOICE &amp; USB/LSB SOUND LAB ·{' '}
              {subTab === 'instrument'
                ? 'MODULATION & DEMODULATION'
                : subTab === 'receiver'
                ? 'CIRCUIT ANALYSIS'
                : 'EQUATIONS & POWER'}
            </div>
            <div className="text-xs font-bold text-[#1D1D1F] truncate">
              {voiceSource.name}{' '}
              <span className="font-normal text-[#6E6E73] tabular-nums">
                ({voiceSource.durationSec.toFixed(1)}s)
              </span>
            </div>
          </div>
        </div>

        {/* Uploader, Mic, Default & Domain Switch */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#AAAAAA]/35 bg-white hover:border-[#007AFF] hover:text-[#007AFF] text-xs font-medium text-[#1D1D1F] transition-colors cursor-pointer"
            title="Upload your own voice or audio clip (WAV, MP3, OGG, M4A, WebM)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload voice</span>
          </button>

          <button
            type="button"
            onClick={handleToggleRecord}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              isRecording
                ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                : 'border-[#AAAAAA]/35 bg-white hover:border-[#007AFF] hover:text-[#007AFF] text-[#1D1D1F]'
            }`}
            title={isRecording ? 'Stop microphone recording' : 'Record your voice from microphone'}
          >
            {isRecording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isRecording ? 'Stop rec' : 'Record'}</span>
          </button>

          {!voiceSource.isDefault && (
            <button
              type="button"
              onClick={() => {
                stopExplanation();
                setVoiceSource(defaultVoice);
                setUploadError(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#AAAAAA]/35 bg-[#F5F5F7] hover:text-[#007AFF] text-xs font-medium text-[#52525B] cursor-pointer"
              title="Switch back to built-in default voice"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Default voice</span>
            </button>
          )}

          {/* RF Passband vs Receiver Baseband Toggle */}
          <div className="flex items-center bg-[#F5F5F7] p-0.5 rounded-lg border border-[#AAAAAA]/30 text-[10px]">
            <button
              type="button"
              onClick={() => setAuditionDomain('rf')}
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                auditionDomain === 'rf'
                  ? 'bg-white text-[#007AFF] font-semibold shadow-2xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
              title="Listen to USB & LSB shifted around 4.5 kHz carrier"
            >
              USB/LSB RF
            </button>
            <button
              type="button"
              onClick={() => setAuditionDomain('rx')}
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                auditionDomain === 'rx'
                  ? 'bg-white text-[#007AFF] font-semibold shadow-2xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
              title="Listen to USB & LSB after receiver demodulation"
            >
              Rx Baseband
            </button>
          </div>

          {/* Explain Whole Topic Using Sound */}
          <button
            type="button"
            onClick={() => {
              if (isExplaining) {
                stopExplanation();
              } else {
                void runExplanationFrom(0);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isExplaining
                ? 'bg-[#1D1D1F] hover:bg-black text-white'
                : 'bg-[#007AFF] hover:bg-[#0066D6] text-white'
            }`}
          >
            {isExplaining ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>Stop explanation</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Explain with sound</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSpeakNarrationEnabled((v) => !v)}
            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
              speakNarrationEnabled
                ? 'bg-[#007AFF]/10 border-[#007AFF]/25 text-[#007AFF]'
                : 'bg-white border-[#AAAAAA]/35 text-[#6E6E73]'
            }`}
            title={speakNarrationEnabled ? 'Spoken voice narration ON' : 'Spoken voice narration Muted (plays DSP sounds only)'}
            aria-label="Toggle spoken voice narration"
          >
            {speakNarrationEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="text-[11px] text-[#1D1D1F] bg-[#F5F5F7] border border-[#1D1D1F]/35 rounded-lg px-3 py-1.5">
          {uploadError}
        </div>
      )}

      {/* Middle Row: 5 Interactive USB / LSB / Modulated / Demodulated Sound Buttons + Live Sideband Spectrum */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
        <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {trackButtons.map((btn) => {
            const isActive = activeTrack === btn.id;
            const isPlayingThis = isActive && isPlayingTrack;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleTrackClick(btn.id)}
                className={`relative overflow-hidden rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                  isActive
                    ? `${btn.accent} shadow-2xs`
                    : 'border-[#AAAAAA]/30 bg-[#F5F5F7] hover:border-[#007AFF]/60 text-[#1D1D1F]'
                }`}
              >
                {isPlayingThis && (
                  <div
                    className="absolute bottom-0 left-0 h-0.5 bg-[#007AFF] transition-all duration-75"
                    style={{ width: `${Math.round(playProgress * 100)}%` }}
                  />
                )}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold truncate">{btn.label}</span>
                  {isPlayingThis ? (
                    <Pause className="w-3 h-3 shrink-0" />
                  ) : (
                    <Play className="w-3 h-3 shrink-0 opacity-70" />
                  )}
                </div>
                <div className="text-[9.5px] opacity-75 truncate mt-0.5 tabular-nums">{btn.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Mini Sideband Audio Spectrum (shows LSB below fc and USB above fc) */}
        <div className="xl:col-span-5 border border-[#AAAAAA]/30 rounded-xl bg-[#F5F5F7] px-2 pt-1.5 pb-1">
          <canvas ref={spectrumCanvasRef} className="w-full h-[84px] block" />
        </div>
      </div>

      {/* Bottom Row: Guided Sound Walkthrough Steps & Live Spoken Transcript */}
      <div className="bg-[#F5F5F7] border border-[#AAAAAA]/30 rounded-xl p-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {explanationSteps.map((step, idx) => {
            const isCurrent = isExplaining && explainStepIdx === idx;
            const isSelectedTrack = activeTrack === step.track && !isExplaining;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => void runExplanationFrom(idx)}
                className={`px-2 py-1 rounded-md text-[10px] transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-[#007AFF] text-white font-semibold'
                    : isSelectedTrack
                    ? 'bg-white text-[#007AFF] border border-[#007AFF]/40 font-semibold'
                    : 'bg-white/90 text-[#52525B] border border-[#AAAAAA]/30 hover:text-[#007AFF]'
                }`}
                title="Click to hear this step explained with sound"
              >
                {step.badge}
              </button>
            );
          })}
        </div>

        <div className="flex items-start justify-between gap-3 text-xs text-[#52525B] leading-relaxed">
          <div>
            <span className="font-semibold text-[#007AFF] mr-1.5">
              {currentExplainStep.title}:
            </span>
            <span>{currentExplainStep.narration}</span>
          </div>
          {isPlayingTrack && (
            <button
              type="button"
              onClick={stopAudioPlayback}
              className="shrink-0 px-2 py-0.5 rounded bg-white border border-[#AAAAAA]/35 text-[10px] text-[#52525B] hover:text-[#1D1D1F] cursor-pointer"
            >
              Stop audio
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
