import { ExclamationTriangleIcon } from '@heroicons/react/20/solid';

import SpectrumGraph, { type SpectrumGraphProps } from './SpectrumGraph';
import VolumeMeter from './VolumeMeter';

export type SpectrumAnalyzerProps = Omit<SpectrumGraphProps, 'className'> & {
  error?: PluginError | null;
};

function formatHz(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 Hz';
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} kHz`;
  }

  return `${Math.round(value)} Hz`;
}

function StatPill({label, value}: {label: string; value: string}) {
  return (
    <div className="spectrum-stat-pill rounded-full border border-gotham-line bg-gotham-panel px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-gotham-muted">
      <span className="text-gotham-text">{label}</span> <span className="text-gotham-accent">{value}</span>
    </div>
  );
}

function ErrorBanner({message}: {message: string}) {
  return (
    <div className="rounded-[1.25rem] border border-gotham-alert/40 bg-gotham-alert/12 px-4 py-3 text-sm text-gotham-alert shadow-[0_0_0_1px_rgba(255,184,77,0.08)]">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="leading-5">{message}</p>
      </div>
    </div>
  );
}

export default function SpectrumAnalyzer(props: SpectrumAnalyzerProps) {
  const sampleRate = props.sampleRate ?? 48000;
  const fftSize = props.fftSize ?? 2048;
  const meterLevel = props.bars.length > 0
    ? Math.max(...props.bars.map((bar) => Math.max(bar.level, bar.peak)))
    : 0;
  const meterPeak = props.bars.length > 0
    ? Math.max(...props.bars.map((bar) => bar.peak))
    : 0;

  return (
    <div className="spectrum-root h-screen overflow-hidden bg-gotham-shell text-gotham-text">
      <div className="spectrum-shell relative h-full overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
        <div className="gotham-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="spectrum-frame relative mx-auto flex h-full w-full max-w-[1500px] flex-col rounded-[2rem] border border-gotham-line bg-gotham-window/92 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-6">
          <header className="spectrum-header flex flex-wrap items-end justify-between gap-4 border-b border-gotham-line pb-4">
            <div>
              <h1
                className="spectrum-title text-3xl font-semibold tracking-[0.3em] text-gotham-text sm:text-4xl"
              >
                SPECTRUM ANALYZER
              </h1>
            </div>
            <div className="spectrum-stats flex flex-wrap items-center gap-2">
              <StatPill label="mode" value="live" />
              <StatPill label="rate" value={formatHz(sampleRate)} />
              <StatPill label="fft" value={`${fftSize}`} />
            </div>
          </header>

          <main className="spectrum-main mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {props.error ? <ErrorBanner message={props.error.message} /> : null}

            <section className="spectrum-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-gotham-line bg-gotham-panel/88 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(72,218,194,0.11),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(249,199,79,0.07),transparent_38%)]" />
              <div className="spectrum-visuals relative mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden lg:flex-row">
                <SpectrumGraph
                  bars={props.bars}
                  sampleRate={sampleRate}
                  fftSize={fftSize}
                  className="spectrum-graph relative min-h-[320px] flex-1 overflow-hidden rounded-[1.25rem] border border-gotham-line/70 bg-[linear-gradient(180deg,rgba(5,11,20,0.82)_0%,rgba(8,15,27,0.95)_100%)]"
                />

                <VolumeMeter
                  level={meterLevel}
                  peak={meterPeak}
                  className="spectrum-meter h-[220px] w-full lg:h-auto lg:w-[132px] lg:ml-0"
                />
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
