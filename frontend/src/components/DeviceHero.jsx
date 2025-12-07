import { h } from 'preact';
import BatteryBadge from './battery/BatteryBadge.jsx';
import StatusPill from './StatusPill.jsx';

const wallpaperClass = (hint) => {
  if (hint === 'fastbootd') return 'fastbootd';
  if (hint === 'fastboot') return 'fastboot';
  return 'oxygen';
};

export default function DeviceHero({ device, onCaptureWallpaper, onRotateWallpaper, onChangeDevice }) {
  if (!device) return null;
  const modeBanner = device.state === 'fastboot' ? 'FASTBOOT' : device.state === 'fastbootd' ? 'FASTBOOTD' : '';
  const firmwareLabel = device.firmware_version?.replace(/^OPD\d+_/, '') || device.build || '—';
  return (
    <div class="hero">
      <div class="hero-header">
        <div>
          <p class="muted">Universal Flasher Tool</p>
          <h2>{device.model || 'OnePlus Pad 2'}</h2>
          <p class="subtext">
            {device.model_code ? `${device.model_code} • ` : ''}
            <span class="firmware-tag">{firmwareLabel}</span>
          </p>
        </div>
        <div class="hero-actions">
          <button class="button ghost" onClick={onCaptureWallpaper}>📸 Получить заставку</button>
          <button class="button ghost" onClick={onRotateWallpaper}>… Сменить мокап</button>
          <button class="button ghost" onClick={onChangeDevice}>↩︎ Смена устройства</button>
        </div>
      </div>
      <div class="hero-body">
        <div class="tablet-shell" style={device.wallpaper_url ? { backgroundImage: `url(${device.wallpaper_url})` } : {}}>
          <div class={`tablet-wallpaper ${wallpaperClass(device.wallpaper_hint)}`} />
          <div class="tablet-overlay" />
          {modeBanner && <div class="tablet-mode-banner">{modeBanner}</div>}
          <div class="tablet-label vertical">
            <div class="tablet-name">{device.model || 'OnePlus Pad 2'}</div>
            <div class="tablet-inline">
              <BatteryBadge battery={device.battery} compact />
              <StatusPill state={device.state} compact />
            </div>
          </div>
        </div>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="info-label">Android</div>
            <div class="info-value">{device.android_version || '—'}</div>
            <div class="muted">SDK {device.sdk_version || '—'}</div>
          </div>
          <div class="summary-card">
            <div class="info-label">Прошивка</div>
            <div class="info-value break">{firmwareLabel}</div>
            <div class="muted">Bootloader: {device.bootloader}</div>
          </div>
          <div class="summary-card">
            <div class="info-label">Память</div>
            <div class="info-value">{device.storage?.summary || '—'}</div>
            <div class="muted">/data {device.storage?.raw?.usage || '—'}</div>
          </div>
          <div class="summary-card">
            <div class="info-label">Root</div>
            <div class="info-value">{device.is_rooted ? 'Да' : 'Нет'}</div>
            <div class="muted">Статус: {device.state}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
