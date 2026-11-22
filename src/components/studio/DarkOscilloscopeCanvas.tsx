import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Maximize2, Pause, Play, RotateCcw, Sliders, X } from 'lucide-react';

export interface DarkTrace {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  data: number[];
  lineDash?: number[];
  lineWidth?: number;
  overlayOnId?: string;
  zOrder?: 'back' | 'front';
}

interface DarkOscilloscopeProps {
  t: number[];
  traces: DarkTrace[];
  mode: 'stacked' | 'overlay';
  xUnitMultiplier?: number;
  xLabel?: string;
  height?: number;
  yBoundOverride?: number;
  instrumentVariant?: 'dso' | 'compact';
  insideDialog?: boolean;
  fillContainer?: boolean;
  renderParameters?: React.ReactNode;
}

function stableYBound(rawMax: number): number {
  const padded = Math.max(0.5, rawMax * 1.15);
  const step = padded <= 1.2 ? 0.5 : padded <= 3 ? 0.5 : 1.0;
  return Math.ceil(padded / step) * step;
}

function toScopePhosphorColor(color: string): string {
  return color;
}

function formatDivTime(totalDurationSec: number, divs: number, mult: number): string {
  const perDiv = (totalDurationSec / Math.max(1, divs)) * mult;
  if (mult === 1000) {
    if (perDiv < 1) return `${(perDiv * 1000).toFixed(0)} μs/div`;
    return `${perDiv.toFixed(perDiv < 10 ? 2 : 1)} ms/div`;
  }
  if (perDiv < 0.01) return `${(perDiv * 1000).toFixed(1)} ms/div`;
  return `${perDiv.toFixed(2)} s/div`;
}

function estimateFreqKHz(t: number[], data: number[]): number | null {
  if (!t || !data || t.length < 16 || data.length < 16) return null;
  const n = Math.min(t.length, data.length);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += data[i];
  mean /= n;

  const crossings: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = data[i - 1] - mean;
    const curr = data[i] - mean;
    if (prev <= 0 && curr > 0) {
      const frac = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr) || 1);
      crossings.push(t[i - 1] + frac * (t[i] - t[i - 1]));
    }
  }
  if (crossings.length < 2) return null;
  let sumPeriod = 0;
  for (let i = 1; i < crossings.length; i++) {
    sumPeriod += crossings[i] - crossings[i - 1];
  }
  const avgPeriod = sumPeriod / (crossings.length - 1);
  if (avgPeriod <= 0) return null;
  return 1 / avgPeriod / 1000;
}

function computeSignalStats(t: number[], data: number[]) {
  if (!data || data.length === 0) {
    return { vpp: 0, vrms: 0, vmax: 0, freqKHz: null as number | null };
  }
  let minV = Infinity;
  let maxV = -Infinity;
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    sumSq += v * v;
  }
  return {
    vpp: Math.max(0, maxV - minV),
    vrms: Math.sqrt(sumSq / data.length),
    vmax: maxV,
    freqKHz: estimateFreqKHz(t, data),
  };
}

const TIME_ZOOM_STEPS = [1, 2, 4, 8];
const VOLT_GAIN_STEPS = [0.5, 1, 2, 4];

/* ============================================================================
   Individual Signal Box (10px padding, clean default view, widescreen dialog expand)
   ============================================================================ */
interface SignalLaneBoxProps {
  channelIdx: number;
  laneTrace: DarkTrace;
  attachedOverlays: DarkTrace[];
  viewT: number[];
  xUnitMultiplier: number;
  xLabel: string;
  voltGain: number;
  yBoundOverride?: number;
  isPrimaryTriggerLane: boolean;
  trigLevel: number;
  showTrigLine: boolean;
  boxHeightPx?: number | 'flex';
  allowExpandDialog?: boolean;
  onExpandDialog?: () => void;
  onSelectMeasure: () => void;
}

