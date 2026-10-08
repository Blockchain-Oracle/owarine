'use client';

import { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

// Mermaid keeps global configuration. Serialise configuration and rendering so charts in
// different themes cannot borrow another chart's palette during a navigation or theme change.
let pending: Promise<unknown> = Promise.resolve();

export function Mermaid({ chart, title = 'Architecture diagram' }: { chart: string; title?: string }) {
  const { resolvedTheme } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [result, setResult] = useState<{ key: string; svg?: string; failed?: boolean }>();
  const key = `${resolvedTheme}:${chart}`;

  useEffect(() => {
    if (!resolvedTheme) return;
    let cancelled = false;
    const dark = resolvedTheme === 'dark';
    const render = async () => {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        look: 'classic',
        fontFamily: 'Inter, system-ui, sans-serif',
        flowchart: { htmlLabels: false, curve: 'basis', padding: 18 },
        themeVariables: {
          darkMode: dark,
          background: dark ? '#0A0A0A' : '#FFFFFF',
          primaryColor: dark ? '#202020' : '#FFFFFF',
          primaryTextColor: dark ? '#FFFFFF' : '#000000',
          primaryBorderColor: '#FA00FF',
          secondaryColor: dark ? '#263000' : '#EDFFCC',
          secondaryTextColor: dark ? '#FFFFFF' : '#000000',
          secondaryBorderColor: dark ? '#ADFF02' : '#669600',
          tertiaryColor: dark ? '#002938' : '#E5F8FF',
          tertiaryTextColor: dark ? '#FFFFFF' : '#000000',
          tertiaryBorderColor: '#02BBFF',
          lineColor: dark ? '#FA00FF' : '#B000B5',
          textColor: dark ? '#FFFFFF' : '#000000',
          edgeLabelBackground: dark ? '#0A0A0A' : '#FFFFFF',
          clusterBkg: dark ? '#141414' : '#F2F2F2',
          clusterBorder: dark ? '#484848' : '#DCDCDC',
          actorBkg: dark ? '#202020' : '#FFFFFF',
          actorBorder: '#FA00FF',
          actorTextColor: dark ? '#FFFFFF' : '#000000',
          actorLineColor: dark ? '#A0A0A0' : '#5E5E5E',
          signalColor: dark ? '#FFFFFF' : '#000000',
          signalTextColor: dark ? '#FFFFFF' : '#000000',
          labelBoxBkgColor: dark ? '#202020' : '#F2F2F2',
          labelTextColor: dark ? '#FFFFFF' : '#000000',
          loopTextColor: dark ? '#FFFFFF' : '#000000',
          noteBkgColor: dark ? '#002938' : '#E5F8FF',
          noteTextColor: dark ? '#FFFFFF' : '#000000',
          noteBorderColor: '#02BBFF',
        },
      });
      const { svg } = await mermaid.render(`owarine-${id}`, chart);
      if (!cancelled) setResult({ key, svg });
    };
    pending = pending.catch(() => undefined).then(render).catch(() => {
      if (!cancelled) setResult({ key, failed: true });
    });
    return () => { cancelled = true; };
  }, [chart, id, key, resolvedTheme]);

  const current = result?.key === key ? result : undefined;
  return <figure className="mermaid-diagram not-prose" aria-label={title}>
    <figcaption>{title}</figcaption>
    {current?.svg ? <div className={`mermaid-scroll${chart.trimStart().startsWith('sequenceDiagram') ? ' mermaid-sequence' : ''}`} tabIndex={0} role="img" aria-label={`${title}. Scroll horizontally to read the full diagram.`} dangerouslySetInnerHTML={{ __html: current.svg }} />
      : <p role="status">{current?.failed ? 'The diagram could not render. Its source is available below.' : 'Loading diagram…'}</p>}
    <details><summary>Read diagram source</summary><pre><code>{chart}</code></pre></details>
  </figure>;
}
