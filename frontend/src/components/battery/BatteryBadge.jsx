import { h } from 'preact';

const batteryColor = (level = 0, charging, saver, capacityLabel) => {
  if (charging) return '#34d399';
  if (saver) return '#fcd34d';
  if (capacityLabel && capacityLabel === 'CRITICAL') return '#f87171';
  if (level <= 15) return '#f87171';
  if (level <= 35) return '#f59e0b';
  return '#22d3ee';
};

export default function BatteryBadge({ battery = {}, compact = false }) {
  const level = battery.level ?? 0;
  const saver = battery.power_save;
  const charging = battery.charging;
  const capacityLabel = battery.capacity_label || battery.capacity_state;
  const fillColor = batteryColor(level, charging, saver, capacityLabel);
  return (
    <div class={`battery-chip ${compact ? 'compact' : ''}`}>
      <div class="battery-meter small">
        <div class="battery-fill" style={{ width: `${Math.min(100, Math.max(0, level))}%`, background: fillColor }} />
      </div>
      <div class="battery-meta one-line" style={{ color: fillColor }}>
        {charging ? '⚡️' : saver ? '🟡' : '🔋'} {level === null || level === undefined ? '—' : `${level}%`} {capacityLabel || ''}
      </div>
    </div>
  );
}
