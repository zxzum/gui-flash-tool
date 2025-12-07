import { h } from 'preact';
import DeviceHero from '../components/DeviceHero.jsx';
import FirmwareTree from '../components/FirmwareTree.jsx';
import StatusPill from '../components/StatusPill.jsx';

export default function FlashPage({ device, firmwarePath, onPathChange, onValidate, onFlash, log, tree, validation, consoleCollapsed, onToggleConsole, onCaptureWallpaper, onRotateWallpaper, onChangeDevice }) {
  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      onPathChange(file.path || file.name);
    }
  };

  return (
    <div class="page" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <DeviceHero
        device={device}
        onCaptureWallpaper={onCaptureWallpaper}
        onRotateWallpaper={onRotateWallpaper}
        onChangeDevice={onChangeDevice}
      />

      <div class="card action-card">
        <div class="card-header">
          <div>
            <div class="card-title">Прошивка</div>
            <div class="subtext">Укажите распакованную папку или файл образа. Поддерживается drag & drop.</div>
          </div>
          <div class="toolbar">
            <StatusPill state={device?.state || '—'} />
            <button class="button" onClick={onValidate}>Проверить</button>
            <button class="button primary" disabled={!validation?.is_valid} onClick={onFlash}>Старт</button>
          </div>
        </div>
        <div class="flash-grid">
          <div class="path-column">
            <div class="info-label">Путь к прошивке</div>
            <div class="path-row">
              <input
                class="path-input"
                value={firmwarePath}
                placeholder="/Users/me/Downloads/OxygenOS или распакованный payload"
                onInput={(e) => onPathChange(e.target.value)}
              />
              <label class="file-input">
                <input type="file" webkitdirectory="true" onChange={(e) => onPathChange(e.target.files?.[0]?.path || e.target.files?.[0]?.name || '')} />
                <span>Выбрать</span>
              </label>
            </div>
            {validation && (
              <div class={`validation ${validation.is_valid ? 'valid' : 'invalid'}`}>
                <div>{validation.message}</div>
                {!!validation.missing?.length && <div class="muted">Отсутствует: {validation.missing.join(', ')}</div>}
                {!!validation.present?.length && <div class="muted">Обнаружено: {validation.present.join(', ')}</div>}
              </div>
            )}
            <div class="info-label">Обзор содержимого</div>
            <FirmwareTree tree={tree} />
          </div>
          <div class="console-column">
            <div class="console-header">
              <div class="info-label">Консоль прошивки</div>
              <button class="button ghost" onClick={onToggleConsole}>{consoleCollapsed ? '▼' : '▲'} Свернуть</button>
            </div>
            {!consoleCollapsed && <div class="terminal full">{log.join('\n')}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
