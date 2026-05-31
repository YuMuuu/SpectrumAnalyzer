type VolumeMeterProps = {
  level: number;
  peak?: number;
  className?: string;
};

function clampUnit(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatDb(value: number) {
  return `${value} dB`;
}

export default function VolumeMeter({level, peak = level, className}: VolumeMeterProps) {
  const clippedLevel = clampUnit(level);
  const clippedPeak = clampUnit(peak);
  const tickMarks = [0, -12, -24, -36, -48];

  return (
    <div className={`flex h-full flex-col rounded-[1.25rem] border border-gotham-line/70 bg-[linear-gradient(180deg,rgba(5,11,20,0.82)_0%,rgba(8,15,27,0.95)_100%)] p-3 ${className ?? ''}`}>
      <div className="spectrum-meter-inner flex min-h-0 flex-1 gap-3">
        <div className="spectrum-meter-labels flex flex-col justify-between py-1 text-[10px] leading-none text-gotham-text/62">
          {tickMarks.map((tick) => (
            <span key={tick} className="select-none font-normal tracking-[0.08em]">
              {formatDb(tick)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden border border-gotham-line/65 bg-[linear-gradient(180deg,rgba(10,19,32,0.95)_0%,rgba(4,8,15,0.98)_100%)]">
          <div
            className="absolute inset-x-[2px] bottom-[2px] bg-[linear-gradient(180deg,rgba(97,232,214,0.18)_0%,rgba(97,232,214,0.88)_100%)] shadow-[0_0_18px_rgba(97,232,214,0.22)]"
            style={{ height: `${clippedLevel * 100}%` }}
          />
          <div
            className="absolute inset-x-[2px] border border-white/12 bg-white/5"
            style={{
              bottom: `${Math.min(98, clippedPeak * 100)}%`,
              height: '2px',
              transform: 'translateY(50%)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
