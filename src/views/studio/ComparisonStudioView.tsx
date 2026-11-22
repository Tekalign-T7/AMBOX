import React from 'react';
import { ArrowUpRight, Lightbulb } from 'lucide-react';
import { StudioBenchTopic } from './OverviewStudioView';
import { LatexText } from '../../components/studio/Latex';

interface ComparisonStudioViewProps {
  onOpenExperiment: (topic: StudioBenchTopic) => void;
}

export const ComparisonStudioView: React.FC<ComparisonStudioViewProps> = ({
  onOpenExperiment,
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-5 md:px-10 py-6 space-y-8 max-w-[1380px] w-full mx-auto font-nura">
      {/* Header */}
      <div className="space-y-1.5 border-b border-[#AAAAAA]/30 pb-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#000000]">
          AMBOX · CHAPTER 2 TOPIC 05
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F]">
          Same message. Different approaches.
        </h1>
      </div>

      {/* The Modulation Landscape Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1D1D1F]">The modulation landscape</h2>
            <p className="text-xs text-[#000000]">
              <LatexText text="$B$ = message bandwidth ($1.00\,\text{kHz}$) · $B_v$ = vestigial bandwidth ($0.25\,\text{kHz}$)" />
            </p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#000000]">
            04 TECHNIQUES
          </span>
        </div>

        <div className="bg-white border border-[#AAAAAA]/30 rounded-2xl overflow-x-auto shadow-2xs">
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
                  bw: '$2B$ (2.00 kHz)',
                  eff: '$\\eta = \\frac{\\mu^2}{2+\\mu^2} = 19.7\\%$ ($\\le 33.3\\%$)',
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
                  bw: '$2B$ (2.00 kHz)',
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
                  bw: '$B$ (1.00 kHz)',
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
                  bw: '$B + B_v$ (1.25 kHz)',
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
                      <ArrowUpRight className="w-3 h-3 text-[#000000]" />
                    </div>
                    <div className="text-[11px] text-[#000000] pl-4">{row.sub}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                        row.carrierHighlight
                          ? 'bg-[#007AFF]/10 text-[#007AFF]'
                          : 'bg-[#F5F5F7] text-[#1D1D1F]'
                      }`}
                    >
                      {row.carrier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#1D1D1F]">
                    <LatexText text={row.sidebands} />
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[#1D1D1F] tabular-nums">
                    <LatexText text={row.bw} />
                  </td>
                  <td className="py-3.5 px-4 text-[#1D1D1F] tabular-nums">
                    <LatexText text={row.eff} />
                  </td>
                  <td className="py-3.5 px-4 text-[#1D1D1F]">
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
        <div className="text-xs text-[#1D1D1F] leading-relaxed">
          <span className="font-semibold text-[#1D1D1F] block">
            There is no single best modulation technique.
          </span>
          <LatexText text="DSB-FC favors simple diode+$RC$ receivers ($\eta \le 33.3\%$). SSB conserves spectrum ($BW = W$). DSB-SC saves carrier power ($100\%$). VSB balances bandwidth with complementary filtering $H(f+f_c)+H(f-f_c)=1$." />
        </div>
      </div>
    </div>
  );
};
