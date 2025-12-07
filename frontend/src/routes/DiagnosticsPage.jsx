import { h } from 'preact';
import DeviceHero from '../components/DeviceHero.jsx';

export default function DiagnosticsPage({ device, onRefreshDevices }) {
  return (
    <div class="page">
      <DeviceHero device={device} onCaptureWallpaper={onRefreshDevices} onRotateWallpaper={onRefreshDevices} onChangeDevice={() => (window.location.href = '#/devices')} />
      <div class="card action-card">
        <div class="card-header">
          <div>
            <div class="card-title">Диагностика</div>
            <div class="subtext">SoC, ядро, батарея, память • запускается по кнопке</div>
          </div>
          <div class="toolbar">
            <button class="button" onClick={onRefreshDevices}>↻ Обновить</button>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-pill">
            <div class="info-label">SoC</div>
            <div class="info-value">{device?.soc?.friendly || device?.soc?.model || '—'}</div>
            <div class="muted">{device?.soc?.platform || ''}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Kernel</div>
            <div class="info-value">{device?.kernel?.release || '—'}</div>
            <div class="muted truncate">{device?.kernel?.full || ''}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Батарея</div>
            <div class="info-value">{device?.battery?.level ?? '—'}%</div>
            <div class="muted">{device?.battery?.capacity_label || device?.battery?.capacity_state || ''}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Память</div>
            <div class="info-value">{device?.storage?.summary || '—'}</div>
            <div class="muted">/data {device?.storage?.raw?.usage || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
