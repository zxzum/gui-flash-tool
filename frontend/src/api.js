const mockDevice = {
  serial: 'FAKE123456',
  state: 'device',
  model: 'OnePlus Pad 2',
  build: 'OxygenOS 16.0.0.201',
  bootloader: 'locked',
  is_rooted: false,
  android_version: '15',
  battery: { level: 72, status: 'Discharging', power_save: false, charging: false },
  wallpaper_hint: 'oxygen-gradient',
  charging_icon: 'bolt',
};

const mockPlatform = {
  installed: false,
  location: null,
  install_hint: 'brew install android-platform-tools && add /opt/homebrew/bin to PATH via ~/.zshrc',
  adb_version: null,
  fastboot_version: null,
};

export async function callApi(method, ...args) {
  if (window.pywebview?.api?.[method]) {
    return window.pywebview.api[method](...args);
  }

  switch (method) {
    case 'list_devices':
      return [mockDevice];
    case 'platform_tools_status':
      return mockPlatform;
    case 'diagnostics':
      return {
        storage: '128GB / 512GB free',
        battery: '72%',
        thermals: 'Nominal',
        safety: { verified_boot: false, vaultkeeper: 'unknown', bootloader: 'locked' },
      };
    case 'list_root_tools':
      return [
        { name: 'Magisk', channel: 'stable', status: 'available' },
        { name: 'Magisk Delta', channel: 'beta', status: 'available' },
        { name: 'KernelSU', channel: 'stable', status: 'available' },
        { name: 'LSPosed', channel: 'stable', status: 'available' },
        { name: 'LuckyTools', channel: 'community', status: 'available' },
      ];
    case 'validate_firmware':
      return { path: '/path/to/archive', is_valid: false, message: 'Mocked validation' };
    case 'inspect_firmware_tree':
      return { tree: { name: 'firmware', type: 'dir', children: [{ name: 'boot.img', type: 'file' }] } };
    case 'refresh_wallpaper':
      return { wallpaper: 'https://image01.oneplus.net/media/202407/09/fba6399523cbd6126ddcedb6920c9046.png?x-amz-process=image/format,webp/quality,Q_80' };
    case 'rotate_mock_image':
      return { wallpaper: 'https://image01.oneplus.net/media/202408/17/08f67608a0b45d031b6a9bb4f3bb9224.png?x-amz-process=image/format,webp/quality,Q_80' };
    case 'flash':
      return { status: 'queued', message: 'Mock flash scheduled' };
    case 'start_scrcpy':
      return { status: 'pending', message: 'Scrcpy stub' };
    case 'stop_scrcpy':
      return { status: 'pending', message: 'Scrcpy stop stub' };
    default:
      return {};
  }
}
