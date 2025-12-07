import { h } from 'preact';

function TreeNode({ node, depth = 0 }) {
  if (!node) return null;
  const padding = `${depth * 12}px`;
  return (
    <div class="tree-node" style={{ paddingLeft: padding }}>
      <span class={`tree-icon ${node.type}`}>{node.type === 'dir' ? '📁' : '📄'}</span>
      <span class="tree-label">{node.name}</span>
      {node.children && node.children.length > 0 && (
        <div class="tree-children">
          {node.children.map((child) => (
            <TreeNode key={`${node.name}-${child.name}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FirmwareTree({ tree }) {
  if (!tree) return <div class="muted">Папка не выбрана</div>;
  return (
    <div class="tree-view">
      <TreeNode node={tree} />
    </div>
  );
}
