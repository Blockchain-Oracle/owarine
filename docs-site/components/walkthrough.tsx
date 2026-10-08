'use client';

import { useId, useRef, useState } from 'react';
import { Download, Play } from 'lucide-react';
import { walkthroughs, walkthroughTimestamp } from '@/lib/walkthroughs';
import { Brand } from './brand';

export function Walkthrough({ name }: { name: string }) {
  const movie = walkthroughs[name];
  const player = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);
  const descriptionId = useId();
  // Unfinished or failed live flows must never expose a broken or invented clip.
  if (!movie) return null;

  function jump(time: number) {
    const video = player.current;
    if (!video) return;
    video.currentTime = time;
    setActive(movie.chapters.reduce((current, chapter, index) => chapter.time <= time ? index : current, 0));
    // Seeking keeps the current playback state. In particular, a chapter click
    // does not start motion for someone who has paused or prefers less motion.
  }

  return (
    <figure className="walkthrough not-prose">
      <div className="guide-top"><span><Play size={14} aria-hidden="true" />{movie.title}</span><Brand small /></div>
      <video ref={player} controls playsInline preload="metadata" poster={movie.poster}
        aria-label={movie.title} aria-describedby={descriptionId}
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime;
          setActive(movie.chapters.reduce((current, chapter, index) => chapter.time <= time ? index : current, 0));
        }}>
        {movie.sources.map((source) => <source key={source.src} src={source.src} type={source.type} />)}
        <track kind="captions" src={movie.captions} srcLang="en" label="English" default />
        Your browser cannot play this video. <a href={movie.sources[0].src}>Download the walkthrough.</a>
      </video>
      <figcaption id={descriptionId}>
        <p>{movie.description}</p>
        <p>{walkthroughTimestamp(movie.duration)} · Captured {new Date(movie.capturedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} · Silent video with captions.</p>
      </figcaption>
      <div className="video-chapters" role="group" aria-label={`${movie.title}: chapters`}>
        {movie.chapters.map((chapter, index) => (
          <button key={chapter.time} type="button" aria-current={active === index ? 'step' : undefined}
            style={active === index ? { borderColor: 'var(--brand)', background: 'var(--color-fd-accent)' } : undefined}
            onClick={() => jump(chapter.time)} aria-label={`Seek to ${walkthroughTimestamp(chapter.time)}: ${chapter.title}`}>
            <span>{walkthroughTimestamp(chapter.time)}</span>{chapter.title}
          </button>
        ))}
      </div>
      <details className="video-transcript">
        <summary>Read the transcript</summary>
        {movie.chapters.map((chapter) => <p key={chapter.time}><strong>{walkthroughTimestamp(chapter.time)} · {chapter.title}.</strong> {chapter.text}</p>)}
      </details>
      <a className="raw-capture-link" href={movie.sources[0].src} download><Download size={14} aria-hidden="true" /> Download video</a>
      <a className="raw-capture-link" href={movie.captions} download>Download captions</a>
      <a className="raw-capture-link" href={movie.metadata}>Recording provenance</a>
    </figure>
  );
}
