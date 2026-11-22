import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { StudioBenchTopic } from './OverviewStudioView';
import { LatexText } from '../../components/studio/Latex';

interface LandingStudioViewProps {
  onEnterBench: (topic?: StudioBenchTopic) => void;
  onOpenOverview: () => void;
  onOpenComparison: () => void;
  onOpenTheory: () => void;
}

const SCHEME_TILES: {
  num: string;
  topic: StudioBenchTopic;
  name: string;
  subtitle: string;
  bandwidth: string;
  summary: string;
}[] = [
  {
    num: '01',
    topic: 'conventional-am',
    name: 'DSB-FC',
    subtitle: 'Full Carrier AM',
    bandwidth: '$2B$',
    summary: 'Explore modulation depth $\\mu$, over-modulation distortion, and diode + $RC$ envelope recovery.',
  },
  {
    num: '02',
    topic: 'dsb-sc',
    name: 'DSB-SC',
    subtitle: 'Suppressed Carrier',
    bandwidth: '$2B$',
    summary: 'Inspect $180^\\circ$ phase reversals, 4-diode ring switching, and Costas $I/Q$ carrier lock.',
  },
  {
    num: '03',
    topic: 'ssb',
    name: 'SSB-SC',
    subtitle: 'Single Sideband',
    bandwidth: '$B$',
    summary: 'Compare Hilbert phase discrimination against crystal BPF filtering at half bandwidth.',
  },
  {
    num: '04',
    topic: 'vsb',
    name: 'VSB',
    subtitle: 'Vestigial Sideband',
    bandwidth: '$B + B_v$',
    summary: 'Verify complementary filter symmetry $H(f+f_c)+H(f-f_c)=1$ with live vestige skew.',
  },
];

