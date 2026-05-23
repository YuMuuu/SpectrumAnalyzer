import { Renderer, el } from '@elemaudio/core';

import { parseDspState } from './types';

type RenderBatch = unknown[];

const core = new Renderer((batch: RenderBatch) => {
  globalThis.__postNativeMessage__?.(JSON.stringify(batch));
});

let prevState: { sampleRate: number } | null = null;

function shouldRender(prev: { sampleRate: number } | null, next: { sampleRate: number }) {
  return prev === null || prev.sampleRate !== next.sampleRate;
}

function renderGraph() {
  const left = el.fft({ key: 'spectrum-left', name: 'left' }, el.in({ channel: 0 }));
  const right = el.fft({ key: 'spectrum-right', name: 'right' }, el.in({ channel: 1 }));

  const stats = core.render(left, right);

  console.log(stats);
}

globalThis.__receiveStateChange__ = (serializedState: string) => {
  const state = parseDspState(serializedState);

  if (shouldRender(prevState, state)) {
    renderGraph();
  }

  prevState = state;
};
