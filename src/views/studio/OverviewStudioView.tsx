import React, { useMemo } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import { simulateAMFamilyComparison } from '../../services/chapter2Dsp';
import { DarkOscilloscopeCanvas } from '../../components/studio/DarkOscilloscopeCanvas';
import { Latex, LatexText } from '../../components/studio/Latex';

export type StudioBenchTopic = 'conventional-am' | 'dsb-sc' | 'ssb' | 'vsb';

interface OverviewStudioViewProps {
  onOpenExperiment: (topic: StudioBenchTopic) => void;
  onOpenComparison: () => void;
}

export const OverviewStudioView: React.FC<OverviewStudioViewProps> = ({
  onOpenExperiment,
  onOpenComparison,
}) => {
  const { animTime } = useSimulation();

  const previewSim = useMemo(() => {
    return simulateAMFamilyComparison({
      Ac: 1.0,
      fc: 10000,
      fm: 1000,
      mu: 0.7,
      vestigeRatio: 0.25,
      messageShape: 'sine',
      timeOffset: animTime,
    });
  }, [animTime]);

  return (
    <div className="flex-1 overflow-y-auto px-5 md:px-10 py-10 lg:py-14 max-w-[1380px] w-full mx-auto flex items-center">
      {/* Hero Section */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#6E6E73]">
            AMBOX · CHAPTER 2 LABORATORY
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1D1D1F] leading-[1.06]">
            AMBOX
            <span className="block mt-2 text-2xl md:text-3xl font-bold text-[#007AFF] leading-snug">
              Amplitude Modulation &amp; Demodulation Studio.
            </span>
          </h1>

          <p className="text-sm md:text-base font-medium text-[#52525B] max-w-md leading-relaxed">
            Interactive Chapter 2 communication systems laboratory. Inspect live waveforms,
            electronic schematics, FFT spectra, and receiver recovery side by side.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onOpenExperiment('conventional-am')}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#007AFF] hover:bg-[#0066D6] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Enter the laboratory</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenComparison}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-[#52525B] hover:text-[#007AFF] transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Compare techniques</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Preview Instrument Card */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div
            onClick={() => onOpenExperiment('conventional-am')}
            className="w-full max-w-[520px] bg-[#1D1D1F] border border-[#AAAAAA]/25 hover:border-[#007AFF] rounded-2xl p-5 shadow-[0_22px_50px_-20px_rgba(29,29,31,0.45)] transform lg:rotate-1 hover:rotate-0 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#AAAAAA] mb-2">
              <span className="text-[#3898FF] font-semibold">SIGNAL STUDY · LIVE</span>
              <span>DSB-FC + DEMOD</span>
            </div>

            <div className="mb-3">
              <div className="text-3xl font-mono font-bold text-[#F5F5F7] tabular-nums">
                10.00 <span className="text-sm font-normal text-[#AAAAAA]">kHz</span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#AAAAAA]">
                <LatexText text="CARRIER REFERENCE · $\mu = 0.70$" />
              </div>
            </div>

            <div className="border border-white/20 rounded-xl p-1 bg-white">
              <DarkOscilloscopeCanvas
                t={previewSim.t}
                traces={[
                  {
                    id: 'am-preview',
                    label: 's(t)',
                    color: '#007AFF',
                    data: previewSim.am.modulated,
                  },
                  {
                    id: 'am-demod-preview',
                    label: 'y_demod(t)',
                    color: '#1D1D1F',
                    data: previewSim.am.rcDemodAC,
                    lineDash: [4, 3],
                  },
                ]}
                mode="overlay"
                height={230}
                instrumentVariant="compact"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3 text-[11px] text-[#F5F5F7]">
              <Latex math="s(t) = A_c[1 + \mu\, m_n(t)]\cos(2\pi f_c t)" />
              <span className="text-[#3898FF] font-mono font-semibold">Mod &amp; Demod</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
