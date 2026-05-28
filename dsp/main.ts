import { Renderer, el } from '@elemaudio/core';

import { parseDspState } from './types';

type RenderBatch = unknown[];
type RawFftEvent = {
  type: 'fft';
  event: {
    source?: string;
    data: {
      real: number[];
      imag: number[];
    };
  };
};
type DspEvent = RawFftEvent | {
  type: string;
  event: unknown;
};

const core = new Renderer((batch: RenderBatch) => {
  globalThis.__postNativeMessage__?.(JSON.stringify(batch));
});

let prevState: { sampleRate: number } | null = null;

const floorAmplitude = 1e-12;

function shouldRender(prev: { sampleRate: number } | null, next: { sampleRate: number }) {
  return prev === null || prev.sampleRate !== next.sampleRate;
}

function renderGraph() {
  const left = el.fft({ key: 'spectrum-left', name: 'left' }, el.in({ channel: 0 }));
  const right = el.fft({ key: 'spectrum-right', name: 'right' }, el.in({ channel: 1 }));

  const stats = core.render(left, right);

  console.log(stats);
}

function fftEventToDb(event: RawFftEvent) {
  const {real, imag} = event.event.data;
  const complexSize = real.length;
  const fftSize = Math.max(2, (complexSize - 1) * 2);
  const db = new Array<number>(complexSize);
  const amplitudeScale = 1 / fftSize;

  for (let i = 0; i < complexSize; ++i) {
    const singleSidedScale = (i === 0 || i === complexSize - 1) ? 1 : 2;
    const magnitude = Math.hypot(real[i] ?? 0, imag[i] ?? 0);
    const normalizedAmplitude = Math.max(floorAmplitude, magnitude * singleSidedScale * amplitudeScale);

    db[i] = 20 * Math.log10(normalizedAmplitude);
  }

  return {
    type: 'fft',
    event: {
      source: event.event.source,
      data: {
        db,
      },
    },
  };
}

globalThis.__transformDspEvents__ = (serializedBatch: string) => {
  const events = JSON.parse(serializedBatch) as DspEvent[];

  return JSON.stringify(events.map((event) => (
    event.type === 'fft'
      ? fftEventToDb(event as RawFftEvent)
      : event
  )));
};

globalThis.__receiveStateChange__ = (serializedState: string) => {
  const state = parseDspState(serializedState);

  if (shouldRender(prevState, state)) {
    renderGraph();
  }

  prevState = state;
};
