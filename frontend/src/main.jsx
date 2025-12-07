import { h, render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
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
    <div class="battery-chip">
      <div class="battery-meter">
        <div
          class="battery-fill"
          style={{ width: `${Math.min(100, Math.max(0, level))}%`, background: fillColor }}
        />
      </div>
      <div class="battery-meta">
        <span class="battery-level">{level === null || level === undefined ? '—' : `${level}%`}</span>
        <span class="battery-state" style={{ color: fillColor }}>
          {charging ? '⚡️' : saver ? '🟡' : '🔋'} {capacityLabel || ''}
        </span>
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

function DeviceGallery({ devices, onSelect }) {
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
          <button key={device.serial} class="gallery-card" onClick={() => onSelect(device)}>
            <div class="gallery-thumb">
              <div class={`tablet-shell small ${wallpaperClass(device.wallpaper_hint)}`} style={device.wallpaper_url ? { backgroundImage: `url(${device.wallpaper_url})` } : {}} />
            </div>
            <div class="gallery-meta">
              <div class="card-title">{device.model}</div>
              <div class="subtext">{device.state} • {device.serial}</div>
              <div class="subtext">Android {device.android_version || '—'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeviceHero({ device, onChangeDevice }) {
  if (!device) return null;
  const modeBanner = device.state === 'fastboot' ? 'FASTBOOT' : device.state === 'fastbootd' ? 'FASTBOOTD' : '';
  return (
    <div class="hero">
      <div class="hero-header">
        <div>
          <p class="muted">Universal Flasher Tool</p>
          <h2>{device.model || 'OnePlus Pad 2'}</h2>
          <p class="subtext">{device.firmware_version || device.build || '—'}</p>
        </div>
        <button class="button ghost" onClick={onChangeDevice}>↩︎ Выбрать другое устройство</button>
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
            <div class="info-value">{device.firmware_version || device.build || '—'}</div>
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

function ActionPalette({ filter, onFilterChange, selected, onSelect }) {
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
    <div class="palette">
      <div class="palette-head">
        <h3>Действия</h3>
        <input
          class="search"
          value={filter}
          onInput={(e) => onFilterChange(e.target.value)}
          placeholder="Поиск по действиям"
        />
      </div>
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
    </div>
  );
}

function FlashPanel({ firmwarePath, onPathChange, onValidate, onFlash, log }) {
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
          <div class="subtext">Укажи архив, распакованную папку или перетащи любой img</div>
        </div>
        <div class="toolbar">
          <button class="button" onClick={onValidate}>Проверить архив</button>
          <button class="button primary" onClick={onFlash}>Старт прошивки</button>
        </div>
      </div>
      <div class="grid two">
        <div class="info-pill">
          <div class="info-label">Путь к прошивке</div>
          <input
            style={{ width: '100%', marginTop: '6px' }}
            value={firmwarePath}
            placeholder="/Users/me/Downloads/OxygenOS.zip"
            onInput={(e) => onPathChange(e.target.value)}
          />
          <label class="file-input">
            <input type="file" onChange={(e) => onPathChange(e.target.files?.[0]?.path || e.target.files?.[0]?.name || '')} />
            <span>Выбрать файл</span>
          </label>
        </div>
        <div class="info-pill">
          <div class="info-label">Консоль</div>
          <div class="terminal small">{log.join('\n')}</div>
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
  const [selectedAction, setSelectedAction] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const appendLog = (line) => setConsoleLog((prev) => [...prev.slice(-100), line]);

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

  const handleValidate = async () => {
    if (firmwarePath) await callApi('set_firmware_path', firmwarePath);
    const result = await callApi('validate_firmware');
    appendLog(`Валидация: ${result.message}`);
  };

  const handleFlash = async () => {
    const result = await callApi('flash');
    appendLog(`Прошивка: ${result.status} — ${result.message}`);
  };

  const handlePrepareRoot = async (tool) => {
    const result = await callApi('prepare_root', tool);
    appendLog(`${tool}: ${result.message}`);
  };

  const handleScrcpyStart = async () => {
    const result = await callApi('start_scrcpy');
    appendLog(`scrcpy: ${result.message}`);
  };

  const handleScrcpyStop = async () => {
    const result = await callApi('stop_scrcpy');
    appendLog(`scrcpy: ${result.message}`);
  };

  const renderAction = () => {
    switch (selectedAction) {
      case 'flash':
        return <FlashPanel firmwarePath={firmwarePath} onPathChange={setFirmwarePath} onValidate={handleValidate} onFlash={handleFlash} log={consoleLog} />;
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
        <DeviceGallery devices={devices} onSelect={handleDeviceSelect} />
      </div>
    );
  }

  return (
    <div class="app-shell">
      <div class="left-rail">
        <DeviceHero device={selectedDevice} onChangeDevice={() => setShowPicker(true)} />
        {showPicker && <DeviceGallery devices={devices} onSelect={handleDeviceSelect} />}
      </div>
      <div class="right-panel">
        <ActionPalette filter={actionFilter} onFilterChange={setActionFilter} selected={selectedAction} onSelect={setSelectedAction} />
        <div class="action-area">{renderAction()}</div>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('app'));
