import generated from './walkthroughs.generated.json';

export type WalkthroughChapter = { time: number; title: string; text: string };
export type WalkthroughMovie = {
  title: string;
  description: string;
  poster: string;
  duration: number;
  capturedAt: string;
  origin: string;
  chapters: WalkthroughChapter[];
  sources: { src: string; type: string }[];
  captions: string;
  metadata: string;
};

// The renderer publishes an entry only after the video, captions, poster and
// provenance have been written and the encoded video has passed ffprobe.
export const walkthroughs = generated as Record<string, WalkthroughMovie>;

export function walkthroughTimestamp(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