const SignalLaneBox: React.FC<SignalLaneBoxProps> = ({
  channelIdx,
  laneTrace,
  attachedOverlays,
  viewT,
  xUnitMultiplier,
  xLabel,
  voltGain,
  yBoundOverride,
  isPrimaryTriggerLane,
  trigLevel,
  showTrigLine,
  boxHeightPx = 270,
  allowExpandDialog = true,
  onExpandDialog,
  onSelectMeasure,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const yBoundRef = useRef<number | undefined>(undefined);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({ w: 500, h: 185 });
  const [hover, setHover] = useState<{
    x: number;
    tVal: number;
    values: { label: string; color: string; val: number }[];
  } | null>(null);

  const laneTraces = useMemo(() => {
    const backOverlays = attachedOverlays.filter((tr) => tr.zOrder === 'back');
    const frontOverlays = attachedOverlays.filter((tr) => tr.zOrder !== 'back');
    return [...backOverlays, laneTrace, ...frontOverlays];
  }, [attachedOverlays, laneTrace]);

  const stats = useMemo(
    () => computeSignalStats(viewT, laneTrace.data),
    [viewT, laneTrace.data]
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        if (w > 0 && h > 0) {
          setBoxSize({ w, h });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewT || viewT.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = boxSize.w;
    const height = boxSize.h;
    if (width < 10 || height < 10) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Crisp White Signal Canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const compactVertical = height < 95;
    const padLeft = 40;
    const padRight = 22;
    const padTop = compactVertical ? 4 : 10;
    const padBottom = compactVertical ? 14 : 24;
    const plotW = Math.max(20, width - padLeft - padRight);
    const plotH = Math.max(12, height - padTop - padBottom);

    const tMin = viewT[0];
    const tMax = viewT[viewT.length - 1] || 1;
    const getX = (tv: number) => padLeft + ((tv - tMin) / (tMax - tMin || 1)) * plotW;

    // Outer graticule border
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // Vertical division lines (10 divisions)
    const xDivs = 10;
    for (let i = 0; i <= xDivs; i++) {
      const frac = i / xDivs;
      const xPix = padLeft + frac * plotW;
      const isCenter = i === xDivs / 2;
      ctx.strokeStyle = isCenter ? 'rgba(29, 29, 31, 0.2)' : 'rgba(29, 29, 31, 0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash(isCenter ? [] : [2, 3]);
      ctx.beginPath();
      ctx.moveTo(xPix, padTop);
      ctx.lineTo(xPix, padTop + plotH);
      ctx.stroke();

      if (i === 0 || i === 2 || i === 5 || i === 8 || i === 10) {
        const tVal = (tMin + frac * (tMax - tMin)) * xUnitMultiplier;
        const unitStr = xUnitMultiplier === 1000 ? 'ms' : 's';
        ctx.fillStyle = '#6E6E73';
        ctx.font = `${compactVertical ? 8.5 : 10}px "Nura", "Jura", "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = i === 10 ? 'right' : i === 0 ? 'left' : 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `${tVal.toFixed(tVal < 10 && tVal % 1 !== 0 ? 1 : 0)} ${unitStr}`,
          xPix,
          padTop + plotH + (compactVertical ? 2 : 5)
        );
      }
    }
    ctx.setLineDash([]);

    // Compute stable Y bound
    let maxAbs = 0.2;
    laneTraces.forEach((tr) => {
      for (let i = 0; i < tr.data.length; i++) {
        const a = Math.abs(tr.data[i]);
        if (isFinite(a) && a > maxAbs) maxAbs = a;
      }
    });
    const candidateBound = stableYBound(maxAbs);
    const prevBound = yBoundRef.current;
    let baseBound = candidateBound;
    if (yBoundOverride && yBoundOverride > 0) {
      baseBound = yBoundOverride;
    } else if (prevBound !== undefined) {
      if (maxAbs * 1.06 > prevBound || maxAbs * 1.55 < prevBound) {
        baseBound = candidateBound;
      } else {
        baseBound = prevBound;
      }
    }
    yBoundRef.current = baseBound;
    const yMax = baseBound / Math.max(0.25, voltGain);
    const drawMid = padTop + plotH / 2;

    // Horizontal division guides
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.07)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + plotH * 0.25);
    ctx.lineTo(padLeft + plotW, padTop + plotH * 0.25);
    ctx.moveTo(padLeft, padTop + plotH * 0.75);
    ctx.lineTo(padLeft + plotW, padTop + plotH * 0.75);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center zero crosshair + sub-ticks
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.2)';
    ctx.beginPath();
    ctx.moveTo(padLeft, drawMid);
    ctx.lineTo(padLeft + plotW, drawMid);
    for (let s = 1; s < 50; s++) {
      const sx = padLeft + (s / 50) * plotW;
      ctx.moveTo(sx, drawMid - 2);
      ctx.lineTo(sx, drawMid + 2);
    }
    ctx.stroke();

    // Trigger level indicator on CH1
    if (isPrimaryTriggerLane && (showTrigLine || Math.abs(trigLevel) > 0.02)) {
      const trigY = drawMid - (trigLevel / (yMax || 1)) * (plotH / 2);
      if (trigY >= padTop && trigY <= padTop + plotH) {
        ctx.strokeStyle = 'rgba(29, 29, 31, 0.55)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, trigY);
        ctx.lineTo(padLeft + plotW, trigY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#1D1D1F';
        ctx.font = '700 8.5px "Nura", "Jura", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('T▸', padLeft + 2, trigY);
      }
    }

    // Y-axis scale ticks
    ctx.fillStyle = '#6E6E73';
    ctx.font = '9px "Nura", "Jura", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${yMax.toFixed(1)}`, padLeft - 5, padTop + 5);
    ctx.fillText('0', padLeft - 5, drawMid);
    ctx.fillText(`-${yMax.toFixed(1)}`, padLeft - 5, padTop + plotH - 5);

    // Plot signal traces
    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop - 1, plotW, plotH + 2);
    ctx.clip();

    laneTraces.forEach((tr) => {
      const dispCol = toScopePhosphorColor(tr.color);
      ctx.beginPath();
      ctx.strokeStyle = dispCol;
      ctx.lineWidth = tr.lineWidth ?? (tr.lineDash ? 1.45 : 2.0);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(tr.lineDash || []);
      const count = Math.min(viewT.length, tr.data.length);
      for (let i = 0; i < count; i++) {
        const xp = getX(viewT[i]);
        const yp = drawMid - (tr.data[i] / (yMax || 1)) * (plotH / 2);
        if (i === 0) ctx.moveTo(xp, yp);
        else ctx.lineTo(xp, yp);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    ctx.restore();

    if (hover && hover.x >= padLeft && hover.x <= padLeft + plotW) {
      ctx.strokeStyle = 'rgba(0, 122, 255, 0.65)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hover.x, padTop);
      ctx.lineTo(hover.x, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!compactVertical) {
      ctx.fillStyle = '#6E6E73';
      ctx.font = '9.5px "Nura", "Jura", "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(xLabel, padLeft + plotW * 0.7, height - 1);
    }
  }, [
    boxSize,
    viewT,
    laneTraces,
    xUnitMultiplier,
    xLabel,
    voltGain,
    yBoundOverride,
    isPrimaryTriggerLane,
    trigLevel,
    showTrigLine,
    hover,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !viewT || viewT.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 40;
    const padRight = 22;
    const plotW = rect.width - padLeft - padRight;

    if (mouseX >= padLeft && mouseX <= padLeft + plotW) {
      const frac = (mouseX - padLeft) / plotW;
      const tVal = viewT[0] + frac * (viewT[viewT.length - 1] - viewT[0]);
      const idx = Math.min(viewT.length - 1, Math.max(0, Math.round(frac * (viewT.length - 1))));
      setHover({
        x: mouseX,
        tVal,
        values: [laneTrace, ...attachedOverlays].map((tr) => ({
          label: tr.label,
          color: toScopePhosphorColor(tr.color),
          val: tr.data[idx] ?? 0,
        })),
      });
    } else {
      setHover(null);
    }
  };

  return (
    <div
      onClick={onSelectMeasure}
      style={
        boxHeightPx === 'flex'
          ? { padding: '10px' }
          : { padding: '10px', height: `${boxHeightPx}px` }
      }
      className={`relative bg-white rounded-xl border border-[#AAAAAA]/35 hover:border-[#007AFF]/55 transition-colors flex flex-col box-border ${
        boxHeightPx === 'flex' ? 'flex-1 min-h-0' : ''
      }`}
    >
      {/* Signal Box Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1 mb-1 border-b border-[#AAAAAA]/20 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: laneTrace.color }}
          />
          <span
            className="text-[11px] font-bold truncate"
            style={{ color: laneTrace.color }}
          >
            CH{channelIdx + 1} · {laneTrace.label}
          </span>
          {attachedOverlays.map((ov) => (
            <span
              key={ov.id}
              className="text-[10px] font-medium whitespace-nowrap"
              style={{ color: ov.color }}
            >
              + {ov.label}
            </span>
          ))}
          {laneTrace.sublabel && (
            <span className="text-[10px] text-[#6E6E73] hidden sm:inline truncate">
              · {laneTrace.sublabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[10px] text-[#52525B] tabular-nums">
            Vpp {stats.vpp.toFixed(2)}V
            {stats.freqKHz !== null ? ` · ${stats.freqKHz.toFixed(2)} kHz` : ''}
          </span>
          {allowExpandDialog && onExpandDialog && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpandDialog();
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F5F5F7] hover:bg-[#007AFF] hover:text-white border border-[#AAAAAA]/35 text-[10px] font-semibold text-[#1D1D1F] transition-colors cursor-pointer"
              title={`Open ${laneTrace.label} in widescreen dialog`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>Expand</span>
            </button>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      <div ref={wrapperRef} className="relative flex-1 min-h-0 w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
          onDoubleClick={allowExpandDialog ? onExpandDialog : undefined}
          className="block w-full h-full cursor-crosshair"
        />
        {hover && (
          <div
            className="absolute top-1.5 pointer-events-none bg-white/95 border border-[#AAAAAA]/40 rounded-lg px-2 py-1.5 text-[10.5px] font-nura text-[#1D1D1F] shadow-lg z-20 tabular-nums backdrop-blur-xs"
            style={{ left: Math.min(hover.x + 12, Math.max(10, boxSize.w - 175)) }}
          >
            <div className="text-[#007AFF] font-semibold mb-0.5">
              t = {(hover.tVal * xUnitMultiplier).toFixed(3)} {xUnitMultiplier === 1000 ? 'ms' : 's'}
            </div>
            {hover.values.map((v, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[#52525B]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                  {v.label}
                </span>
                <span className="text-[#1D1D1F] font-semibold">{v.val.toFixed(2)} V</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   Main Oscilloscope Component (AMBOX DSO-204)
   ============================================================================ */
export const DarkOscilloscopeCanvas: React.FC<DarkOscilloscopeProps> = ({
  t,
  traces,
  mode,
  xUnitMultiplier = 1000,
  xLabel = 'Time / ms',
  height = 390,
  yBoundOverride,
  instrumentVariant = 'dso',
  insideDialog = false,
  fillContainer = false,
  renderParameters,
}) => {
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const laneYBoundRef = useRef<Record<string, number>>({});
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 600,
    height,
  });
  const [hover, setHover] = useState<{
    x: number;
    tVal: number;
    values: { label: string; color: string; val: number }[];
  } | null>(null);

  // Real DSO Front-Panel State
  const [isHold, setIsHold] = useState<boolean>(false);
  const [frozenSnap, setFrozenSnap] = useState<{ t: number[]; traces: DarkTrace[] } | null>(null);
  const [timeZoom, setTimeZoom] = useState<number>(1);
  const [voltGain, setVoltGain] = useState<number>(1);
  const [trigLevel, setTrigLevel] = useState<number>(0);
  const [showTrigLine, setShowTrigLine] = useState<boolean>(false);
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const [selectedMeasureIdx, setSelectedMeasureIdx] = useState<number>(0);
  const [channelsCollapsed, setChannelsCollapsed] = useState<boolean>(true);

  // Widescreen Dialog Modal State ('__ALL__' or primary channel ID)
  const [wideDialogTarget, setWideDialogTarget] = useState<string | null>(null);
  const [wideDialogViewMode, setWideDialogViewMode] = useState<'stacked' | 'overlay'>('overlay');

  const isCompact = instrumentVariant === 'compact';

  const activeSource = isHold && frozenSnap ? frozenSnap : { t, traces };

  const toggleHold = () => {
    if (!isHold) {
      setFrozenSnap({
        t: [...t],
        traces: traces.map((tr) => ({ ...tr, data: [...tr.data] })),
      });
      setIsHold(true);
    } else {
      setFrozenSnap(null);
      setIsHold(false);
    }
  };

  const handleAutoSet = () => {
    setTimeZoom(1);
    setVoltGain(1);
    setTrigLevel(0);
    setShowTrigLine(false);
    setHiddenIds({});
    if (isHold) {
      setFrozenSnap(null);
      setIsHold(false);
    }
  };

  const toggleChannel = (id: string) => {
    setHiddenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Close widescreen dialog on Escape
  useEffect(() => {
    if (!wideDialogTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWideDialogTarget(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [wideDialogTarget]);

  // Apply internal DSO Timebase Zoom (window slicing)
  const { viewT, viewTraces } = useMemo(() => {
    const rawT = activeSource.t || [];
    const rawTraces = activeSource.traces || [];
    if (rawT.length === 0) return { viewT: rawT, viewTraces: rawTraces };

    const count =
      timeZoom <= 1
        ? rawT.length
        : Math.max(36, Math.floor(rawT.length / timeZoom));

    return {
      viewT: rawT.slice(0, count),
      viewTraces: rawTraces.map((tr) => ({
        ...tr,
        data: tr.data.slice(0, count),
      })),
    };
  }, [activeSource.t, activeSource.traces, timeZoom]);

  const dedupedTraces = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [
      ...viewTraces.filter((tr) => !tr.overlayOnId),
      ...viewTraces.filter((tr) => Boolean(tr.overlayOnId)),
    ];
    return ordered.filter((tr) => {
      if (seen.has(tr.label)) return false;
      seen.add(tr.label);
      return true;
    });
  }, [viewTraces]);

  const primaryChannels = useMemo(
    () => viewTraces.filter((tr) => !tr.overlayOnId),
    [viewTraces]
  );

  const visibleTraces = useMemo(
    () => viewTraces.filter((tr) => !hiddenIds[tr.id]),
    [viewTraces, hiddenIds]
  );

  const visibleDeduped = useMemo(
    () => dedupedTraces.filter((tr) => !hiddenIds[tr.id]),
    [dedupedTraces, hiddenIds]
  );

  const visiblePrimaryChannels = useMemo(
    () => primaryChannels.filter((tr) => !hiddenIds[tr.id]),
    [primaryChannels, hiddenIds]
  );

  const useIndividualSignalBoxes = !isCompact && mode === 'stacked' && primaryChannels.length > 0;

  // Live hardware measurements for bottom DSO telemetry bar
  const liveStats = useMemo(() => {
    const pool = visibleDeduped.length > 0 ? visibleDeduped : dedupedTraces;
    const ch = pool[Math.min(selectedMeasureIdx, Math.max(0, pool.length - 1))];
    if (!ch || !ch.data || ch.data.length === 0) {
      return { label: 'CH1', vpp: 0, vrms: 0, vmax: 0, freqKHz: null as number | null };
    }
    const s = computeSignalStats(viewT, ch.data);
    return { label: ch.label, ...s };
  }, [visibleDeduped, dedupedTraces, selectedMeasureIdx, viewT]);

  // Traces filtered for the widescreen dialog
  const dialogTraces = useMemo(() => {
    if (!wideDialogTarget) return [];
    if (wideDialogTarget === '__ALL__') return traces;
    const chosenPrimary = traces.find((tr) => tr.id === wideDialogTarget);
    if (!chosenPrimary) return traces;
    const overlays = traces.filter((tr) => tr.overlayOnId === chosenPrimary.id);
    return [chosenPrimary, ...overlays];
  }, [wideDialogTarget, traces]);

  const dialogChannelLabel = useMemo(() => {
    if (!wideDialogTarget) return '';
    if (wideDialogTarget === '__ALL__') return 'All Active Channels';
    const idx = primaryChannels.findIndex((tr) => tr.id === wideDialogTarget);
    const ch = primaryChannels[idx];
    return ch ? `CH${idx + 1} · ${ch.label}` : 'Signal';
  }, [wideDialogTarget, primaryChannels]);

  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        if (w > 0) {
          setContainerSize((prev) => ({
            width: w,
            height: fillContainer && h > 0 ? h : prev.height,
          }));
        }
      }
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [useIndividualSignalBoxes, fillContainer]);

  const effectiveCanvasHeight = fillContainer ? Math.max(160, containerSize.height) : height;

  useEffect(() => {
    if (useIndividualSignalBoxes) return;
    const canvas = canvasRef.current;
    if (!canvas || !viewT || viewT.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = containerSize.width;
    const drawH = effectiveCanvasHeight;
    if (width < 10 || drawH < 10) return;

    canvas.width = width * dpr;
    canvas.height = drawH * dpr;
    ctx.scale(dpr, dpr);

    // Crisp White Oscilloscope Screen background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, drawH);

    const padLeft = 42;
    const padRight = 22;
    const padTop = 14;
    const padBottom = 26;
    const plotW = Math.max(20, width - padLeft - padRight);
    const plotH = Math.max(20, drawH - padTop - padBottom);

    // Subtle outer graticule border
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    const tMin = viewT[0];
    const tMax = viewT[viewT.length - 1] || 1;
    const getX = (tv: number) => padLeft + ((tv - tMin) / (tMax - tMin || 1)) * plotW;

    // 10-division Horizontal Graticule (real DSO divisions)
    const xDivs = 10;
    ctx.font = '10px "Nura", "Jura", "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'top';

    for (let i = 0; i <= xDivs; i++) {
      const frac = i / xDivs;
      const xPix = padLeft + frac * plotW;
      const isCenter = i === xDivs / 2;

      ctx.strokeStyle = isCenter ? 'rgba(29, 29, 31, 0.22)' : 'rgba(29, 29, 31, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash(isCenter ? [] : [2, 3]);
      ctx.beginPath();
      ctx.moveTo(xPix, padTop);
      ctx.lineTo(xPix, padTop + plotH);
      ctx.stroke();

      if (i === 0 || i === 2 || i === 5 || i === 8 || i === 10) {
        const tVal = (tMin + frac * (tMax - tMin)) * xUnitMultiplier;
        const unitStr = xUnitMultiplier === 1000 ? 'ms' : 's';
        ctx.fillStyle = '#6E6E73';
        ctx.textAlign = i === 10 ? 'right' : i === 0 ? 'left' : 'center';
        ctx.fillText(
          `${tVal.toFixed(tVal < 10 && tVal % 1 !== 0 ? 1 : 0)} ${unitStr}`,
          xPix,
          padTop + plotH + 7
        );
      }
    }
    ctx.setLineDash([]);

    let maxAbs = 0.2;
    visibleDeduped.forEach((tr) => {
      for (let i = 0; i < tr.data.length; i++) {
        const a = Math.abs(tr.data[i]);
        if (isFinite(a) && a > maxAbs) maxAbs = a;
      }
    });
    const candidateOverlayBound = stableYBound(maxAbs);
    const prevOverlayBound = laneYBoundRef.current['__overlay__'];
    let baseBound = candidateOverlayBound;
    if (yBoundOverride && yBoundOverride > 0) {
      baseBound = yBoundOverride;
    } else if (prevOverlayBound !== undefined) {
      if (maxAbs * 1.06 > prevOverlayBound || maxAbs * 1.55 < prevOverlayBound) {
        baseBound = candidateOverlayBound;
      } else {
        baseBound = prevOverlayBound;
      }
    }
    laneYBoundRef.current['__overlay__'] = baseBound;
    const yMax = baseBound / Math.max(0.25, voltGain);
    const midY = padTop + plotH / 2;

    // 8-division Horizontal Graticule
    const yDivs = 8;
    for (let r = 0; r <= yDivs; r++) {
      const yp = padTop + (r / yDivs) * plotH;
      const isMid = r === yDivs / 2;
      ctx.strokeStyle = isMid ? 'rgba(29, 29, 31, 0.22)' : 'rgba(29, 29, 31, 0.08)';
      ctx.setLineDash(isMid ? [] : [2, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, yp);
      ctx.lineTo(padLeft + plotW, yp);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Center axis sub-ticks
    ctx.strokeStyle = 'rgba(29, 29, 31, 0.22)';
    ctx.beginPath();
    for (let s = 1; s < 50; s++) {
      const sx = padLeft + (s / 50) * plotW;
      ctx.moveTo(sx, midY - 2.5);
      ctx.lineTo(sx, midY + 2.5);
    }
    for (let s = 1; s < 40; s++) {
      const sy = padTop + (s / 40) * plotH;
      ctx.moveTo(padLeft + plotW / 2 - 2.5, sy);
      ctx.lineTo(padLeft + plotW / 2 + 2.5, sy);
    }
    ctx.stroke();

    // Trigger Level Line
    if (showTrigLine || Math.abs(trigLevel) > 0.02) {
      const trigY = midY - (trigLevel / (yMax || 1)) * (plotH / 2);
      if (trigY >= padTop && trigY <= padTop + plotH) {
        ctx.strokeStyle = 'rgba(29, 29, 31, 0.55)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, trigY);
        ctx.lineTo(padLeft + plotW, trigY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#1D1D1F';
        ctx.font = '700 9px "Nura", "Jura", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('T▸', padLeft + 2, trigY);
      }
    }

    ctx.fillStyle = '#6E6E73';
    ctx.font = '9.5px "Nura", "Jura", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${yMax.toFixed(1)}`, padLeft - 6, padTop + 4);
    ctx.fillText('0', padLeft - 6, midY);
    ctx.fillText(`-${yMax.toFixed(1)}`, padLeft - 6, padTop + plotH - 4);

    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotW, plotH);
    ctx.clip();

    visibleDeduped.forEach((tr) => {
      const dispCol = toScopePhosphorColor(tr.color);
      ctx.beginPath();
      ctx.strokeStyle = dispCol;
      ctx.lineWidth = tr.lineDash ? 1.55 : 2.0;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(tr.lineDash || []);
      const count = Math.min(viewT.length, tr.data.length);
      for (let i = 0; i < count; i++) {
        const xp = getX(viewT[i]);
        const yp = midY - (tr.data[i] / (yMax || 1)) * (plotH / 2);
        if (i === 0) ctx.moveTo(xp, yp);
        else ctx.lineTo(xp, yp);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    ctx.restore();

    if (hover && hover.x >= padLeft && hover.x <= padLeft + plotW) {
      ctx.strokeStyle = 'rgba(0, 122, 255, 0.65)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hover.x, padTop);
      ctx.lineTo(hover.x, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#6E6E73';
    ctx.font = '10px "Nura", "Jura", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(xLabel, padLeft + plotW * 0.7, drawH - 2);
  }, [
    useIndividualSignalBoxes,
    viewT,
    visibleDeduped,
    effectiveCanvasHeight,
    containerSize.width,
    hover,
    xUnitMultiplier,
    xLabel,
    yBoundOverride,
    voltGain,
    trigLevel,
    showTrigLine,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !viewT || viewT.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 42;
    const padRight = 22;
    const plotW = rect.width - padLeft - padRight;

    if (mouseX >= padLeft && mouseX <= padLeft + plotW) {
      const frac = (mouseX - padLeft) / plotW;
      const tVal = viewT[0] + frac * (viewT[viewT.length - 1] - viewT[0]);
      const idx = Math.min(viewT.length - 1, Math.max(0, Math.round(frac * (viewT.length - 1))));
      setHover({
        x: mouseX,
        tVal,
        values: visibleDeduped.map((tr) => ({
          label: tr.label,
          color: toScopePhosphorColor(tr.color),
          val: tr.data[idx] ?? 0,
        })),
      });
    } else {
      setHover(null);
    }
  };

  const totalDurSec = viewT.length > 1 ? Math.max(1e-6, viewT[viewT.length - 1] - viewT[0]) : 0.0045;
  const divTimeLabel = formatDivTime(totalDurSec, 10, xUnitMultiplier);

  const canvasElement = (
    <div
      ref={canvasWrapperRef}
      className={`relative w-full bg-white overflow-hidden ${fillContainer ? 'flex-1 min-h-0' : ''}`}
      style={fillContainer ? undefined : { height: `${height}px` }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        className="block cursor-crosshair"
      />
      {hover && (
        <div
          className="absolute top-2.5 pointer-events-none bg-white/95 border border-[#AAAAAA]/40 rounded-lg px-2.5 py-2 text-[11px] font-nura text-[#1D1D1F] shadow-lg z-20 tabular-nums backdrop-blur-xs"
          style={{ left: Math.min(hover.x + 12, Math.max(10, containerSize.width - 190)) }}
        >
          <div className="text-[#007AFF] font-semibold mb-1">
            t = {(hover.tVal * xUnitMultiplier).toFixed(3)} {xUnitMultiplier === 1000 ? 'ms' : 's'}
          </div>
          {hover.values.map((v, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[#52525B]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                {v.label}
              </span>
              <span className="text-[#1D1D1F] font-semibold">{v.val.toFixed(2)} V</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isCompact) {
    return (
      <div className="rounded-lg overflow-hidden bg-white">
        {canvasElement}
      </div>
    );
  }

  return (
    <>
      <div
        className={`bg-white rounded-xl border border-[#AAAAAA]/35 overflow-hidden shadow-2xs font-nura text-[#1D1D1F] ${
          fillContainer ? 'h-full flex flex-col' : ''
        }`}
      >
        {/* Top DSO Hardware Bezel Header */}
        <div className="px-3 py-1.5 bg-[#F5F5F7] border-b border-[#AAAAAA]/30 flex flex-wrap items-center justify-between gap-2 text-[10px] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-bold tracking-wider text-[#1D1D1F]">AMBOX DSO-204</span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold tracking-wider ${
                isHold
                  ? 'bg-[#1D1D1F] text-white border border-[#1D1D1F]'
                  : 'bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isHold ? 'bg-[#AAAAAA]' : 'bg-[#007AFF] animate-pulse'}`} />
              {isHold ? 'HOLD' : "TRIG'D"}
            </span>
            <span className="hidden sm:inline text-[#6E6E73] tabular-nums">
              {divTimeLabel} · ↗ {trigLevel.toFixed(2)}V
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {!insideDialog && (
              <button
                type="button"
                onClick={() => {
                  setWideDialogViewMode(mode === 'stacked' ? 'stacked' : 'overlay');
                  setWideDialogTarget('__ALL__');
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:border-[#007AFF] hover:text-[#007AFF] border border-[#AAAAAA]/35 text-[10px] font-semibold text-[#1D1D1F] transition-colors cursor-pointer"
                title="Open widescreen oscilloscope dialog"
              >
                <Maximize2 className="w-2.5 h-2.5" />
                <span>Widescreen</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleHold}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer transition-colors ${
                isHold
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-white hover:border-[#007AFF] hover:text-[#007AFF] text-[#1D1D1F] border-[#AAAAAA]/35'
              }`}
              title={isHold ? 'Resume live acquisition' : 'Freeze waveform snapshot (Single/Hold)'}
            >
              {isHold ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5" />}
              <span>{isHold ? 'Run' : 'Stop'}</span>
            </button>
            <button
              type="button"
              onClick={handleAutoSet}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:border-[#007AFF] hover:text-[#007AFF] border border-[#AAAAAA]/35 text-[10px] font-semibold text-[#1D1D1F] transition-colors cursor-pointer"
              title="Auto-Set timebase, gain, and trigger"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Auto-Set</span>
            </button>
          </div>
        </div>

        {/* Individual Signal Boxes (Stacked) OR Combined Overlay Screen */}
        {useIndividualSignalBoxes ? (
          <div
            className={`p-2.5 bg-white ${
              fillContainer ? 'flex-1 min-h-0 flex flex-col gap-2 overflow-hidden' : 'space-y-2.5'
            }`}
          >
            {visiblePrimaryChannels.length === 0 ? (
              <div className="h-[100px] p-[10px] rounded-xl border border-dashed border-[#AAAAAA]/40 flex items-center justify-center text-xs text-[#6E6E73]">
                All channels hidden — toggle CH1..CH{primaryChannels.length} below to display signals.
              </div>
            ) : (
              primaryChannels.map((laneTrace, idx) => {
                if (hiddenIds[laneTrace.id]) return null;
                const attachedOverlays = visibleTraces.filter((tr) => tr.overlayOnId === laneTrace.id);
                return (
                  <SignalLaneBox
                    key={laneTrace.id}
                    channelIdx={idx}
                    laneTrace={laneTrace}
                    attachedOverlays={attachedOverlays}
                    viewT={viewT}
                    xUnitMultiplier={xUnitMultiplier}
                    xLabel={xLabel}
                    voltGain={voltGain}
                    yBoundOverride={yBoundOverride}
                    isPrimaryTriggerLane={idx === 0}
                    trigLevel={trigLevel}
                    showTrigLine={showTrigLine}
                    boxHeightPx={fillContainer ? 'flex' : 270}
                    allowExpandDialog={!insideDialog}
                    onExpandDialog={() => {
                      setWideDialogViewMode('overlay');
                      setWideDialogTarget(laneTrace.id);
                    }}
                    onSelectMeasure={() => setSelectedMeasureIdx(idx)}
                  />
                );
              })
            )}
          </div>
        ) : (
          canvasElement
        )}

        {/* Hardware Telemetry Readout Bar */}
        <div className="px-3 py-1.5 bg-[#F5F5F7] border-t border-[#AAAAAA]/30 flex flex-wrap items-center justify-between gap-2 text-[10px] tabular-nums shrink-0">
          <div className="flex flex-wrap items-center gap-3 text-[#52525B]">
            <span className="text-[#007AFF] font-semibold uppercase tracking-wider">
              MEAS ({liveStats.label})
            </span>
            <span>
              Vpp: <strong className="text-[#1D1D1F]">{liveStats.vpp.toFixed(2)} V</strong>
            </span>
            <span>
              Vrms: <strong className="text-[#1D1D1F]">{liveStats.vrms.toFixed(2)} V</strong>
            </span>
            <span>
              Vmax: <strong className="text-[#1D1D1F]">{liveStats.vmax.toFixed(2)} V</strong>
            </span>
            {liveStats.freqKHz !== null && (
              <span>
                Freq: <strong className="text-[#1D1D1F]">{liveStats.freqKHz.toFixed(2)} kHz</strong>
              </span>
            )}
          </div>
          <span className="text-[#6E6E73]">DC · 1MΩ</span>
        </div>

        {/* Tactile Bottom DSO Control Deck */}
        <div className="px-3 py-2 bg-white border-t border-[#AAAAAA]/30 flex flex-wrap items-center justify-between gap-2.5 text-[10px] shrink-0">
          {/* Channel Enable Checkboxes with Collapse Toggle */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setChannelsCollapsed((c) => !c)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#AAAAAA]/35 bg-[#F5F5F7] text-[#1D1D1F] text-[10px] font-semibold hover:border-[#007AFF] cursor-pointer"
              title={channelsCollapsed ? 'Expand channel checkboxes' : 'Collapse channel checkboxes'}
            >
              <span>Channels</span>
              {channelsCollapsed ? (
                <ChevronRight className="w-3 h-3 text-[#6E6E73]" />
              ) : (
                <ChevronDown className="w-3 h-3 text-[#6E6E73]" />
              )}
            </button>

            {!channelsCollapsed &&
              (useIndividualSignalBoxes ? primaryChannels : dedupedTraces).map((tr, idx) => {
                const hidden = Boolean(hiddenIds[tr.id]);
                const checked = !hidden;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => {
                      toggleChannel(tr.id);
                      setSelectedMeasureIdx(idx);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border cursor-pointer transition-all ${
                      hidden
                        ? 'bg-[#F5F5F7] border-[#AAAAAA]/30 text-[#8E8E93] opacity-75 hover:border-[#AAAAAA]'
                        : 'bg-white border-[#AAAAAA]/45 text-[#1D1D1F] font-semibold hover:border-[#007AFF]'
                    }`}
                    title={`Toggle CH${idx + 1} (${tr.label})`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ${
                        checked
                          ? 'bg-[#007AFF]/10 border-[#007AFF]'
                          : 'bg-white border-[#AAAAAA]/60'
                      }`}
                    >
                      {checked && <Check className="w-2.5 h-2.5 text-[#007AFF]" strokeWidth={3} />}
                    </span>
                    <span>CH{idx + 1}</span>
                  </button>
                );
              })}
          </div>

          {/* Timebase, Vertical Gain & Trigger Level Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Time/div */}
            <div className="flex items-center gap-1 bg-[#F5F5F7] border border-[#AAAAAA]/30 rounded-md px-1.5 py-0.5">
              <span className="text-[#6E6E73] uppercase tracking-wider mr-0.5">Time</span>
              <button
                type="button"
                onClick={() =>
                  setTimeZoom((z) => {
                    const i = TIME_ZOOM_STEPS.indexOf(z);
                    return TIME_ZOOM_STEPS[Math.max(0, (i === -1 ? 0 : i) - 1)];
                  })
                }
                disabled={timeZoom <= TIME_ZOOM_STEPS[0]}
                className="px-1 text-[#1D1D1F] hover:text-[#007AFF] disabled:opacity-35 cursor-pointer font-bold"
                title="Zoom out timebase"
              >
                −
              </button>
              <span className="text-[#007AFF] font-semibold tabular-nums min-w-[24px] text-center">
                {timeZoom}×
              </span>
              <button
                type="button"
                onClick={() =>
                  setTimeZoom((z) => {
                    const i = TIME_ZOOM_STEPS.indexOf(z);
                    return TIME_ZOOM_STEPS[Math.min(TIME_ZOOM_STEPS.length - 1, (i === -1 ? 0 : i) + 1)];
                  })
                }
                disabled={timeZoom >= TIME_ZOOM_STEPS[TIME_ZOOM_STEPS.length - 1]}
                className="px-1 text-[#1D1D1F] hover:text-[#007AFF] disabled:opacity-35 cursor-pointer font-bold"
                title="Zoom in timebase"
              >
                +
              </button>
            </div>

            {/* V/div Gain */}
            <div className="flex items-center gap-1 bg-[#F5F5F7] border border-[#AAAAAA]/30 rounded-md px-1.5 py-0.5">
              <span className="text-[#6E6E73] uppercase tracking-wider mr-0.5">V/div</span>
              <button
                type="button"
                onClick={() =>
                  setVoltGain((g) => {
                    const i = VOLT_GAIN_STEPS.indexOf(g);
                    return VOLT_GAIN_STEPS[Math.max(0, (i === -1 ? 1 : i) - 1)];
                  })
                }
                disabled={voltGain <= VOLT_GAIN_STEPS[0]}
                className="px-1 text-[#1D1D1F] hover:text-[#007AFF] disabled:opacity-35 cursor-pointer font-bold"
                title="Decrease vertical gain"
              >
                −
              </button>
              <span className="text-[#007AFF] font-semibold tabular-nums min-w-[26px] text-center">
                {voltGain}×
              </span>
              <button
                type="button"
                onClick={() =>
                  setVoltGain((g) => {
                    const i = VOLT_GAIN_STEPS.indexOf(g);
                    return VOLT_GAIN_STEPS[Math.min(VOLT_GAIN_STEPS.length - 1, (i === -1 ? 1 : i) + 1)];
                  })
                }
                disabled={voltGain >= VOLT_GAIN_STEPS[VOLT_GAIN_STEPS.length - 1]}
                className="px-1 text-[#1D1D1F] hover:text-[#007AFF] disabled:opacity-35 cursor-pointer font-bold"
                title="Increase vertical gain"
              >
                +
              </button>
            </div>

            {/* Trigger Level */}
            <div className="flex items-center gap-1.5 bg-[#F5F5F7] border border-[#AAAAAA]/30 rounded-md px-2 py-0.5">
              <span className="text-[#1D1D1F] font-semibold uppercase tracking-wider">Trig</span>
              <input
                type="range"
                min={-1.5}
                max={1.5}
                step={0.05}
                value={trigLevel}
                onMouseDown={() => setShowTrigLine(true)}
                onTouchStart={() => setShowTrigLine(true)}
                onChange={(e) => {
                  setShowTrigLine(true);
                  setTrigLevel(Number(e.target.value));
                }}
                className="studio-slider w-16 cursor-pointer"
                aria-label="Oscilloscope trigger level"
              />
              <span className="text-[#1D1D1F] tabular-nums w-9 text-right">
                {trigLevel >= 0 ? '+' : ''}
                {trigLevel.toFixed(1)}V
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Zero-Scroll Widescreen Oscilloscope Dialog Box + Direct Parameter Access */}
      {!insideDialog && wideDialogTarget && (
        <div
          className="fixed inset-0 z-[55] bg-[#1D1D1F]/45 backdrop-blur-xs flex items-center justify-center p-2 md:p-3 font-nura"
          onClick={() => setWideDialogTarget(null)}
        >
          <div
            className="bg-white border border-[#AAAAAA]/35 rounded-2xl shadow-2xl w-full max-w-[97vw] xl:max-w-7xl h-[95vh] max-h-[95vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Widescreen Dialog Header */}
            <div className="px-4 py-2 bg-[#F5F5F7] border-b border-[#AAAAAA]/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-baseline gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                  WIDESCREEN OSCILLOSCOPE
                </span>
                <h3 className="text-sm font-bold text-[#1D1D1F]">{dialogChannelLabel}</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Switch between individual channels or All Channels */}
                <div className="flex flex-wrap items-center gap-1 bg-white p-0.5 rounded-lg border border-[#AAAAAA]/30">
                  {primaryChannels.map((ch, idx) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        setWideDialogTarget(ch.id);
                        setWideDialogViewMode('overlay');
                      }}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                        wideDialogTarget === ch.id
                          ? 'bg-[#007AFF] text-white font-semibold'
                          : 'text-[#52525B] hover:text-[#1D1D1F]'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            wideDialogTarget === ch.id ? '#FFFFFF' : ch.color,
                        }}
                      />
                      <span>CH{idx + 1}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWideDialogTarget('__ALL__')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      wideDialogTarget === '__ALL__'
                        ? 'bg-[#1D1D1F] text-white font-semibold'
                        : 'text-[#52525B] hover:text-[#1D1D1F]'
                    }`}
                  >
                    All
                  </button>
                </div>

                {wideDialogTarget === '__ALL__' && (
                  <div className="flex bg-white p-0.5 rounded-lg border border-[#AAAAAA]/30 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setWideDialogViewMode('stacked')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        wideDialogViewMode === 'stacked'
                          ? 'bg-[#007AFF] text-white font-semibold'
                          : 'text-[#6E6E73]'
                      }`}
                    >
                      Stacked
                    </button>
                    <button
                      type="button"
                      onClick={() => setWideDialogViewMode('overlay')}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${
                        wideDialogViewMode === 'overlay'
                          ? 'bg-[#007AFF] text-white font-semibold'
                          : 'text-[#6E6E73]'
                      }`}
                    >
                      Overlay
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setWideDialogTarget(null)}
                  className="p-1 rounded-lg bg-white border border-[#AAAAAA]/35 text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
                  aria-label="Close widescreen oscilloscope dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Zero-Scroll Side-by-Side Body: Widescreen Scope + Accessible Signal Parameters */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-white">
              <div className="flex-1 min-w-0 min-h-0 p-2.5 flex flex-col">
                <DarkOscilloscopeCanvas
                  t={t}
                  traces={dialogTraces}
                  mode={wideDialogTarget === '__ALL__' ? wideDialogViewMode : 'overlay'}
                  xUnitMultiplier={xUnitMultiplier}
                  xLabel={xLabel}
                  yBoundOverride={yBoundOverride}
                  insideDialog
                  fillContainer
                />
              </div>

              {renderParameters && (
                <aside className="w-full lg:w-[270px] shrink-0 bg-[#F5F5F7] border-t lg:border-t-0 lg:border-l border-[#AAAAAA]/30 flex flex-col min-h-0 max-h-[42vh] lg:max-h-none overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-[#AAAAAA]/25 flex items-center gap-1.5 text-[11px] font-bold text-[#1D1D1F] shrink-0">
                    <Sliders className="w-3.5 h-3.5 text-[#1D1D1F]" />
                    <span>Signal parameters</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3">
                    {renderParameters}
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
