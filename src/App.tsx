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
      db?: number[];
      real?: number[];
      imag?: number[];
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
  dspEventCount: number;
  error: PluginError | null;
};

const barCount = 72;
const minDisplayHz = 10;
const maxDisplayHz = 20000;
const minDb = -120;
const maxDb = 0;
const attackSmoothing = 0.65;
const releaseSmoothing = 0.18;
const peakReleasePerFrame = 0.012;
const floorAmplitude = 1e-12;

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function dbToLevel(db: number) {
  return clampUnit((db - minDb) / (maxDb - minDb));
}

function rawFftToDb(real: number[], imag: number[]) {
  const complexSize = real.length;
  const fftSize = Math.max(2, (complexSize - 1) * 2);
  const amplitudeScale = 1 / fftSize;

  return Array.from({ length: complexSize }, (_, index) => {
    const singleSidedScale = (index === 0 || index === complexSize - 1) ? 1 : 2;
    const magnitude = Math.hypot(real[index] ?? 0, imag[index] ?? 0);
    const normalizedAmplitude = Math.max(floorAmplitude, magnitude * singleSidedScale * amplitudeScale);

    return 20 * Math.log10(normalizedAmplitude);
  });
}

function resampleBins(binDb: number[], sampleRate: number) {
  if (binDb.length === 0) {
    return Array.from({ length: barCount }, () => ({ level: 0, peak: 0 }));
  }

  const sourceCount = binDb.length;
  const nyquist = sampleRate / 2;
  const maxHz = Math.min(maxDisplayHz, nyquist);
  const sourceMaxIndex = Math.max(1, sourceCount - 1);
  const logSpan = Math.max(1, maxHz / minDisplayHz);

  return Array.from({ length: barCount }, (_, barIndex) => {
    const startRatio = barIndex / barCount;
    const endRatio = (barIndex + 1) / barCount;
    const startHz = barIndex === 0 ? 0 : minDisplayHz * Math.pow(logSpan, startRatio);
    const endHz = barIndex === barCount - 1 ? maxHz : minDisplayHz * Math.pow(logSpan, endRatio);
    const start = Math.max(0, Math.min(sourceCount - 1, Math.floor((startHz / nyquist) * sourceMaxIndex)));
    const end = Math.max(start + 1, Math.min(sourceCount, Math.ceil((endHz / nyquist) * sourceMaxIndex)));

    let db = minDb;

    for (let i = start; i < end && i < sourceCount; ++i) {
      db = Math.max(db, binDb[i]);
    }

    const level = dbToLevel(db);

    return {
      level,
      peak: level,
    };
  });
}

function smoothSpectrum(previous: SpectrumBin[], next: SpectrumBin[]) {
  return next.map((bin, index) => {
    const prev = previous[index] ?? { level: 0, peak: 0 };
    const smoothing = bin.level >= prev.level ? attackSmoothing : releaseSmoothing;
    const level = prev.level + ((bin.level - prev.level) * smoothing);
    const peak = Math.max(bin.level, prev.peak - peakReleasePerFrame);

    return {
      level,
      peak: clampUnit(peak),
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
  const db = Array.isArray(evt.event.data.db)
    ? evt.event.data.db
    : Array.isArray(evt.event.data.real) && Array.isArray(evt.event.data.imag)
      ? rawFftToDb(evt.event.data.real, evt.event.data.imag)
      : null;

  if (!db) {
    return {
      ...state,
      dspEventCount: state.dspEventCount + 1,
      error: {
        name: 'DSP Event Error',
        message: 'FFT event payload is missing both db and real/imag arrays.',
      },
    };
  }

  const fftSize = Math.max(2, (db.length - 1) * 2);
  const bins = resampleBins(db, state.sampleRate);
  const isRight = (evt.event.source ?? '').toLowerCase().includes('right');
  const leftSpectrum = isRight ? state.leftSpectrum : smoothSpectrum(state.leftSpectrum, bins);
  const rightSpectrum = isRight ? smoothSpectrum(state.rightSpectrum, bins) : state.rightSpectrum;

  return {
    ...state,
    fftSize,
    dspEventCount: state.dspEventCount + 1,
    error: null,
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
  dspEventCount: 0,
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
