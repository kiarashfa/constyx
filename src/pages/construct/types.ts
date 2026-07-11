/**
 * Structured lesson schema for Construct training programs.
 *
 * Lessons are authored as TypeScript data files under ./lessons — one file
 * per program, registered in ./lessons/index.ts. Adding a lesson never
 * requires new page logic: the rendering pipeline in LessonView/blocks
 * consumes this schema.
 */

export type LessonCategory = 'orientation' | 'combat' | 'mind';

export const CATEGORY_LABEL: Record<LessonCategory, string> = {
  orientation: 'ORIENTATION',
  combat: 'COMBAT DISCIPLINES',
  mind: 'MIND DISCIPLINES',
};

/** Inline text in blocks supports minimal emphasis: **bold** and *italic*. */
export type RichText = string;

export type LessonBlock =
  | { type: 'paragraph'; text: RichText }
  | { type: 'list'; style?: 'bullet' | 'numbered'; items: RichText[] }
  | { type: 'quote'; text: string; attribution?: string }
  | {
      /** HUD-style data readout: term/detail rows rendered as a table. */
      type: 'readout';
      entries: { term: string; detail: RichText }[];
    }
  | {
      /** Bordered aside for warnings, protocol notes, fourth-wall asides. */
      type: 'callout';
      label?: string;
      text: RichText;
    };

export interface LessonImage {
  /** Imported asset URL (Vite handles hashing and base path). */
  src: string;
  alt: string;
  caption?: string;
}

export interface LessonSection {
  /** Anchor id, unique within the lesson. */
  id: string;
  heading: string;
  blocks: LessonBlock[];
  /** Rendered as a framed VISUAL REFERENCE panel after the blocks. */
  image?: LessonImage;
}

export interface Lesson {
  /** Slug — doubles as the route param (/construct/:id) and storage key. */
  id: string;
  /** Program slot number shown in the library, e.g. 'C-00'. */
  code: string;
  title: string;
  /** In-universe one-liner shown under the title. */
  tagline: string;
  category: LessonCategory;
  /** Library card copy — what you actually learn. */
  summary: string;
  /** Fake payload size for the download theater, e.g. '412 EXABYTES'. */
  sizeLabel: string;
  /** Honest reading-time estimate in minutes. */
  estMinutes: number;
  sections: LessonSection[];
  /** Optional further-reading acknowledgments. */
  sources?: string[];
}
