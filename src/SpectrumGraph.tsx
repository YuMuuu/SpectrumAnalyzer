export type SpectrumBin = {
  level: number;
  peak: number;
};

export type SpectrumGraphProps = {
  bars: SpectrumBin[];
  sampleRate: number;
  fftSize: number;
  className?: string;
};

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatHz(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 Hz';
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)} kHz`;
  }

  return `${Math.round(value)} Hz`;
}

function lerp(a: number, b: number, t: number) {
  return a + ((b - a) * t);
}

const minDb = -120;
const maxDb = 0;
const minHz = 10;
const maxHz = 20000;

function resampleBars(bars: SpectrumBin[], targetCount: number): SpectrumBin[] {
  if (bars.length === 0 || targetCount <= 0) {
    return [];
  }

  if (bars.length === targetCount) {
    return bars;
  }

  if (bars.length === 1) {
    return Array.from({ length: targetCount }, () => bars[0]);
  }

  return Array.from({ length: targetCount }, (_, index) => {
    const position = (index / Math.max(1, targetCount - 1)) * (bars.length - 1);
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(bars.length - 1, leftIndex + 1);
    const t = position - leftIndex;
    const left = bars[leftIndex];
    const right = bars[rightIndex];

    return {
      level: lerp(left.level, right.level, t),
      peak: lerp(left.peak, right.peak, t),
    };
  });
}

export default function SpectrumGraph({bars, sampleRate, fftSize, className}: SpectrumGraphProps) {
  const width = 1000;
  const height = 560;
  const padding = { top: 28, right: 28, bottom: 64, left: 28 };
  const axisLabelFontSize = 'var(--spectrum-axis-label-font-size, 10px)';
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const upperHz = Math.min(maxHz, sampleRate / 2);
  const gridHz = [minHz, 100, 1000, 10000, upperHz].filter((value, index, values) => value > 0 && values.indexOf(value) === index);
  const gridDb = [0, -15, -30, -60, -90, -120];

  const points = resampleBars(
    bars.length > 0 ? bars : Array.from({ length: 72 }, () => ({ level: 0, peak: 0 })),
    Math.max(2, (bars.length > 0 ? bars.length : 72) * 2),
  );

  function levelToY(level: number) {
    return padding.top + ((1 - clampUnit(level)) * plotHeight);
  }

  const linePoints = points.map((bar, index) => {
    const x = padding.left + (index / Math.max(1, points.length - 1)) * plotWidth;

    return {
      x,
      y: levelToY(bar.level),
    };
  });

  const areaPath = [
    `M ${padding.left} ${padding.top + plotHeight}`,
    ...linePoints.map((point) => `L ${point.x} ${point.y}`),
    `L ${padding.left + plotWidth} ${padding.top + plotHeight}`,
    'Z',
  ].join(' ');

  const linePath = linePoints.length > 0
    ? `M ${linePoints.map((point) => `${point.x} ${point.y}`).join(' L ')}`
    : '';

  const xTicks = gridHz.map((hz) => {
    const ratio = upperHz > minHz ? Math.log10(Math.max(hz, minHz) / minHz) / Math.log10(upperHz / minHz) : 0;
    const x = padding.left + clampUnit(ratio) * plotWidth;

    return { hz, x };
  });

  return (
    <div className={`relative ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`Spectrum analyzer, ${fftSize}-point FFT`}
      >
        <defs>
          <linearGradient id="spectrum-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(97, 232, 214, 0.50)" />
            <stop offset="55%" stopColor="rgba(97, 232, 214, 0.18)" />
            <stop offset="100%" stopColor="rgba(97, 232, 214, 0.00)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="20" fill="rgba(5, 11, 20, 0.92)" />

        {gridDb.map((db) => {
          const ratio = clampUnit((db - minDb) / (maxDb - minDb));
          const y = padding.top + ((1 - ratio) * plotHeight);

          return (
            <g key={db}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(145, 166, 191, 0.10)" strokeWidth="1" />
            </g>
          );
        })}

        {xTicks.map(({hz, x}) => (
          <g key={hz}>
            <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(145, 166, 191, 0.10)" strokeWidth="1" />
          </g>
        ))}

        <path d={areaPath} fill="url(#spectrum-area)" />
        <path d={linePath} fill="none" stroke="#61e8d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="spectrum-axis-labels pointer-events-none absolute inset-0">
        {xTicks.map(({hz, x}, index) => (
          <div
            key={hz}
            className={[
              'spectrum-axis-label absolute whitespace-nowrap text-gotham-text/78',
              index === 0 ? 'spectrum-axis-label-first' : '',
              index === xTicks.length - 1 ? 'spectrum-axis-label-last' : '',
              hz === 10000 ? 'spectrum-axis-label-10khz' : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${(x / width) * 100}%`, top: '78%' }}
          >
            <span className="block select-none whitespace-nowrap font-normal leading-none tracking-[0.08em]" style={{ fontSize: axisLabelFontSize }}>
              {formatHz(hz)}
            </span>
          </div>
        ))}

      </div>
    </div>
  );
}
