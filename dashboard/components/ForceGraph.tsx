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

// Colors matching the design token type palette
const TYPE_COLORS: Record<string, string> = {
  person:                '#14b8a6',  // teal
  company:               '#f97316',  // orange
  meeting:               '#a855f7',  // purple
  meeting_note:          '#a855f7',
  decision:              '#eab308',  // yellow
  thought_decision:      '#eab308',
  idea:                  '#ec4899',  // pink
  thought_idea:          '#ec4899',
  thought_feature_request: '#ec4899',
  feature_request:       '#ec4899',
  concept:               '#8b5cf6',  // violet
  topic:                 '#8b5cf6',
  learning:              '#3bce76',  // green
  thought_learning:      '#3bce76',
  thought:               '#60a5fa',  // blue
  thought_follow_up:     '#60a5fa',
  project_update:        '#64748b',  // slate
  person_note:           '#9aa0a6',
};

function nodeColor(type: string) {
  return TYPE_COLORS[type] ?? '#4a4e54';
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
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0a0b0d' }}>
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeLabel="label"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeColor={(n: any) => nodeColor(n.type)}
        nodeRelSize={4}
        linkColor={() => '#23262c'}
        linkWidth={0.8}
        backgroundColor="#0a0b0d"
        nodeCanvasObjectMode={() => 'after'}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          if (globalScale < 1.5) return;
          const label = node.label ?? '';
          ctx.font = `${10 / globalScale}px monospace`;
          ctx.fillStyle = '#6b7177';
          ctx.textAlign = 'center';
          ctx.fillText(label.slice(0, 28), node.x ?? 0, (node.y ?? 0) + 8 / globalScale);
        }}
      />
    </div>
  );
}
