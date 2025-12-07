import { h, render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Toaster, toast } from 'react-hot-toast';
import './app.css';
import { callApi } from './api.js';

const actions = [
  { id: 'flash', icon: '🚀', title: 'Прошивка OnePlus', subtitle: 'OxygenOS архива или папки с образами' },
  { id: 'scrcpy', icon: '🖥️', title: 'Посмотреть экран (scrcpy)', subtitle: 'Зеркалирование и управление' },
  { id: 'adb', icon: '🛠️', title: 'Работа с ADB', subtitle: 'shell, logcat, быстрая перезагрузка' },
  { id: 'adb-tweaks', icon: '✨', title: 'Твики ADB', subtitle: 'gms doze, анимации, сетевые опции' },
  { id: 'root', icon: '🧰', title: 'Получение ROOT', subtitle: 'Magisk / KernelSU + модули' },
  { id: 'diagnostics', icon: '🔍', title: 'Диагностика', subtitle: 'SoC, ядро, батарея, память' },
  { id: 'platform', icon: '📦', title: 'Platform-Tools', subtitle: 'Проверка adb / fastboot / PATH' },
];

const batteryColor = (level = 0, charging, saver, capacityLabel) => {
  if (charging) return '#34d399';
  if (saver) return '#fcd34d';
  if (capacityLabel && capacityLabel === 'CRITICAL') return '#f87171';
  if (level <= 15) return '#f87171';
  if (level <= 35) return '#f59e0b';
  return '#22d3ee';
};

const wallpaperClass = (hint) => {
  if (hint === 'fastbootd') return 'fastbootd';
  if (hint === 'fastboot') return 'fastboot';
  return 'oxygen';
};

function BatteryBadge({ battery = {} }) {
  const level = battery.level ?? 0;
  const saver = battery.power_save;
  const charging = battery.charging;
  const capacityLabel = battery.capacity_label || battery.capacity_state;
  const fillColor = batteryColor(level, charging, saver, capacityLabel);
  return (
    <div class="battery-chip compact">
      <div class="battery-meter small">
        <div
          class="battery-fill"
          style={{ width: `${Math.min(100, Math.max(0, level))}%`, background: fillColor }}
        />
      </div>
      <div class="battery-meta one-line" style={{ color: fillColor }}>
        {charging ? '⚡️' : saver ? '🟡' : '🔋'} {level === null || level === undefined ? '—' : `${level}%`} {capacityLabel || ''}
      </div>
    </div>
  );
}

function PlatformToolsCard({ status, onRefresh }) {
  return (
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Platform-Tools</div>
          <div class="subtext">Проверка adb / fastboot для macOS (M-chip)</div>
        </div>
        <button class="button" onClick={onRefresh}>↻ Обновить</button>
      </div>
      <div class="info-grid">
        <div class="info-pill">
          <div class="info-label">Статус</div>
          <div class="info-value">{status.installed ? 'Обнаружен' : 'Не найден'}</div>
        </div>
        <div class="info-pill">
          <div class="info-label">Путь</div>
          <div class="info-value">{status.location || '—'}</div>
        </div>
        <div class="info-pill">
          <div class="info-label">adb</div>
          <div class="info-value">{status.adb_version || '—'}</div>
        </div>
        <div class="info-pill">
          <div class="info-label">fastboot</div>
          <div class="info-value">{status.fastboot_version || '—'}</div>
        </div>
      </div>
      {!status.installed && (
        <div class="subtext" style={{ marginTop: '10px' }}>
          {status.install_hint}
        </div>
      )}
    </div>
  );
}

