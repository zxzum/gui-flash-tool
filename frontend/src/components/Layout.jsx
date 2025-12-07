import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import BatteryBadge from './battery/BatteryBadge.jsx';
import StatusPill from './StatusPill.jsx';

export default function Layout({ actions, onNavigate, collapsed, onToggleCollapse, selectedDevice, devices, onRefreshDevices, children }) {
  const [hovered, setHovered] = useState(false);
  const deviceState = useMemo(() => selectedDevice?.state || '—', [selectedDevice]);

  return (
    <div class="layout">
      <aside class={`sidebar ${collapsed ? 'collapsed' : ''} ${hovered ? 'hovered' : ''}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div class="sidebar-header">
          <div>
            <div class="brand">Universal Flasher Tool</div>
            <div class="subtext">OnePlus Pad 2 • OxygenOS</div>
          </div>
          <button class="button ghost" onClick={onToggleCollapse}>{collapsed ? '▶' : '◀'}</button>
        </div>

        <div class="device-quick">
          <div class="device-label">{selectedDevice?.model || 'Нет устройства'}</div>
          <div class="device-meta">{selectedDevice?.serial || '—'}</div>
          <StatusPill state={deviceState} compact />
          <BatteryBadge battery={selectedDevice?.battery} compact />
        </div>

        <div class="nav">
          {actions.map((action) => (
            <button class="nav-item" onClick={() => onNavigate(action.href)} key={action.id}>
              <span class="nav-icon">{action.icon}</span>
              {!collapsed && (
                <span>
                  <div class="nav-title">{action.title}</div>
                  <div class="nav-sub">{action.subtitle}</div>
                </span>
              )}
            </button>
          ))}
        </div>

        <div class="sidebar-footer">
          <button class="button ghost tiny" onClick={onRefreshDevices}>↻ Обновить устройства ({devices.length})</button>
        </div>
      </aside>

      <main class="content">{children}</main>
    </div>
  );
}
