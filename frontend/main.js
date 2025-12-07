import { h, render } from 'https://unpkg.com/preact@10.20.1?module';
import { useEffect, useMemo, useState } from 'https://unpkg.com/preact@10.20.1/hooks/dist/hooks.module.js?module';
import htm from 'https://unpkg.com/htm@3.1.1?module';

const html = htm.bind(h);

const api = window?.pywebview?.api ?? {
  list_devices: async () => [],
  select_device: async (serial) => ({ selected: serial }),
  platform_tools_status: async () => ({ installed: false, location: null, install_hint: 'Install android-platform-tools via Homebrew.' }),
  set_firmware_path: async (path) => ({ path, exists: false }),
  validate_firmware: async () => ({ is_valid: false, message: 'offline mock' }),
  flash: async () => ({ status: 'queued', message: 'demo run' }),
  diagnostics: async () => ({
    storage: '—',
    battery: '—',
    thermals: '—',
    safety: { verified_boot: false, vaultkeeper: 'unknown', bootloader: 'unknown' },
  }),
  list_root_tools: async () => [],
};

function Badge({ tone = 'ok', text }) {
  return html`<span class="badge ${tone}"><span class="status-dot ${tone}"></span>${text}</span>`;
}

function SectionTitle({ children, action }) {
  return html`<div class="section-title">${children}${action}</div>`;
}

function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    asyncFn()
      .then((data) => active && setState({ loading: false, data, error: null }))
      .catch((error) => active && setState({ loading: false, data: null, error }));
    return () => {
      active = false;
    };
  }, deps);

  return state;
}

function DevicePanel() {
  const devices = useAsync(() => api.list_devices(), []);
  const [selected, setSelected] = useState(null);

  const cards = useMemo(() => {
    if (devices.loading) {
      return html`<p class="small">Looking for devices via adb…</p>`;
    }
    if (devices.error) {
      return html`<p class="small">Failed to query devices: ${devices.error}</p>`;
    }
    if (!devices.data?.length) {
      return html`<p class="small">No devices detected. Connect via USB or ensure adb over Wi‑Fi is enabled.</p>`;
    }

    return devices.data.map((device) => html`
      <div class="card" key=${device.serial}>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>
            <h3>${device.model}</h3>
            <p class="small">${device.serial} · ${device.transport}</p>
          </div>
          ${html`<${Badge} tone=${device.state === 'device' ? 'ok' : 'warn'} text=${device.state} />`}
        </div>
        <p>Build: <strong>${device.build}</strong></p>
        <p>Bootloader: ${device.bootloader}</p>
        <p>Root: ${device.is_rooted ? 'Detected' : 'Not detected'}</p>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <button class="button" onClick=${async () => {
            setSelected(device.serial);
            await api.select_device(device.serial);
          }}>
            ${selected === device.serial ? 'Selected' : 'Use this device'}
          </button>
          <button class="button secondary" onClick=${() => api.start_scrcpy?.()}>Open scrcpy</button>
        </div>
      </div>
    `);
  }, [devices.loading, devices.data, devices.error, selected]);

  return html`
    <${SectionTitle}>Connected devices</${SectionTitle}>
    <div class="grid">${cards}</div>
  `;
}

function PlatformTools() {
  const status = useAsync(() => api.platform_tools_status(), []);

  const badgeTone = status.data?.installed ? 'ok' : 'warn';

  return html`
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <h3>Android Platform Tools</h3>
          <p class="small">Auto-checks Homebrew + zshrc presence on Apple Silicon.</p>
          <p class="small">${status.data?.location ? `Found at ${status.data.location}` : 'Not detected on PATH.'}</p>
        </div>
        <${Badge} tone=${badgeTone} text=${status.data?.installed ? 'Available' : 'Missing'} />
      </div>
      <div class="taglist">
        <span class="badge">fastboot</span>
        <span class="badge">adb</span>
        <span class="badge">scrcpy</span>
      </div>
      ${!status.data?.installed && html`<div style="margin-top:12px;" class="small">${status.data?.install_hint}</div>`}
    </div>
  `;
}

