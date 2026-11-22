import React from 'react';
import { LatexText } from './Latex';

interface DarkSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  formatValue?: (v: number) => string;
  minLabel?: string;
  maxLabel?: string;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const DarkSlider: React.FC<DarkSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  formatValue,
  minLabel,
  maxLabel,
  onChange,
  disabled = false,
}) => {
  const display = formatValue
    ? formatValue(value)
    : value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0);
  return (
    <div className={`param-control space-y-1 ${disabled ? 'opacity-45 pointer-events-none' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-[#52525B] truncate">
          <LatexText text={label} />
        </span>
        <span className="text-xs font-semibold text-[#1D1D1F] tabular-nums whitespace-nowrap shrink-0">
          {display}
          {unit && <span className="text-[10px] font-normal text-[#6E6E73] ml-1">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="studio-slider w-full cursor-pointer"
      />
      {(minLabel || maxLabel) && (
        <div className="flex items-center justify-between text-[9px] text-[#6E6E73] tabular-nums">
          <span>{minLabel ? <LatexText text={minLabel} /> : null}</span>
          <span>{maxLabel ? <LatexText text={maxLabel} /> : null}</span>
        </div>
      )}
    </div>
  );
};

interface DarkSegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface DarkSegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: DarkSegmentedOption<T>[];
  onChange: (val: T) => void;
}

export function DarkSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: DarkSegmentedProps<T>) {
  return (
    <div className="param-control space-y-1">
      {label && (
        <div className="text-[11px] font-medium text-[#52525B]">
          <LatexText text={label} />
        </div>
      )}
      <div className="flex bg-[#E5E5EA]/70 p-0.5 rounded-lg border border-[#AAAAAA]/30">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#1D1D1F] text-white font-semibold shadow-xs'
                  : 'text-[#52525B] hover:text-[#1D1D1F]'
              }`}
            >
              <LatexText text={opt.label} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DarkSectionHeaderProps {
  index: string;
  title: string;
}

export const DarkSectionHeader: React.FC<DarkSectionHeaderProps> = ({ index, title }) => (
  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#007AFF] border-b border-[#AAAAAA]/30 pb-1">
    {index} / <LatexText text={title} />
  </div>
);

interface DarkMetricBoxProps {
  label: string;
  value: string;
  accent?: 'lime' | 'amber' | 'cyan' | 'rose' | 'white';
}

export const DarkMetricBox: React.FC<DarkMetricBoxProps> = ({ label, value, accent = 'white' }) => {
  const colorClass =
    accent === 'lime'
      ? 'text-[#007AFF]'
      : accent === 'amber'
      ? 'text-[#1D1D1F]'
      : accent === 'cyan'
      ? 'text-[#007AFF]'
      : accent === 'rose'
      ? 'text-[#1D1D1F]'
      : 'text-[#1D1D1F]';

  return (
    <div className="bg-white border border-[#AAAAAA]/30 rounded-lg px-2.5 py-2">
      <div className="text-[9px] tracking-wider text-[#6E6E73] truncate">
        <LatexText text={label} />
      </div>
      <div className={`text-xs font-semibold mt-0.5 tabular-nums truncate ${colorClass}`}>
        <LatexText text={value} />
      </div>
    </div>
  );
};
