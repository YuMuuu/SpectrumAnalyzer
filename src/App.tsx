import { useStore as useZustandStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import Interface from './Interface'

type SpectrumBin = {
  level: number;
  peak: number;
};

type DspFftEvent = {
  type: 'fft';
  event: {
    source?: string;
    data: {
      real: number[];
      imag: number[];
    };
  };
};

type DspEvent = DspFftEvent | {
  type: string;
  event: unknown;
};

type AnalyzerState = {
  sampleRate: number;
  fftSize: number;
  leftSpectrum: SpectrumBin[];
  rightSpectrum: SpectrumBin[];
  spectrum: SpectrumBin[];
  error: PluginError | null;
};

const barCount = 72;

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function magnitudeToLevel(value: number) {
  const db = 20 * Math.log10(Math.max(value, 1e-7));
  return clampUnit((db + 88) / 88);
}

function resampleBins(levels: number[], peaks: number[]) {
  if (levels.length === 0) {
    return Array.from({ length: barCount }, () => ({ level: 0, peak: 0 }));
  }

  const sourceCount = levels.length;

  return Array.from({ length: barCount }, (_, barIndex) => {
    const start = Math.floor((barIndex / barCount) * sourceCount);
    const end = Math.max(start + 1, Math.floor(((barIndex + 1) / barCount) * sourceCount));

    let level = 0;
    let peak = 0;

    for (let i = start; i < end && i < sourceCount; ++i) {
      level = Math.max(level, levels[i]);
      peak = Math.max(peak, peaks[i] ?? 0);
    }

    return {
      level,
      peak,
    };
  });
}

function combineSpectra(left: SpectrumBin[], right: SpectrumBin[]) {
  const source = left.length > 0 ? left : right;

  if (source.length === 0) {
    return Array.from({ length: barCount }, () => ({ level: 0, peak: 0 }));
  }

  return source.map((bin, index) => ({
    level: Math.max(bin.level, right[index]?.level ?? 0),
    peak: Math.max(bin.peak, right[index]?.peak ?? 0),
  }));
}

function mergeFftEvent(state: AnalyzerState, evt: DspFftEvent) {
  const {real, imag} = evt.event.data;
  const levels = real.map((re, index) => magnitudeToLevel(Math.hypot(re, imag[index] ?? 0)));
  const peaks = levels.map((level) => Math.min(1, level + 0.02));
  const bins = resampleBins(levels, peaks);
  const isRight = (evt.event.source ?? '').toLowerCase().includes('right');
  const leftSpectrum = isRight ? state.leftSpectrum : bins;
  const rightSpectrum = isRight ? bins : state.rightSpectrum;

  return {
    ...state,
    fftSize: Math.max(2, (real.length - 1) * 2),
    leftSpectrum,
    rightSpectrum,
    spectrum: combineSpectra(leftSpectrum, rightSpectrum),
  };
}

const store = createStore<AnalyzerState>(() => ({
  sampleRate: 48000,
  fftSize: 2048,
  leftSpectrum: Array.from({ length: barCount }, () => ({ level: 0, peak: 0 })),
  rightSpectrum: Array.from({ length: barCount }, () => ({ level: 0, peak: 0 })),
  spectrum: Array.from({ length: barCount }, () => ({ level: 0, peak: 0 })),
  error: null,
}));

const useStore = () => useZustandStore(store);

if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.on('reload-dsp', () => {
    console.log('Sending reload dsp message');

    if (typeof globalThis.__postNativeMessage__ === 'function') {
      globalThis.__postNativeMessage__('reload');
    }
  });
}

globalThis.__receiveStateChange__ = function(state: string) {
  const parsed = JSON.parse(state) as PluginState;
  const nextSampleRate = typeof parsed.sampleRate === 'number' ? parsed.sampleRate : 48000;

  store.setState((prev) => ({
    ...prev,
    sampleRate: nextSampleRate,
  }));
};

globalThis.__receiveError__ = (err: PluginError) => {
  store.setState((prev) => ({ ...prev, error: err }));
};

globalThis.__receiveDspEvents__ = (batch: string) => {
  const events = JSON.parse(batch) as DspEvent[];

  store.setState((prev) => {
    let next = prev;

    for (const event of events) {
      if (event.type === 'fft') {
        next = mergeFftEvent(next, event as DspFftEvent);
      }
    }

    return next;
  });
};

export default function App() {
  const {sampleRate, fftSize, spectrum, error} = useStore();

  return (
    <Interface
      bars={spectrum}
      sampleRate={sampleRate}
      fftSize={fftSize}
      error={error} />
  );
}
