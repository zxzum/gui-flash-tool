import { h } from 'preact';
import StatusPill from './StatusPill.jsx';

const wallpaperClass = (hint) => {
  if (hint === 'fastbootd') return 'fastbootd';
  if (hint === 'fastboot') return 'fastboot';
  return 'oxygen';
};

export default function DeviceGallery({ devices, onSelect, onRefreshWallpaper }) {
  return (
    <div class="gallery">
      <div class="gallery-head">
        <div>
          <h2>Подключенные устройства</h2>
          <p class="subtext">ADB / fastboot / fastbootd определение</p>
        </div>
      </div>
      <div class="gallery-grid">
        {devices.map((device) => (
          <div key={device.serial} class="gallery-card">
            <button class="gallery-thumb" onClick={() => onSelect(device)}>
              <div class={`tablet-shell small ${wallpaperClass(device.wallpaper_hint)}`} style={device.wallpaper_url ? { backgroundImage: `url(${device.wallpaper_url})` } : {}} />
            </button>
            <div class="gallery-meta">
              <div class="card-title">{device.model}</div>
              <div class="subtext">{device.serial}</div>
              <div class="subtext">Android {device.android_version || '—'}</div>
              <StatusPill state={device.state} />
            </div>
            <button class="button ghost tiny" onClick={() => onRefreshWallpaper(device)}>…</button>
          </div>
        ))}
      </div>
    </div>
  );
}
