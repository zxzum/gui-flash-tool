import { h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './app.css';
import { callApi } from './api.js';

const navItems = [
  { id: 'device', label: 'Устройство', icon: '📱' },
  { id: 'flash', label: 'Прошивка', icon: '🚀' },
  { id: 'root', label: 'Root / Mods', icon: '🧰' },
  { id: 'diagnostics', label: 'Диагностика', icon: '🔍' },
  { id: 'tools', label: 'Инструменты', icon: '🖥️' },
];

const batteryColor = (level = 0, charging, saver) => {
  if (charging) return '#34d399';
  if (saver) return '#fcd34d';
  if (level <= 20) return '#f87171';
  if (level <= 40) return '#f59e0b';
  return '#22d3ee';
};

const wallpaperClass = (hint) => {
  if (hint === 'fastbootd') return 'fastbootd';
  if (hint === 'fastboot') return 'fastboot';
  return 'oxygen';
};

function Sidebar({ active, onSelect }) {
  return (
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-logo">OP</div>
        <div>
          <div class="card-title">OnePlus Pad 2</div>
          <div class="subtext">Universal Flasher</div>
        </div>
      </div>
      <div class="nav-group">
        {navItems.map((item) => (
          <div
            key={item.id}
            class={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function PlatformToolsCard({ status, onRefresh }) {
  return (
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Platform-Tools</div>
          <div class="subtext">Проверка adb / fastboot на macOS</div>
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

function BatteryChip({ battery = {} }) {
  const level = battery.level ?? 0;
  const saver = battery.power_save;
  const charging = battery.charging;
  const fillColor = batteryColor(level, charging, saver);
  return (
    <div class="battery-chip">
      <div class="battery-meter">
        <div
          class="battery-fill"
          style={{ width: `${Math.min(100, Math.max(0, level))}%`, background: fillColor }}
        />
      </div>
      <div>{level === null || level === undefined ? '—' : `${level}%`} </div>
      <div style={{ color: fillColor }}>{charging ? '⚡️' : saver ? '🟡' : '🔋'}</div>
    </div>
  );
}

function DeviceCard({ device }) {
  if (!device) return null;
  const modeBanner = device.state === 'fastboot' ? 'FASTBOOT' : device.state === 'fastbootd' ? 'FASTBOOTD' : '';
  return (
    <div class="card device-pane">
      <div class="card-header">
        <div>
          <div class="card-title">Подключенное устройство</div>
          <div class="subtext">ADB/Fastboot автоопределение</div>
        </div>
        <div class="badge">{device.state}</div>
      </div>
      <div class="device-frame">
        <div class="tablet-shell">
          <div class={`tablet-wallpaper ${wallpaperClass(device.wallpaper_hint)}`} />
          <div class="tablet-overlay" />
          {modeBanner && <div class="tablet-mode-banner">{modeBanner}</div>}
          <div class="tablet-label">
            <span>OnePlus Pad 2</span>
            <BatteryChip battery={device.battery} />
          </div>
        </div>
        <div class="info-grid">
          <div class="info-pill">
            <div class="info-label">Модель</div>
            <div class="info-value">{device.model}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Сборка</div>
            <div class="info-value">{device.build}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Android</div>
            <div class="info-value">{device.android_version || '—'}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Bootloader</div>
            <div class="info-value">{device.bootloader}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Root</div>
            <div class="info-value">{device.is_rooted ? 'Да' : 'Нет'}</div>
          </div>
          <div class="info-pill">
            <div class="info-label">Серийный</div>
            <div class="info-value">{device.serial}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlashPanel({ firmwarePath, onPathChange, onValidate, onFlash, log }) {
  return (
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Прошивка</div>
          <div class="subtext">Укажи архив или распакованный набор образов</div>
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
    <div class="card">
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

function DiagnosticsPanel({ diagnostics }) {
  return (
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Диагностика</div>
          <div class="subtext">Хранилище, термалы, безопасность</div>
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
          <div class="info-label">Температура</div>
          <div class="info-value">{diagnostics.thermals}</div>
        </div>
        <div class="kpi">
          <div class="info-label">Verified Boot</div>
          <div class="info-value">{diagnostics.safety?.verified_boot ? 'ON' : 'OFF'}</div>
        </div>
      </div>
      <div class="divider" />
      <div class="timeline">
        <div class="timeline-row">
          <div class="dot" />
          <div>
            <div class="card-title">ADB snapshot</div>
            <div class="subtext">Состояние и build.prop собраны</div>
          </div>
        </div>
        <div class="timeline-row">
          <div class="dot" style={{ background: '#f59e0b' }} />
          <div>
            <div class="card-title">Bootloader</div>
            <div class="subtext">lock/unlock + vbmeta сигналы</div>
          </div>
        </div>
        <div class="timeline-row">
          <div class="dot" style={{ background: '#22d3ee' }} />
          <div>
            <div class="card-title">Fastbootd ready</div>
            <div class="subtext">fastboot reboot fastboot проверка</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolPanel({ onScrcpyStart, onScrcpyStop, log }) {
  return (
    <div class="card">
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

function App() {
  const [activeTab, setActiveTab] = useState('device');
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

  const appendLog = (line) => setConsoleLog((prev) => [...prev.slice(-50), line]);

  const refreshPlatform = async () => {
    const status = await callApi('platform_tools_status');
    setPlatformStatus(status);
  };

  const refreshDevices = async () => {
    const list = await callApi('list_devices');
    setDevices(list);
    setSelectedDevice(list[0] || null);
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

  const renderContent = () => {
    switch (activeTab) {
      case 'device':
        return (
          <div class="grid">
            <PlatformToolsCard status={platformStatus} onRefresh={refreshPlatform} />
            <DeviceCard device={selectedDevice} />
          </div>
        );
      case 'flash':
        return <FlashPanel firmwarePath={firmwarePath} onPathChange={setFirmwarePath} onValidate={handleValidate} onFlash={handleFlash} log={consoleLog} />;
      case 'root':
        return <RootPanel tools={rootTools} onPrepare={handlePrepareRoot} />;
      case 'diagnostics':
        return <DiagnosticsPanel diagnostics={diagnostics} />;
      case 'tools':
        return <ToolPanel onScrcpyStart={handleScrcpyStart} onScrcpyStop={handleScrcpyStop} log={consoleLog} />;
      default:
        return null;
    }
  };

  return (
    <div class="app-shell">
      <Sidebar active={activeTab} onSelect={setActiveTab} />
      <main class="content">{renderContent()}</main>
    </div>
  );
}

render(<App />, document.getElementById('app'));