function DeviceGallery({ devices, onSelect, onRefreshWallpaper }) {
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
              <div class="subtext">{device.state} • {device.serial}</div>
              <div class="subtext">Android {device.android_version || '—'}</div>
            </div>
            <button class="button ghost tiny" onClick={() => onRefreshWallpaper(device)}>…</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeviceHero({ device, onChangeDevice, onCaptureWallpaper, onRotateWallpaper }) {
  if (!device) return null;
  const modeBanner = device.state === 'fastboot' ? 'FASTBOOT' : device.state === 'fastbootd' ? 'FASTBOOTD' : '';
  return (
    <div class="hero">
      <div class="hero-header">
        <div>
          <p class="muted">Universal Flasher Tool</p>
          <h2>{device.model || 'OnePlus Pad 2'}</h2>
          <p class="subtext">
            {device.model_code ? `${device.model_code} • ` : ''}
            <span class="firmware-tag">{device.firmware_version || device.build || '—'}</span>
          </p>
        </div>
        <div class="hero-actions">
          <button class="button ghost" onClick={onCaptureWallpaper}>📸 Получить заставку</button>
          <button class="button ghost" onClick={onRotateWallpaper}>… Сменить мокап</button>
          <button class="button ghost" onClick={onChangeDevice}>↩︎ Выбрать другое устройство</button>
        </div>
      </div>
      <div class="hero-body">
        <div class="tablet-shell" style={device.wallpaper_url ? { backgroundImage: `url(${device.wallpaper_url})` } : {}}>
          <div class={`tablet-wallpaper ${wallpaperClass(device.wallpaper_hint)}`} />
          <div class="tablet-overlay" />
          {modeBanner && <div class="tablet-mode-banner">{modeBanner}</div>}
          <div class="tablet-label">
            <span>{device.model || 'OnePlus Pad 2'}</span>
            <BatteryBadge battery={device.battery} />
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
            <div class="info-value break">{device.firmware_version || device.build || '—'}</div>
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

function ActionPalette({ filter, onFilterChange, selected, onSelect, collapsed, onToggleCollapse }) {
  const filtered = useMemo(
    () =>
      actions.filter(
        (action) =>
          action.title.toLowerCase().includes(filter.toLowerCase()) ||
          action.subtitle.toLowerCase().includes(filter.toLowerCase())
      ),
    [filter]
  );

  return (
    <div class={`palette ${collapsed ? 'collapsed' : ''}`}>
      <div class="palette-head">
        <div class="palette-title-row">
          <h3>Действия</h3>
          <button class="button ghost" onClick={onToggleCollapse}>{collapsed ? '▶' : '◀'}</button>
        </div>
        {!collapsed && (
          <input
            class="search"
            value={filter}
            onInput={(e) => onFilterChange(e.target.value)}
            placeholder="Поиск по действиям"
          />
        )}
      </div>
      {!collapsed && (
        <div class="palette-grid">
          {filtered.map((action) => (
            <button
              key={action.id}
              class={`palette-card ${selected === action.id ? 'active' : ''}`}
              onClick={() => onSelect(action.id)}
            >
              <div class="palette-icon">{action.icon}</div>
              <div>
                <div class="card-title">{action.title}</div>
                <div class="subtext">{action.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FlashPanel({
  firmwarePath,
  onPathChange,
  onValidate,
  onFlash,
  log,
  deviceState,
  tree,
  validation,
  consoleCollapsed,
  onToggleConsole,
}) {
  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      onPathChange(file.path || file.name);
    }
  };
  return (
    <div class="card action-card" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div class="card-header">
        <div>
          <div class="card-title">Прошивка</div>
          <div class="subtext">.zip / папка с img, drag & drop, проводник или ручной путь</div>
        </div>
        <div class="toolbar">
          <StatusPill state={deviceState} />
          <button class="button" onClick={onValidate}>Проверить</button>
          <button class="button primary" onClick={onFlash}>Старт</button>
        </div>
      </div>
      <div class="flash-grid">
        <div class="path-column">
          <div class="info-label">Путь к прошивке</div>
          <div class="path-row">
            <input
              class="path-input"
              value={firmwarePath}
              placeholder="/Users/me/Downloads/OxygenOS.zip или /firmware/extracted"
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
  );
}

function RootPanel({ tools, onPrepare }) {
  return (
    <div class="card action-card">
      <div class="card-header">
        <div>
          <div class="card-title">Root и модули</div>
          <div class="subtext">Magisk / KernelSU + LSPosed, LuckyTools</div>
        </div>
      </div>
      <div class="root-grid">
        {tools.map((tool) => (
          <div key={tool.name} class="root-card">
            <div class="card-title">{tool.name}</div>
            <div class="subtext">Канал: {tool.channel}</div>
            <div class="divider" />
            <div class="toolbar">
              <button class="button" onClick={() => onPrepare(tool.name)}>Скачать / Записать</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosticsPanel({ diagnostics, device }) {
  return (
    <div class="card action-card">
      <div class="card-header">
        <div>
          <div class="card-title">Диагностика</div>
          <div class="subtext">SoC, ядро, батарея, хранилище</div>
        </div>
      </div>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="info-label">Хранилище</div>
          <div class="info-value">{diagnostics.storage}</div>
        </div>
        <div class="kpi">
          <div class="info-label">Батарея</div>
          <div class="info-value">{diagnostics.battery}</div>
        </div>
        <div class="kpi">
          <div class="info-label">SoC</div>
          <div class="info-value">{diagnostics.soc?.friendly || diagnostics.soc?.model || '—'}</div>
          <div class="muted">{diagnostics.soc?.vendor || diagnostics.soc?.platform || ''}</div>
        </div>
        <div class="kpi">
          <div class="info-label">Ядро</div>
          <div class="info-value">{diagnostics.kernel?.release || '—'}</div>
          <div class="muted">{(diagnostics.kernel?.full || '').slice(0, 64)}</div>
        </div>
      </div>
      <div class="divider" />
      <div class="terminal small">
        {(diagnostics.soc?.cpuinfo || '').split('\n').slice(0, 8).join('\n') || 'cpuinfo недоступен'}
      </div>
      <div class="divider" />
      <div class="info-grid">
        <div class="info-pill">
          <div class="info-label">Bootloader</div>
          <div class="info-value">{device?.bootloader || '—'}</div>
        </div>
        <div class="info-pill">
          <div class="info-label">Состояние</div>
          <div class="info-value">{device?.state || '—'}</div>
        </div>
        <div class="info-pill">
          <div class="info-label">Root</div>
          <div class="info-value">{device?.is_rooted ? 'Да' : 'Нет'}</div>
        </div>
      </div>
    </div>
  );
}

function ToolPanel({ onScrcpyStart, onScrcpyStop, log }) {
  return (
    <div class="card action-card">
      <div class="card-header">
        <div>
          <div class="card-title">Инструменты</div>
          <div class="subtext">scrcpy просмотр, fastbootd помощник</div>
        </div>
        <div class="toolbar">
          <button class="button" onClick={onScrcpyStart}>▶ scrcpy</button>
          <button class="button" onClick={onScrcpyStop}>■ стоп</button>
        </div>
      </div>
      <div class="terminal small">{log.join('\n')}</div>
    </div>
  );
}

function StatusPill({ state }) {
  const color = state === 'fastbootd' ? '#f97316' : state === 'fastboot' ? '#14b8a6' : '#22c55e';
  const label = state === 'fastbootd' ? 'FASTBOOTD' : state === 'fastboot' ? 'FASTBOOT' : 'ADB';
  return (
    <span class="status-pill" style={{ background: `${color}1a`, color }}>
      ● {label}
    </span>
  );
}

function FirmwareTree({ tree }) {
  if (!tree) return null;
  const renderNode = (node, depth = 0) => (
    <div class="tree-node" style={{ paddingLeft: `${depth * 12}px` }}>
      <span class="tree-branch">{node.type === 'dir' ? '📁' : '📄'}</span>
      <span>{node.name}</span>
      {(node.children || []).map((child) => renderNode(child, depth + 1))}
    </div>
  );
  return <div class="tree-view">{renderNode(tree)}</div>;
}

function Placeholder() {
  return (
    <div class="placeholder">
      <div class="card-title">Выберите действие</div>
      <p class="subtext">Слева список действий: прошивка, диагностика, scrcpy, root</p>
    </div>
  );
}

function App() {
  const [platformStatus, setPlatformStatus] = useState({ install_hint: '' });
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [firmwarePath, setFirmwarePath] = useState('');
  const [consoleLog, setConsoleLog] = useState([
    'Готово к прошивке OnePlus Pad 2',
    'Загрузите архив или распакованные образы',
  ]);
  const [rootTools, setRootTools] = useState([]);
  const [diagnostics, setDiagnostics] = useState({ storage: '—', battery: '—', thermals: '—', safety: {} });
  const [actionFilter, setActionFilter] = useState('');
  const [selectedAction, setSelectedAction] = useState('flash');
  const [showPicker, setShowPicker] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [firmwareTree, setFirmwareTree] = useState(null);
  const [validation, setValidation] = useState(null);

  const appendLog = (line) => setConsoleLog((prev) => [...prev.slice(-120), line]);

  const refreshPlatform = async () => {
    const status = await callApi('platform_tools_status');
    setPlatformStatus(status);
  };

  const refreshDevices = async () => {
    const list = await callApi('list_devices');
    setDevices(list);
    if (list.length && !selectedDevice) {
      setSelectedDevice(list[0]);
    }
  };

  const refreshDiagnostics = async () => {
    const result = await callApi('diagnostics');
    setDiagnostics(result);
  };

  const loadRootTools = async () => {
    const tools = await callApi('list_root_tools');
    setRootTools(tools);
  };

  const loadFirmwareTree = async () => {
    const tree = await callApi('inspect_firmware_tree');
    setFirmwareTree(tree?.tree);
  };

  useEffect(() => {
    refreshPlatform();
    refreshDevices();
    refreshDiagnostics();
    loadRootTools();
  }, []);

  const handleDeviceSelect = async (device) => {
    setSelectedDevice(device);
    setShowPicker(false);
    await callApi('select_device', device.serial);
    refreshDiagnostics();
  };

  const handlePathChange = async (path) => {
    setFirmwarePath(path);
    if (path) {
      await callApi('set_firmware_path', path);
      loadFirmwareTree();
    }
  };

  const handleValidate = async () => {
    if (firmwarePath) await callApi('set_firmware_path', firmwarePath);
    const result = await callApi('validate_firmware');
    setValidation(result);
    appendLog(`Валидация: ${result.message}`);
    toast[result.is_valid ? 'success' : 'error'](result.message);
  };

  const handleFlash = async () => {
    const result = await callApi('flash');
    appendLog(`Прошивка: ${result.status} — ${result.message}`);
    toast('Запущено: ' + (result.message || '')); 
  };

  const handlePrepareRoot = async (tool) => {
    const result = await callApi('prepare_root', tool);
    appendLog(`${tool}: ${result.message}`);
    toast(result.message);
  };

  const handleScrcpyStart = async () => {
    const result = await callApi('start_scrcpy');
    appendLog(`scrcpy: ${result.message}`);
  };

  const handleScrcpyStop = async () => {
    const result = await callApi('stop_scrcpy');
    appendLog(`scrcpy: ${result.message}`);
  };

  const handleCaptureWallpaper = async () => {
    if (!selectedDevice) return;
    const result = await callApi('refresh_wallpaper', selectedDevice.serial, selectedDevice.model);
    if (result?.wallpaper) {
      toast.success('Заставка обновлена');
      setSelectedDevice((prev) => ({ ...prev, wallpaper_url: result.wallpaper }));
    } else {
      toast.error('Не удалось получить заставку');
    }
  };

  const handleRotateWallpaper = async (device) => {
    const target = device || selectedDevice;
    if (!target) return;
    const result = await callApi('rotate_mock_image', target.serial, target.model);
    if (result?.wallpaper) {
      setSelectedDevice((prev) => (prev && prev.serial === target.serial ? { ...prev, wallpaper_url: result.wallpaper } : prev));
      setDevices((prev) => prev.map((d) => (d.serial === target.serial ? { ...d, wallpaper_url: result.wallpaper } : d)));
    }
  };

  const renderAction = () => {
    switch (selectedAction) {
      case 'flash':
        return (
          <FlashPanel
            firmwarePath={firmwarePath}
            onPathChange={handlePathChange}
            onValidate={handleValidate}
            onFlash={handleFlash}
            log={consoleLog}
            deviceState={selectedDevice?.state}
            tree={firmwareTree}
            validation={validation}
            consoleCollapsed={consoleCollapsed}
            onToggleConsole={() => setConsoleCollapsed((v) => !v)}
          />
        );
      case 'root':
        return <RootPanel tools={rootTools} onPrepare={handlePrepareRoot} />;
      case 'diagnostics':
        return <DiagnosticsPanel diagnostics={diagnostics} device={selectedDevice} />;
      case 'scrcpy':
        return <ToolPanel onScrcpyStart={handleScrcpyStart} onScrcpyStop={handleScrcpyStop} log={consoleLog} />;
      case 'platform':
        return <PlatformToolsCard status={platformStatus} onRefresh={refreshPlatform} />;
      default:
        return <Placeholder />;
    }
  };

  if (!selectedDevice) {
    return (
      <div class="app-shell onboarding">
        <div class="onboarding-pane">
          <h1>Universal Flasher Tool</h1>
          <p class="subtext">Выберите устройство, проверим Platform-Tools и начнем прошивку</p>
          <PlatformToolsCard status={platformStatus} onRefresh={refreshPlatform} />
        </div>
        <DeviceGallery devices={devices} onSelect={handleDeviceSelect} onRefreshWallpaper={handleRotateWallpaper} />
      </div>
    );
  }

  return (
    <div class="app-shell">
      <Toaster position="bottom-right" />
      <div class="left-rail">
        <DeviceHero
          device={selectedDevice}
          onChangeDevice={() => setShowPicker(true)}
          onCaptureWallpaper={handleCaptureWallpaper}
          onRotateWallpaper={handleRotateWallpaper}
        />
        {showPicker && (
          <DeviceGallery devices={devices} onSelect={handleDeviceSelect} onRefreshWallpaper={handleRotateWallpaper} />
        )}
      </div>
      <div class="right-panel">
        <ActionPalette
          filter={actionFilter}
          onFilterChange={setActionFilter}
          selected={selectedAction}
          onSelect={setSelectedAction}
          collapsed={paletteCollapsed}
          onToggleCollapse={() => setPaletteCollapsed((v) => !v)}
        />
        <div class={`action-area ${paletteCollapsed ? 'expanded' : ''}`}>{renderAction()}</div>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('app'));
