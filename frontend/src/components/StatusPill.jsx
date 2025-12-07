import { h } from 'preact';

const colorForState = (state) => {
  if (state === 'fastbootd') return '#f97316';
  if (state === 'fastboot') return '#fb7185';
  if (state === 'device' || state === 'recovery') return '#22c55e';
  return '#9ca3af';
};

export default function StatusPill({ state, compact = false }) {
  const normalized = state || '—';
  return (
    <span class={`status-pill ${compact ? 'compact' : ''}`} style={{ background: `${colorForState(normalized)}20`, color: colorForState(normalized) }}>
      ● {normalized.toUpperCase()}
    </span>
  );
}
