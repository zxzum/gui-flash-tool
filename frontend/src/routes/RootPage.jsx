import { h } from 'preact';

export default function RootPage({ tools }) {
  return (
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Root и модули</h1>
          <p class="subtext">Magisk / KernelSU + LSPosed, LuckyTools</p>
        </div>
      </div>
      <div class="root-grid">
        {tools.map((tool) => (
          <div key={tool.name} class="root-card">
            <div class="card-title">{tool.name}</div>
            <div class="subtext">Канал: {tool.channel}</div>
            <div class="divider" />
            <div class="toolbar">
              <button class="button">Скачать / Записать</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
