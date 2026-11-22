import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Lightbulb } from 'lucide-react';
import { useSimulation } from '../../context/SimulationContext';
import { simulateAMFamilyComparison, MessageShape } from '../../services/chapter2Dsp';
import { DarkSpectrumCanvas } from '../../components/studio/DarkSpectrumCanvas';
import { StudioBenchTopic } from './OverviewStudioView';
import { LatexText } from '../../components/studio/Latex';

interface ComparisonStudioViewProps {
  onOpenExperiment: (topic: StudioBenchTopic) => void;
}

export const ComparisonStudioView: React.FC<ComparisonStudioViewProps> = ({
  onOpenExperiment,
}) => {
  const { animTime } = useSimulation();
  const [fc, setFc] = useState<number>(10000);
  const [fm, setFm] = useState<number>(1000);
  const [mu, setMu] = useState<number>(0.7);
  const [vestigeRatio, setVestigeRatio] = useState<number>(0.25);
  const [messageShape, setMessageShape] = useState<MessageShape>('sine');

  const sim = useMemo(() => {
    return simulateAMFamilyComparison({
      Ac: 1.0,
      fc,
      fm,
      mu,
      vestigeRatio,
      messageShape,
      timeOffset: animTime,
    });
  }, [fc, fm, mu, vestigeRatio, messageShape, animTime]);

  const wMax = messageShape === 'two-tone' ? fm * 2.2 : fm;
  const maxRefBw = Math.max(1, 2 * wMax);

  const cards: {
    exp: string;
    topic: StudioBenchTopic;
    title: string;
    spectrum: typeof sim.am.spectrum;
    carrierFreq?: number;
    filterOverlay?: { frequencies: number[]; response: number[]; color?: string };
    sidebandDesc: string;
    bwKhz: number;
    carrierTag: string;
  }[] = [
    {
      exp: 'EXPERIMENT 01',
      topic: 'conventional-am',
      title: 'DSB-FC',
      spectrum: sim.am.spectrum,
      carrierFreq: fc,
      sidebandDesc: 'USB + LSB',
      bwKhz: (2 * wMax) / 1000,
      carrierTag: 'Carrier: Transmitted (Envelope Det.)',
    },
    {
      exp: 'EXPERIMENT 02',
      topic: 'dsb-sc',
      title: 'DSB-SC',
      spectrum: sim.dsb.spectrum,
      sidebandDesc: 'USB + LSB',
      bwKhz: (2 * wMax) / 1000,
      carrierTag: 'Carrier: Suppressed (Coherent / Costas)',
    },
    {
      exp: 'EXPERIMENT 03',
      topic: 'ssb',
      title: 'SSB-SC',
      spectrum: sim.ssb.spectrum,
      sidebandDesc: 'USB or LSB',
      bwKhz: wMax / 1000,
      carrierTag: 'Carrier: Suppressed (Coherent)',
    },
    {
      exp: 'EXPERIMENT 04',
      topic: 'vsb',
      title: 'VSB',
      spectrum: sim.vsb.spectrum,
      filterOverlay: {
        frequencies: sim.vsb.filterOverlay.frequencies,
        response: sim.vsb.filterOverlay.response,
        color: '#007AFF',
      },
      sidebandDesc: 'USB + vestige $f_v$',
      bwKhz: (wMax * (1 + vestigeRatio)) / 1000,
      carrierTag: 'Carrier: Suppressed* ($H(f+f_c)+H(f-f_c)=1$)',
    },
  ];

  const minViewF = Math.max(0, fc - wMax * 3.2);
  const maxViewF = fc + wMax * 3.2;

  return (
    <div className="flex-1 overflow-y-auto px-5 md:px-10 py-6 space-y-8 max-w-[1380px] w-full mx-auto font-nura">
      {/* Header + Shared Live Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-[#AAAAAA]/30 pb-5">
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6E73]">
            AMBOX · CHAPTER 2 TOPIC 05
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Same message. Different approaches.
          </h1>
          <p className="text-sm text-[#52525B]">
            Compare live spectra, bandwidth utilization, and carrier power efficiency across all
            four AM schemes.
          </p>
        </div>

        {/* White Shared Parameter Strip */}
        <div className="bg-[#F5F5F7] border border-[#AAAAAA]/30 rounded-2xl px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-4 items-center shrink-0">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#6E6E73]">
              <LatexText text="$f_c$" />
              <span className="text-[#1D1D1F] font-semibold tabular-nums">
                {(fc / 1000).toFixed(0)} kHz
              </span>
            </div>
            <input
              type="range"
              min={6000}
              max={18000}
              step={500}
              value={fc}
              onChange={(e) => setFc(Number(e.target.value))}
              className="studio-slider w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#6E6E73]">
              <LatexText text="$f_m$" />
              <span className="text-[#1D1D1F] font-semibold tabular-nums">
                {(fm / 1000).toFixed(1)} kHz
              </span>
            </div>
            <input
              type="range"
              min={400}
              max={2000}
              step={100}
              value={fm}
              onChange={(e) => setFm(Number(e.target.value))}
              className="studio-slider w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#6E6E73]">
              <LatexText text="$\mu$ (AM)" />
              <span className="text-[#007AFF] font-semibold tabular-nums">{mu.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.2}
              step={0.05}
              value={mu}
              onChange={(e) => setMu(Number(e.target.value))}
              className="studio-slider w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[#6E6E73]">
              <LatexText text="Vestige $f_v/W$" />
              <span className="text-[#1D1D1F] font-semibold tabular-nums">
                {Math.round(vestigeRatio * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.5}
              step={0.05}
              value={vestigeRatio}
              onChange={(e) => setVestigeRatio(Number(e.target.value))}
              className="studio-slider w-full cursor-pointer"
            />
          </div>

          <div className="col-span-2 sm:col-span-1 space-y-1">
            <div className="text-[10px] text-[#6E6E73]">Tone</div>
            <div className="flex bg-[#E5E5EA]/70 p-0.5 rounded-md border border-[#AAAAAA]/30">
              {(['sine', 'two-tone'] as MessageShape[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMessageShape(s)}
                  className={`flex-1 py-0.5 text-[10px] rounded cursor-pointer whitespace-nowrap transition-colors ${
                    messageShape === s ? 'bg-[#007AFF] text-white font-semibold' : 'text-[#52525B]'
                  }`}
                >
                  {s === 'sine' ? '1-Tone' : '2-Tone'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Live Spectrum Cards */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6E6E73]">
              A VISUAL COMPARISON
            </div>
            <h2 className="text-lg font-bold text-[#1D1D1F]">Where the information lives</h2>
          </div>
          <span className="text-xs text-[#6E6E73] tabular-nums">
            <LatexText
              text={`Reference $f_c = ${(fc / 1000).toFixed(1)}\\,\\text{kHz}$ · $W = ${(wMax / 1000).toFixed(2)}\\,\\text{kHz}$`}
            />
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((card) => {
            const bwPct = Math.min(100, Math.round(((card.bwKhz * 1000) / maxRefBw) * 100));
            return (
              <div
                key={card.title}
                onClick={() => onOpenExperiment(card.topic)}
                className="group bg-white border border-[#AAAAAA]/30 hover:border-[#007AFF] rounded-2xl p-4 space-y-3 transition-colors cursor-pointer shadow-xs"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                  <span>{card.exp}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#6E6E73] group-hover:text-[#007AFF]" />
                </div>

                <h3 className="text-xl font-bold text-[#1D1D1F] tracking-tight">{card.title}</h3>

                <div className="border border-[#AAAAAA]/25 rounded-xl p-1 bg-white">
                  <DarkSpectrumCanvas
                    spectrum={card.spectrum}
                    carrierFreqHz={card.carrierFreq}
                    minFreqHz={minViewF}
                    maxFreqHz={maxViewF}
                    filterOverlay={card.filterOverlay}
                    height={215}
                    mini
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#6E6E73]">
                    <LatexText text={card.sidebandDesc} />
                  </span>
                  <span className="text-[#1D1D1F] font-semibold tabular-nums">
                    {card.bwKhz.toFixed(2)} kHz
                  </span>
                </div>

                {/* Bandwidth Utilization Bar */}
                <div className="h-1.5 w-full bg-[#E5E5EA] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#007AFF] rounded-full transition-all duration-200"
                    style={{ width: `${bwPct}%` }}
                  />
                </div>

                <div className="text-[11px] text-[#6E6E73]">
                  <LatexText text={card.carrierTag} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* The Modulation Landscape Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1D1D1F]">The modulation landscape</h2>
            <p className="text-xs text-[#6E6E73]">
              <LatexText
                text={`$B$ = message bandwidth (${(wMax / 1000).toFixed(2)} kHz) · $B_v$ = vestigial bandwidth (${((wMax * vestigeRatio) / 1000).toFixed(2)} kHz)`}
              />
            </p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
            04 TECHNIQUES
          </span>
        </div>

        <div className="bg-white border border-[#AAAAAA]/30 rounded-2xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F5F5F7] text-[#1D1D1F] text-[11px] font-semibold border-b border-[#AAAAAA]/30">
                <th className="py-3 px-4">Modulation type</th>
                <th className="py-3 px-4">Carrier</th>
                <th className="py-3 px-4">Sidebands</th>
                <th className="py-3 px-4">Bandwidth</th>
                <th className="py-3 px-4">Power efficiency</th>
                <th className="py-3 px-4">Demodulation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#AAAAAA]/20">
              {[
                {
                  name: 'DSB-FC',
                  sub: 'Double Sideband Full Carrier',
                  topic: 'conventional-am' as StudioBenchTopic,
                  dot: '#007AFF',
                  carrier: 'Transmitted',
                  carrierHighlight: true,
                  sidebands: 'USB + LSB',
                  bw: `$2B$ (${((2 * wMax) / 1000).toFixed(2)} kHz)`,
                  eff: `$\\eta = \\frac{\\mu^2}{2+\\mu^2} = ${sim.am.efficiencyPct.toFixed(1)}\\%$ ($\\le 33.3\\%$)`,
                  demod: 'Diode + $RC$ envelope detection',
                },
                {
                  name: 'DSB-SC',
                  sub: 'Double Sideband Suppressed Carrier',
                  topic: 'dsb-sc' as StudioBenchTopic,
                  dot: '#1D1D1F',
                  carrier: 'Suppressed',
                  carrierHighlight: false,
                  sidebands: 'USB + LSB',
                  bw: `$2B$ (${((2 * wMax) / 1000).toFixed(2)} kHz)`,
                  eff: '$100\\%$ power in sidebands',
                  demod: 'Coherent / Costas I/Q Loop',
                },
                {
                  name: 'SSB-SC',
                  sub: 'Single Sideband Suppressed Carrier',
                  topic: 'ssb' as StudioBenchTopic,
                  dot: '#6E6E73',
                  carrier: 'Suppressed',
                  carrierHighlight: false,
                  sidebands: 'USB or LSB',
                  bw: `$B$ (${(wMax / 1000).toFixed(2)} kHz)`,
                  eff: '$100\\%$ power + half bandwidth',
                  demod: 'Coherent detection ($\\phi \\to 0$)',
                },
                {
                  name: 'VSB',
                  sub: 'Vestigial Sideband',
                  topic: 'vsb' as StudioBenchTopic,
                  dot: '#AAAAAA',
                  carrier: 'Suppressed*',
                  carrierHighlight: false,
                  sidebands: 'USB + vestige $f_v$',
                  bw: `$B + B_v$ (${((wMax * (1 + vestigeRatio)) / 1000).toFixed(2)} kHz)`,
                  eff: 'Balances bandwidth with complementary $H(f)$',
                  demod: 'Coherent (or envelope + carrier)',
                },
              ].map((row) => (
                <tr
                  key={row.name}
                  onClick={() => onOpenExperiment(row.topic)}
                  className="hover:bg-[#F5F5F7]/70 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 font-semibold text-[#1D1D1F]">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: row.dot }}
                      />
                      <span>{row.name}</span>
                      <ArrowUpRight className="w-3 h-3 text-[#6E6E73]" />
                    </div>
                    <div className="text-[11px] text-[#6E6E73] pl-4">{row.sub}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        row.carrierHighlight
                          ? 'bg-[#007AFF]/10 text-[#007AFF]'
                          : 'bg-[#F5F5F7] text-[#52525B]'
                      }`}
                    >
                      {row.carrier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#52525B]">
                    <LatexText text={row.sidebands} />
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#1D1D1F] tabular-nums">
                    <LatexText text={row.bw} />
                  </td>
                  <td className="py-3.5 px-4 text-[#52525B] tabular-nums">
                    <LatexText text={row.eff} />
                  </td>
                  <td className="py-3.5 px-4 text-[#52525B]">
                    <LatexText text={row.demod} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Takeaway Callout */}
      <div className="bg-[#F5F5F7] border border-[#AAAAAA]/30 rounded-2xl px-5 py-4 flex items-start gap-3">
        <Lightbulb className="w-4 h-4 text-[#007AFF] shrink-0 mt-0.5" />
        <div className="text-xs text-[#52525B] leading-relaxed">
          <span className="font-semibold text-[#1D1D1F] block">
            There is no single best modulation technique.
          </span>
          <LatexText text="DSB-FC favors simple diode+$RC$ receivers ($\eta \le 33.3\%$). SSB conserves spectrum ($BW = W$). DSB-SC saves carrier power ($100\%$). VSB balances bandwidth with complementary filtering $H(f+f_c)+H(f-f_c)=1$." />
        </div>
      </div>
    </div>
  );
};