function FirmwareFlow() {
  const [path, setPath] = useState('');
  const [validation, setValidation] = useState(null);
  const [log, setLog] = useState('Ready. Choose your firmware archive to validate and flash.');

  const validate = async () => {
    if (!path) return;
    await api.set_firmware_path(path);
    const res = await api.validate_firmware();
    setValidation(res);
    setLog((prev) => `${prev}\nValidation: ${res.message}`);
  };

  const flash = async () => {
    const res = await api.flash();
    setLog((prev) => `${prev}\nFlash: ${res.message}`);
  };

  return html`
    <${SectionTitle} action=${html`<span class="small">Supports super.img or partitioned payloads</span>`}>Firmware workflow</${SectionTitle}>
    <div class="grid">
      <div class="card">
        <h3>Firmware source</h3>
        <p class="small">Point to extracted payloads or full super.img archives.</p>
        <input style="width:100%; padding:12px; border-radius:12px; border:1px solid var(--border); background: rgba(255,255,255,0.02); color: var(--text);" value=${path} onInput=${(e) => setPath(e.target.value)} placeholder="/path/to/OnePlus_Pad2_15.0.0.601" />
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button class="button" onClick=${validate}>Validate</button>
          <button class="button secondary" onClick=${flash}>Start Flash</button>
        </div>
        ${validation && html`<p class="small" style="margin-top:10px;">Validation: ${validation.message}</p>`}
      </div>
      <div class="card">
        <h3>Progress & Console</h3>
        <p class="small">Live fastboot/adb output with resilient fallbacks.</p>
        <div class="log-area">${log}</div>
      </div>
    </div>
  `;
}

function RootToolkit() {
  const tools = useAsync(() => api.list_root_tools(), []);

  const list = (tools.data ?? [
    { name: 'Magisk', channel: 'stable', status: 'available' },
    { name: 'KernelSU', channel: 'stable', status: 'available' },
  ]).map((tool) => html`
    <div class="card" key=${tool.name}>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3>${tool.name}</h3>
          <p class="small">Channel: ${tool.channel}</p>
        </div>
        <${Badge} tone="ok" text=${tool.status} />
      </div>
      <p class="small">Full automation path: download → patch boot/init_boot → sideload → verify signal.</p>
      <button class="button" onClick=${() => api.prepare_root(tool.name)}>Prepare install</button>
    </div>
  `);

  return html`
    <${SectionTitle}>Root & modules</${SectionTitle}>
    <div class="grid">${list}</div>
  `;
}

function Diagnostics() {
  const diag = useAsync(() => api.diagnostics(), []);

  return html`
    <${SectionTitle}>Live diagnostics</${SectionTitle}>
    <div class="kpi">
      <div class="card"><div class="small">Storage</div><h3>${diag.data?.storage ?? '—'}</h3></div>
      <div class="card"><div class="small">Battery</div><h3>${diag.data?.battery ?? '—'}</h3></div>
      <div class="card"><div class="small">Thermals</div><h3>${diag.data?.thermals ?? '—'}</h3></div>
      <div class="card"><div class="small">Safety</div><p class="small">Verified boot: ${diag.data?.safety?.verified_boot ? 'on' : 'off'}</p></div>
    </div>
  `;
}

function Timeline() {
  const steps = [
    { title: 'Pre-flight', body: 'Detect device, query boot slots, fetch platform-tools status.' },
    { title: 'Validation', body: 'Verify firmware structure (super.img or partition set) + integrity hashes.' },
    { title: 'Flash', body: 'Fastbootd orchestration with scrcpy mirror and recovery hand-offs.' },
    { title: 'Post-flight', body: 'Root extras, data wipe guidance, and reboot sequencing.' },
  ];

  return html`
    <div class="timeline">
      ${steps.map((step) => html`<div class="step"><h4>${step.title}</h4><p class="small">${step.body}</p></div>`)}
    </div>
  `;
}

function App() {
  return html`
    <div class="hero">
      <div>
        <h1>OnePlus Pad 2 • Universal Flasher</h1>
        <p>Mac-first GUI built with Preact + pywebview. Designed for OxygenOS rollbacks and custom payloads with graceful fallbacks.</p>
        <div class="taglist" style="margin-top:10px;">
          <span class="badge">adb live status</span>
          <span class="badge">fastbootd automation</span>
          <span class="badge">scrcpy integration</span>
          <span class="badge">root toolkit</span>
        </div>
      </div>
      <div class="cta">
        <a class="button" href="#">Start session</a>
        <a class="button secondary" href="#">Design preview only</a>
      </div>
    </div>

    <${PlatformTools} />
    <${DevicePanel} />
    <${FirmwareFlow} />
    <${RootToolkit} />
    <${Diagnostics} />

    <${SectionTitle}>Flashing playbook</${SectionTitle}>
    <${Timeline} />

    <footer>Built for Apple Silicon macOS · Vue/Preact-ready front-end rendered via pywebview.</footer>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
