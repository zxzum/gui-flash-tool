import { h } from 'preact';
import StatusPill from '../components/StatusPill.jsx';

export default function ToolsPage({ platformStatus, onRefreshPlatform, device }) {
  return (
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Инструменты</h1>
          <p class="subtext">Platform-tools, scrcpy, ADB действия</p>
        </div>
        <div class="toolbar">
          <StatusPill state={device?.state || '—'} />
          <button class="button" onClick={onRefreshPlatform}>↻ Проверить platform-tools</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Platform-Tools</div>
            <div class="subtext">Проверка adb / fastboot для macOS (M-chip)</div>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-pill">
            <div class="info-label">Статус</div>
            <div class="info-value">{platformStatus?.installed ? 'Обнаружен' : 'Не найден'}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Путь</div>
            <div class="info-value">{platformStatus?.location || '—'}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">adb</div>
            <div class="info-value">{platformStatus?.adb_version || '—'}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">fastboot</div>
            <div class="info-value">{platformStatus?.fastboot_version || '—'}</div>
          </div>
        </div>
        {!platformStatus?.installed && <div class="subtext" style={{ marginTop: '10px' }}>{platformStatus?.install_hint}</div>}
      </div>
    </div>
  );
}