export const LandingStudioView: React.FC<LandingStudioViewProps> = ({
  onEnterBench,
  onOpenOverview,
  onOpenComparison,
  onOpenTheory,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-nura antialiased selection:bg-[#007AFF]/15 selection:text-[#007AFF]">
      {/* Outer Frame Matching Attached Hero Design */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-12">
        {/* HERO CONTAINER CARD */}
        <div className="relative bg-white rounded-3xl border border-[#AAAAAA]/30 shadow-[0_24px_60px_-24px_rgba(29,29,31,0.10)] overflow-hidden">
          {/* Subtle Geometric Blueprint Linework Background (from reference design) */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1200 720"
            preserveAspectRatio="xMidYMid slice"
            className="pointer-events-none absolute inset-0 w-full h-full"
          >
            <g fill="none" stroke="#AAAAAA" strokeOpacity="0.20" strokeWidth="1">
              <circle cx="640" cy="460" r="240" />
              <circle cx="640" cy="460" r="420" />
              <circle cx="190" cy="140" r="320" />
              <line x1="0" y1="620" x2="720" y2="0" />
              <line x1="280" y1="720" x2="1080" y2="0" />
              <line x1="0" y1="210" x2="960" y2="720" />
              <line x1="460" y1="0" x2="1200" y2="540" />
            </g>
          </svg>

          {/* TOP BAR CONTRACT: 3 Zones Separated by gap-8 */}
          <header className="relative z-20 flex items-center justify-between gap-8 px-6 sm:px-10 lg:px-14 py-5 border-b border-[#AAAAAA]/18">
            {/* Zone 1: Brand Wordmark (single line, clean mark) */}
            <button
              type="button"
              onClick={() => scrollToSection('top')}
              className="flex items-center gap-2.5 text-[#1D1D1F] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#007AFF] rounded-md"
            >
              <svg
                viewBox="0 0 28 18"
                className="w-6 h-4 shrink-0"
                fill="none"
                stroke="#1D1D1F"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 14 L8 4 L14 9 L20 14 L26 4" />
                <circle cx="14" cy="9" r="2" fill="#007AFF" stroke="none" />
              </svg>
              <span className="text-lg font-bold tracking-tight">AMBOX</span>
            </button>

            {/* Zone 2: 4 Concise Single-Line Navigation Links */}
            <nav
              aria-label="Primary navigation"
              className="hidden md:flex items-center gap-7 text-sm font-medium text-[#555558]"
            >
              <button
                type="button"
                onClick={() => onEnterBench('conventional-am')}
                className="hover:text-[#1D1D1F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Bench
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('schemes')}
                className="hover:text-[#1D1D1F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Schemes
              </button>
              <button
                type="button"
                onClick={onOpenComparison}
                className="hover:text-[#1D1D1F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Comparison
              </button>
              <button
                type="button"
                onClick={onOpenTheory}
                className="hover:text-[#1D1D1F] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Equations
              </button>
            </nav>

            {/* Zone 3: 1 Primary Header Action */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => onEnterBench('conventional-am')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0066D6] rounded-xl transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]"
              >
                Open Studio
              </button>
            </div>
          </header>

          {/* HERO SPLIT */}
          <section
            id="top"
            className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[560px] lg:min-h-[650px]"
          >
            {/* Left Copy & Conversion Column */}
            <div className="lg:col-span-7 relative z-10 px-6 sm:px-10 lg:px-14 pt-12 pb-10 lg:py-16 flex flex-col justify-between gap-10">
              <div className="space-y-6 max-w-2xl">
                <h1 className="text-[clamp(2.35rem,4.3vw,3.85rem)] font-semibold tracking-[-0.025em] leading-[1.07] text-[#1D1D1F] [text-wrap:balance]">
                  A <span className="italic font-normal text-[#1D1D1F]">signal</span> needs more
                  than formulas. It needs a lab.
                </h1>

                <p className="text-base sm:text-[17px] text-[#555558] max-w-lg leading-relaxed">
                  Simulate DSB-FC, DSB-SC, SSB-SC, and VSB modulation with real-time time-domain
                  traces, live electronic schematics, and FFT spectra inside AMBOX.
                </p>

                {/* Primary & Secondary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={onOpenOverview}
                    className="group inline-flex items-center gap-3 pl-5 pr-2 py-2 rounded-full bg-[#007AFF] hover:bg-[#0066D6] text-white text-sm font-semibold transition-all duration-150 shadow-sm whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]"
                  >
                    <span>Launch AMBOX Lab</span>
                    <span className="w-7 h-7 rounded-full bg-white/18 flex items-center justify-center transition-transform duration-150 group-hover:translate-x-0.5">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="inline-flex items-center px-5 py-2.5 rounded-full bg-white hover:bg-[#F5F5F7] border border-[#AAAAAA]/55 text-[#1D1D1F] text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]"
                  >
                    How it works
                  </button>
                </div>
              </div>

              {/* Bottom Proof / Architecture Strip */}
              <div className="space-y-3 pt-4 border-t border-[#AAAAAA]/20 max-w-xl">
                <div className="text-xs font-medium text-[#76767A]">
                  Chapter 2 Modulation &amp; Demodulation · Real-time DSP &amp; schematic analysis
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold tracking-tight text-[#8A8A8E]">
                  <button
                    type="button"
                    onClick={() => onEnterBench('conventional-am')}
                    className="hover:text-[#1D1D1F] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    DSB-FC
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterBench('dsb-sc')}
                    className="hover:text-[#1D1D1F] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    DSB-SC · Costas
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterBench('ssb')}
                    className="hover:text-[#1D1D1F] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    SSB-SC
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterBench('vsb')}
                    className="hover:text-[#1D1D1F] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    VSB
                  </button>
                  <button
                    type="button"
                    onClick={onOpenOverview}
                    className="hover:text-[#007AFF] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Overview
                  </button>
                </div>
              </div>
            </div>

            {/* Right Portrait Column — Cropped right & bottom edges flush against card border */}
            <div className="lg:col-span-5 relative flex items-end justify-end p-0 min-h-[420px] lg:min-h-0">
              {!imgFailed ? (
                <img
                  src="/assets/aistudio/Gemini_Generated_Image_8x0e2r8x0e2r8x0e_7d65786b.jpg"
                  alt="Communication systems mentor portrait"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="lg:absolute lg:right-0 lg:bottom-0 w-auto max-w-none h-[460px] sm:h-[540px] lg:h-[630px] object-contain object-right-bottom mix-blend-multiply select-none pointer-events-none"
                />
              ) : (
                <div className="w-full max-w-[420px] h-[420px] rounded-2xl bg-[#F5F5F7] border border-[#AAAAAA]/30 flex flex-col items-center justify-center p-8 text-center">
                  <span className="text-sm font-semibold text-[#1D1D1F]">AMBOX Laboratory</span>
                  <span className="text-xs text-[#6E6E73] mt-1">
                    Interactive Modulation &amp; Demodulation
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* SECTION 2: CORE CAPABILITIES — 4 MODULATION ARCHITECTURES */}
        <section id="schemes" className="space-y-6 px-1 sm:px-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-[#76767A]">01. Modulation Architectures</div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                Four ways to carry a baseband signal.
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenComparison}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#007AFF] hover:text-[#0066D6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Compare all four schemes</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SCHEME_TILES.map((item) => (
              <button
                key={item.topic}
                type="button"
                onClick={() => onEnterBench(item.topic)}
                className="group text-left bg-[#1D1D1F] hover:bg-[#141416] border border-[#AAAAAA]/25 hover:border-[#007AFF] rounded-2xl p-6 flex flex-col justify-between gap-6 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#AAAAAA] tabular-nums">
                    <span>
                      {item.num} · {item.subtitle}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-[#AAAAAA] group-hover:text-[#007AFF] transition-colors" />
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-xl font-semibold text-[#F5F5F7] tracking-normal">
                      {item.name}
                    </h3>
                    <span className="text-xs font-mono text-[#AAAAAA] tabular-nums">
                      <LatexText text={item.bandwidth} />
                    </span>
                  </div>

                  <p className="text-sm text-[#D1D1D6] leading-relaxed">
                    <LatexText text={item.summary} />
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-[#F5F5F7] group-hover:text-[#007AFF] transition-colors">
                  <span>Open in bench</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* SECTION 3: HOW AMBOX WORKS */}
        <section
          id="how-it-works"
          className="bg-white border border-[#AAAAAA]/30 rounded-3xl px-6 sm:px-10 lg:px-14 py-10 sm:py-12 space-y-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#AAAAAA]/20 pb-6">
            <div className="space-y-1.5 max-w-2xl">
              <div className="text-xs font-medium text-[#76767A]">02. Inside the Studio</div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                From parameters to circuit recovery in one view.
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onEnterBench('conventional-am')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#007AFF] hover:bg-[#0066D6] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start lg:self-auto"
            >
              <span>Enter Experiment Bench</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <div className="text-xs font-mono font-semibold text-[#007AFF] tabular-nums">01</div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">Tune signal &amp; carrier</h3>
              <p className="text-sm text-[#555558] leading-relaxed">
                Adjust carrier frequency, modulation index, LO phase offset, and message waveforms
                with immediate oscilloscope updates.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-semibold text-[#007AFF] tabular-nums">02</div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                Inspect live circuits &amp; FFT
              </h3>
              <p className="text-sm text-[#555558] leading-relaxed">
                Click resistors, capacitors, and inductors on the schematic to observe real
                envelope droop, carrier leak, and sideband spectra.
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-semibold text-[#007AFF] tabular-nums">03</div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                Connect math to waveforms
              </h3>
              <p className="text-sm text-[#555558] leading-relaxed">
                Cross-check power efficiency, occupied bandwidth, and Chapter 2 LaTeX derivations
                directly alongside live demodulated output.
              </p>
            </div>
          </div>
        </section>

        {/* QUIET FOOTER */}
        <footer className="px-2 pt-2 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[#AAAAAA]/30 text-xs text-[#76767A]">
          <div className="flex items-center gap-2.5 text-[#1D1D1F] font-semibold">
            <span>AMBOX</span>
            <span aria-hidden="true" className="text-[#AAAAAA]">
              ·
            </span>
            <span className="font-normal text-[#76767A]">
              Chapter 2 Modulation &amp; Demodulation Laboratory
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-medium">
            <button
              type="button"
              onClick={onOpenOverview}
              className="hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => onEnterBench('conventional-am')}
              className="hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              Bench
            </button>
            <button
              type="button"
              onClick={onOpenComparison}
              className="hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              AM Comparison
            </button>
            <button
              type="button"
              onClick={onOpenTheory}
              className="hover:text-[#1D1D1F] transition-colors cursor-pointer"
            >
              Equations
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
