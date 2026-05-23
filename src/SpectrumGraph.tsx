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
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} kHz`;
  }

  return `${Math.round(value)} Hz`;
}

function lerp(a: number, b: number, t: number) {
  return a + ((b - a) * t);
}

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
  const axisLabelFontSize = '10px';
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const nyquist = sampleRate / 2;
  const gridHz = [20, 100, 1000, 5000, nyquist].filter((value, index, values) => value > 0 && values.indexOf(value) === index);

  const points = resampleBars(
    bars.length > 0 ? bars : Array.from({ length: 72 }, () => ({ level: 0, peak: 0 })),
    Math.max(2, (bars.length > 0 ? bars.length : 72) * 2),
  );

  const linePoints = points.map((bar, index) => {
    const x = padding.left + (index / Math.max(1, points.length - 1)) * plotWidth;
    const magnitudeDb = -96 + (clampUnit(bar.level) * 96);
    const y = padding.top + ((1 - clampUnit(bar.level)) * plotHeight);

    return {
      x,
      y,
      db: magnitudeDb,
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
    const ratio = nyquist > 0 ? Math.log10(Math.max(hz, 20) / 20) / Math.log10(Math.max(nyquist, 20) / 20) : 0;
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

        {xTicks.map(({hz, x}) => (
          <g key={hz}>
            <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(145, 166, 191, 0.10)" strokeWidth="1" />
          </g>
        ))}

        <path d={areaPath} fill="url(#spectrum-area)" />
        <path d={linePath} fill="none" stroke="#61e8d6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {xTicks.map(({hz, x}) => (
          <div
            key={hz}
            className="absolute -translate-x-1/2 whitespace-nowrap text-gotham-text/78"
            style={{ left: `${(x / width) * 100}%`, top: `${((height - 20) / height) * 100}%` }}
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
