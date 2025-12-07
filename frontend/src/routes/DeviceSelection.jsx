import { h } from 'preact';
import DeviceGallery from '../components/DeviceGallery.jsx';

export default function DeviceSelection({ devices, onSelect, onRefreshWallpaper, onRefreshDevices }) {
  return (
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Выбор устройства</h1>
          <p class="subtext">ADB / fastboot / fastbootd • автоматический выбор если одно устройство</p>
        </div>
        <div class="toolbar">
          <button class="button" onClick={onRefreshDevices}>↻ Обновить</button>
        </div>
      </div>
      <DeviceGallery devices={devices} onSelect={onSelect} onRefreshWallpaper={onRefreshWallpaper} />
    </div>
  );
}
