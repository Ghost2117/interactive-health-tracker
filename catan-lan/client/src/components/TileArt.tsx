import type { Resource } from '../../../shared/types.js';

const HEX_SIZE = 100;

/** The 6 hex corners in local space (centered on 0,0), matching shared/board.ts's geometry. */
export function hexPoints(size = HEX_SIZE): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${(size * Math.cos(angle)).toFixed(2)},${(size * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

/** Deterministic 0/60/.../300deg rotation per tile so same-resource tiles aren't identical twins. */
function hashRotation(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 6) * 60;
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  // Canopy colors deliberately contrast against the forest tile's dark
  // green base fill, since a same-toned canopy nearly vanishes on it.
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={-3} y={10} width={6} height={12} rx={1} fill="#3f2e18" />
      <polygon points="0,-30 14,2 -14,2" fill="#3f8f4f" stroke="#245c30" strokeWidth={1} />
      <polygon points="0,-17 11,10 -11,10" fill="#4faa5f" stroke="#245c30" strokeWidth={1} />
    </g>
  );
}

function HillMound({ cx, cy, rx, ry, fill }: { cx: number; cy: number; rx: number; ry: number; fill: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} />;
}

function Peak({ x, base = 45, height = 65, fill, cap }: { x: number; base?: number; height?: number; fill: string; cap: string }) {
  const top = -height / 2;
  const bottom = height / 2;
  return (
    <g>
      <polygon points={`${x - base / 2},${bottom} ${x},${top} ${x + base / 2},${bottom}`} fill={fill} />
      <polygon
        points={`${x - base * 0.18},${top + height * 0.32} ${x},${top} ${x + base * 0.18},${top + height * 0.32}`}
        fill={cap}
      />
    </g>
  );
}

function Wheat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={11} x2={0} y2={-13} stroke="#9c7a1e" strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={-2.5} cy={-13} rx={3} ry={7} fill="#d9a92c" transform="rotate(-20 -2.5 -13)" />
      <ellipse cx={2.5} cy={-13} rx={3} ry={7} fill="#d9a92c" transform="rotate(20 2.5 -13)" />
      <ellipse cx={0} cy={-17} rx={3} ry={7} fill="#e0b53a" />
    </g>
  );
}

function Sheep({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx={0} cy={0} rx={17} ry={11} fill="#f5f1e6" stroke="#cfc9b8" strokeWidth={1} />
      <circle cx={-17} cy={-3} r={7} fill="#ece6d6" stroke="#cfc9b8" strokeWidth={1} />
      <circle cx={-20} cy={-4} r={1.3} fill="#3a352a" />
      <line x1={-8} y1={9} x2={-8} y2={17} stroke="#3a352a" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={7} y1={9} x2={7} y2={17} stroke="#3a352a" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

function Cactus({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-4} y={-24} width={8} height={40} rx={4} fill="#5f8f52" />
      <rect x={-17} y={-6} width={8} height={20} rx={4} fill="#5f8f52" />
      <rect x={9} y={-14} width={8} height={26} rx={4} fill="#5f8f52" />
    </g>
  );
}

export function TileArt({ resource, tileId }: { resource: Resource | 'desert'; tileId: string }) {
  const rotation = hashRotation(tileId);
  switch (resource) {
    case 'lumber':
      return (
        <g transform={`rotate(${rotation})`}>
          <Tree x={-38} y={-12} scale={1.1} />
          <Tree x={18} y={-38} scale={0.85} />
          <Tree x={40} y={18} scale={1} />
          <Tree x={-14} y={40} scale={0.9} />
          <Tree x={5} y={2} scale={0.65} />
        </g>
      );
    case 'brick':
      return (
        <g transform={`rotate(${rotation})`}>
          <HillMound cx={-15} cy={38} rx={62} ry={30} fill="#a8502f" />
          <HillMound cx={40} cy={12} rx={48} ry={26} fill="#b35a36" />
          <HillMound cx={-30} cy={-30} rx={42} ry={24} fill="#9a4a2a" />
        </g>
      );
    case 'ore':
      return (
        <g transform={`rotate(${rotation})`}>
          <Peak x={-38} base={48} height={62} fill="#63676e" cap="#e8eaee" />
          <Peak x={10} base={68} height={94} fill="#797d85" cap="#eef0f3" />
          <Peak x={48} base={44} height={56} fill="#6b6f76" cap="#e8eaee" />
        </g>
      );
    case 'grain':
      return (
        <g transform={`rotate(${rotation})`}>
          {[-42, 0, 42].flatMap((x) => [-30, 5, 40].map((y) => <Wheat key={`${x}-${y}`} x={x} y={y} />))}
        </g>
      );
    case 'wool':
      return (
        <g transform={`rotate(${rotation})`}>
          <Sheep x={-30} y={-15} scale={1.05} />
          <Sheep x={25} y={-25} scale={0.85} />
          <Sheep x={30} y={20} scale={1} />
          <Sheep x={-25} y={30} scale={0.8} />
        </g>
      );
    case 'desert':
      return (
        <g transform={`rotate(${rotation})`}>
          <path d="M -65 35 Q -25 10 15 30 T 65 20" stroke="#c9b073" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M -60 5 Q -15 -18 45 2" stroke="#d6bd82" strokeWidth={6} fill="none" strokeLinecap="round" />
          <Cactus x={32} y={-25} />
        </g>
      );
    default:
      return null;
  }
}
