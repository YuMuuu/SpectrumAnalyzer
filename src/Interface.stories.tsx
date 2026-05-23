import type { Meta, StoryObj } from '@storybook/react-vite';

import SpectrumAnalyzer from './SpectrumAnalyzer';
import type { SpectrumBin } from './SpectrumGraph';

const barCount = 72;

function repeatPattern(pattern: number[]): SpectrumBin[] {
  return Array.from({ length: barCount }, (_, index) => {
    const level = pattern[index % pattern.length];

    return {
      level,
      peak: Math.min(1, level + 0.08),
    };
  });
}

const defaultBars = repeatPattern([
  0.18, 0.24, 0.31, 0.41, 0.54, 0.69, 0.84, 0.95, 0.86, 0.74, 0.6, 0.42,
]);

const denseBars = repeatPattern([
  0.28, 0.34, 0.42, 0.5, 0.6, 0.7, 0.8, 0.92, 0.98, 0.9, 0.76, 0.62,
]);

const brightBars = repeatPattern([
  0.58, 0.66, 0.74, 0.83, 0.92, 0.98, 0.88, 0.78, 0.7, 0.61, 0.53, 0.46,
]);

const meta = {
  title: 'Plugin/SpectrumAnalyzer',
  component: SpectrumAnalyzer,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    sampleRate: 48000,
    fftSize: 2048,
    error: null,
    bars: defaultBars,
  },
} satisfies Meta<typeof SpectrumAnalyzer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DenseRoom: Story = {
  args: {
    bars: denseBars,
  },
};

export const NeonLift: Story = {
  args: {
    bars: brightBars,
  },
};

export const WithError: Story = {
  args: {
    error: {
      message: 'FFT pipeline is offline',
    },
  },
};
