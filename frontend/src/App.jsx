import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import Router, { route } from 'preact-router';
import { Toaster, toast } from 'react-hot-toast';
import { callApi } from './api/index.js';
import Layout from './components/Layout.jsx';
import DeviceSelection from './routes/DeviceSelection.jsx';
import FlashPage from './routes/FlashPage.jsx';
import DiagnosticsPage from './routes/DiagnosticsPage.jsx';
import RootPage from './routes/RootPage.jsx';
import ToolsPage from './routes/ToolsPage.jsx';

const NAV_ACTIONS = [
  { id: 'flash', icon: '🚀', title: 'Прошивка OnePlus', subtitle: 'OxygenOS архива или папки с образами', href: '/flash' },
  { id: 'scrcpy', icon: '🖥️', title: 'Посмотреть экран (scrcpy)', subtitle: 'Зеркалирование и управление', href: '/tools' },
  { id: 'adb', icon: '🛠️', title: 'Работа с ADB', subtitle: 'shell, logcat, быстрая перезагрузка', href: '/tools?tab=adb' },
  { id: 'adb-tweaks', icon: '✨', title: 'Твики ADB', subtitle: 'gms doze, анимации, сетевые опции', href: '/tools?tab=tweaks' },
  { id: 'root', icon: '🧰', title: 'Получение ROOT', subtitle: 'Magisk / KernelSU + модули', href: '/root' },
  { id: 'diagnostics', icon: '🔍', title: 'Диагностика', subtitle: 'SoC, ядро, батарея, память', href: '/diagnostics' },
  { id: 'platform', icon: '📦', title: 'Platform-Tools', subtitle: 'Проверка adb / fastboot / PATH', href: '/tools?tab=platform' },
];

export default function App() {
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [platformStatus, setPlatformStatus] = useState({ installed: false });
  const [rootTools, setRootTools] = useState([]);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [firmwarePath, setFirmwarePath] = useState('');
  const [tree, setTree] = useState(null);
  const [validation, setValidation] = useState(null);
  const [flashLog, setFlashLog] = useState(['Ожидание выбора прошивки']);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.serial === selected) || (devices.length === 1 ? devices[0] : null),
    [devices, selected]
  );

  useEffect(() => {
    refreshDevices();
    refreshPlatform();
    callApi('list_root_tools').then(setRootTools);
  }, []);

  const refreshDevices = async () => {
    const result = await callApi('list_devices');
    setDevices(result || []);
    if ((result || []).length === 1) {
      setSelected(result[0].serial);
    }
  };

  const refreshPlatform = async () => {
    const status = await callApi('platform_tools_status');
    setPlatformStatus(status);
  };

  const handleSelectDevice = async (device) => {
    await callApi('select_device', device.serial);
    setSelected(device.serial);
    route('/flash');
  };

  const handlePathChange = async (value) => {
    setFirmwarePath(value);
    setValidation(null);
    if (value) {
      await callApi('set_firmware_path', value);
      const inspected = await callApi('inspect_firmware_tree');
      setTree(inspected.tree || null);
    } else {
      setTree(null);
    }
  };

  const handleValidate = async () => {
    const result = await callApi('validate_firmware');
    setValidation(result);
    if (result?.is_valid) {
      toast.success('Готово к прошивке');
    } else {
      toast.error(result?.message || 'Ошибка проверки');
    }
    return result;
  };

  const handleFlash = async () => {
    const check = await handleValidate();
    if (!check?.is_valid) return;
    setFlashLog((prev) => [...prev, 'Старт прошивки...']);
    const result = await callApi('flash');
    setFlashLog((prev) => [...prev, JSON.stringify(result)]);
    toast.success('Флеш-задание добавлено');
  };

  const handleWallpaperCapture = async () => {
    if (!selectedDevice) return;
    const result = await callApi('refresh_wallpaper', selectedDevice.serial, selectedDevice.model);
    if (result?.wallpaper) {
      toast.success('Заставка обновлена');
      await refreshDevices();
    }
  };

  const handleWallpaperRotate = async () => {
    if (!selectedDevice) return;
    const result = await callApi('rotate_mock_image', selectedDevice.serial, selectedDevice.model);
    if (result?.wallpaper) {
      toast.success('Мокап сменён');
      await refreshDevices();
    }
  };

  const handlePaletteNavigate = (href) => {
    route(href);
  };

  return (
    <Layout
      actions={NAV_ACTIONS}
      onNavigate={handlePaletteNavigate}
      collapsed={paletteCollapsed}
      onToggleCollapse={() => setPaletteCollapsed((v) => !v)}
      selectedDevice={selectedDevice}
      devices={devices}
      onRefreshDevices={refreshDevices}
    >
      <Router>
        <DeviceSelection
          path="/"
          devices={devices}
          selected={selectedDevice}
          onSelect={handleSelectDevice}
          onRefreshWallpaper={handleWallpaperCapture}
          onRefreshDevices={refreshDevices}
        />
        <DeviceSelection
          path="/devices"
          devices={devices}
          selected={selectedDevice}
          onSelect={handleSelectDevice}
          onRefreshWallpaper={handleWallpaperCapture}
          onRefreshDevices={refreshDevices}
        />
        <FlashPage
          path="/flash"
          device={selectedDevice}
          firmwarePath={firmwarePath}
          onPathChange={handlePathChange}
          onValidate={handleValidate}
          onFlash={handleFlash}
          log={flashLog}
          tree={tree}
          validation={validation}
          consoleCollapsed={consoleCollapsed}
          onToggleConsole={() => setConsoleCollapsed((v) => !v)}
          onCaptureWallpaper={handleWallpaperCapture}
          onRotateWallpaper={handleWallpaperRotate}
          onChangeDevice={() => route('/devices')}
        />
        <RootPage path="/root" tools={rootTools} />
        <DiagnosticsPage path="/diagnostics" device={selectedDevice} onRefreshDevices={refreshDevices} />
        <ToolsPage path="/tools" platformStatus={platformStatus} onRefreshPlatform={refreshPlatform} device={selectedDevice} />
      </Router>
      <Toaster position="bottom-right" />
    </Layout>
  );
}
