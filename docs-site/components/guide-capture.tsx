'use client';

import { useId, useRef } from 'react';
import { ArrowUpRight, Maximize2, X } from 'lucide-react';
import { Brand } from './brand';
import { captures, type CaptureName } from '@/lib/captures';

export function GuideCapture({ name, caption }: { name: CaptureName; caption?: string }) {
  const capture = captures[name];
  const annotations = capture.annotations ?? [];
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const arrowId = `guide-arrow-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const src = `/captures/${capture.file}`;
  const image = (expanded = false) => <div className="guide-capture" style={capture.width < 600 ? { maxWidth: 390, marginInline: 'auto' } : undefined}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={capture.alt} loading="lazy" width={capture.width * 2} height={capture.height * 2} />
    {annotations.length > 0 && <svg className="guide-annotations" viewBox={`0 0 ${capture.width} ${capture.height}`} aria-hidden="true">
      <defs><marker id={`${arrowId}-${expanded ? 'dialog' : 'inline'}`} viewBox="0 0 20 20" refX="20" refY="10" markerWidth="24" markerHeight="24" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0 20 10 0 20Z" fill="#FA00FF" stroke="#FFFFFF" strokeWidth="2" /></marker></defs>
      {annotations.map((item, index) => {
        const { x, y, width, height } = item.box;
        const tail = item.tail;
        // End on the closest real control edge, never on its label or a guessed coordinate.
        const cx = x + width / 2, cy = y + height / 2;
        const dx = tail.x - cx, dy = tail.y - cy;
        const scale = Math.min(width / (2 * Math.abs(dx || .001)), height / (2 * Math.abs(dy || .001)));
        const toX = cx + dx * scale, toY = cy + dy * scale;
        const path = `M${tail.x} ${tail.y} Q${tail.x} ${toY} ${toX} ${toY}`;
        return <g key={`${index}-${item.label}`}>
          <rect x={x} y={y} width={width} height={height} rx="8" fill="none" stroke="#FFFFFF" strokeWidth="8" />
          <rect x={x} y={y} width={width} height={height} rx="8" fill="none" stroke="#FA00FF" strokeWidth="4" />
          <path d={path} fill="none" stroke="#FFFFFF" strokeWidth="18" />
          <path d={path} fill="none" stroke="#FA00FF" strokeWidth="10" markerEnd={`url(#${arrowId}-${expanded ? 'dialog' : 'inline'})`} />
          <circle cx={tail.x} cy={tail.y} r="22" fill="#FA00FF" stroke="#FFFFFF" strokeWidth="4" />
          <text x={tail.x} y={tail.y + 8} textAnchor="middle" fill="#000000" fontSize="24" fontFamily="sans-serif" fontWeight="700">{index + 1}</text>
        </g>;
      })}
    </svg>}
  </div>;
  const notes = <div className="guide-capture-meta">
    <p className="guide-capture-state"><strong>Capture state:</strong> {capture.state}</p>
    <p className="guide-capture-date">Captured {capture.date} on the hosted Canton DevNet product.</p>
  </div>;

  return <figure className="guide-shot not-prose">
    <div className="guide-top"><span>{capture.title}</span><Brand small /></div>
    <button type="button" className="guide-expand" onClick={() => dialog.current?.showModal()} aria-label={`Expand screenshot: ${capture.title}`} aria-haspopup="dialog">
      {image()}<span className="guide-zoom-hint"><Maximize2 size={15} aria-hidden="true" /> Click to expand</span>
    </button>
    <figcaption>{caption && <p>{caption}</p>}{notes}{annotations.length > 0 && <ol className="annotation-legend">{annotations.map((item, index) => <li key={item.label}><span>{index + 1}</span>{item.label}</li>)}</ol>}</figcaption>
    <dialog className="capture-dialog" ref={dialog} aria-labelledby={id} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="dialog-inner">
        <div className="dialog-heading"><h2 id={id}>{capture.title}</h2><Brand small /><button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="Close screenshot"><X size={22} aria-hidden="true" /></button></div>
        {image(true)}<div className="dialog-capture-notes">{notes}</div>
        {annotations.length > 0 && <ol className="annotation-legend" style={{ padding: '10px 20px' }}>{annotations.map((item, index) => <li key={item.label}><span>{index + 1}</span>{item.label}</li>)}</ol>}
        <a className="raw-capture-link" href={src} target="_blank" rel="noreferrer">Open original capture <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
    </dialog>
  </figure>;
}
