'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface Node {
  id: number;
  slug: string;
  type: string;
  title: string;
}

interface Link {
  source_page_id: number;
  target_page_id: number;
  link_type: string;
}

interface Props {
  nodes: Node[];
  links: Link[];
}

const TYPE_COLORS: Record<string, string> = {
  person: '#60a5fa',
  company: '#34d399',
  concept: '#a78bfa',
  decision: '#fbbf24',
  note: '#94a3b8',
  guide: '#22d3ee',
  analysis: '#f87171',
};

function nodeColor(type: string) {
  return TYPE_COLORS[type] ?? '#52525b';
}

export default function ForceGraph({ nodes, links }: Props) {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const graphData = {
    nodes: nodes.map(n => ({
      id: n.id,
      label: n.title || n.slug,
      type: n.type,
      slug: n.slug,
    })),
    links: links.map(l => ({
      source: l.source_page_id,
      target: l.target_page_id,
      type: l.link_type,
    })),
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950">
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="label"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeColor={(n: any) => nodeColor(n.type)}
        nodeRelSize={4}
        linkColor={() => '#3f3f46'}
        linkWidth={0.8}
        backgroundColor="#09090b"
        nodeCanvasObjectMode={() => 'after'}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          if (globalScale < 1.5) return;
          const label = node.label ?? '';
          ctx.font = `${10 / globalScale}px monospace`;
          ctx.fillStyle = '#a1a1aa';
          ctx.textAlign = 'center';
          ctx.fillText(label.slice(0, 24), node.x ?? 0, (node.y ?? 0) + 8 / globalScale);
        }}
      />
    </div>
  );
}
