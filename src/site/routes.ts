import { SITE } from './config';
import { SCENES } from '../pages/locations/scenes';
import { FOCUS_SCENES } from '../pages/focus/scenes';
import { LESSONS } from '../pages/construct/lessons';

/**
 * Every program slot on the console — the one list the nav, the landing
 * menu, page titles, and the build's per-route HTML/sitemap all read from.
 */
export interface Section {
  path: string;
  code: string;
  /** Nav label. */
  label: string;
  /** Landing menu line: `> run <label> — <tagline>`. */
  tagline: string;
  /** Page title (before the site suffix) and meta description. */
  title: string;
  description: string;
}

export const SECTIONS: Section[] = [
  {
    path: '/operator',
    code: '01',
    label: 'OPERATOR',
    tagline: 'watch the code',
    title: 'Operator',
    description:
      'Work a two-minute shift watching the digital rain. Spot the anomalies (Agents, glitches, redpills dialing out) and make the right call before the trace finds you.',
  },
  {
    path: '/construct',
    code: '02',
    label: 'CONSTRUCT',
    tagline: 'skill downloads',
    title: 'The Construct',
    description:
      'A white-void training library. Download real, sourced programs on kung fu, jiu-jitsu, deep work, and habit building.',
  },
  {
    path: '/locations',
    code: '03',
    label: 'LOCATIONS',
    tagline: 'simulation decks',
    title: 'Locations',
    description:
      'Explorable first-person 3D scenes: the white room, the jump program, the dojo, the armory, bullet time, and the woman in the red dress.',
  },
  {
    path: '/focus',
    code: '04',
    label: 'FOCUS',
    tagline: 'deep-work sessions',
    title: 'Focus Mode',
    description:
      'Ambient raymarched scenes to leave open while you work: Mobil Ave, the pod fields, the Oracle’s park, Seraph’s tea house, and more. No timers, no objectives.',
  },
  {
    path: '/screensaver',
    code: '05',
    label: 'SCREENSAVER',
    tagline: 'export the rain',
    title: 'Screensaver',
    description:
      'Tune your own digital rain (glyphs, palette, speed, density) and export it as a single standalone HTML screensaver.',
  },
  {
    path: '/ascii',
    code: '06',
    label: 'ASCII',
    tagline: 'transmission composer',
    title: 'ASCII Composer',
    description:
      'Type text and render it as terminal ASCII art in five styles, including letterforms built from falling code. Copy it or save it.',
  },
  {
    path: '/code-vision',
    code: '07',
    label: 'CODE VISION',
    tagline: 'see the feed as code',
    title: 'Code Vision',
    description:
      'See your webcam as falling green code, the way Neo learned to read the world. Processed locally: the camera feed never leaves your device.',
  },
];

export interface RouteMeta {
  /** Router path, no base (e.g. `/focus/pod-bay`). */
  path: string;
  /** Full document title. */
  title: string;
  description: string;
}

/** `ConStyx · Focus Mode – Pod Bay`: site, then section, then page (en dash). */
const pageTitle = (section: string, page?: string) =>
  `${SITE.name} · ${section}${page ? ` – ${page}` : ''}`;

const sentence = (blurb: string) => blurb.replace(/\s+/g, ' ').trim();

/** Every real page the site serves, in sitemap order. */
export function allRoutes(): RouteMeta[] {
  const routes: RouteMeta[] = [
    { path: '/', title: SITE.title, description: SITE.description },
  ];
  for (const section of SECTIONS) {
    routes.push({ path: section.path, title: pageTitle(section.title), description: section.description });
    if (section.path === '/construct') {
      for (const lesson of LESSONS) {
        routes.push({
          path: `/construct/${lesson.id}`,
          title: pageTitle('Construct', titleCase(lesson.title)),
          description: sentence(lesson.summary),
        });
      }
    }
    if (section.path === '/locations') {
      for (const scene of SCENES.filter((s) => s.status === 'online')) {
        routes.push({
          path: `/locations/${scene.id}`,
          title: pageTitle('Locations', titleCase(scene.title)),
          description: sentence(scene.blurb),
        });
      }
    }
    if (section.path === '/focus') {
      for (const scene of FOCUS_SCENES.filter((s) => s.status === 'online')) {
        routes.push({
          path: `/focus/${scene.id}`,
          title: pageTitle('Focus Mode', titleCase(scene.title)),
          description: sentence(scene.blurb),
        });
      }
    }
  }
  routes.push({
    path: '/about',
    title: pageTitle('About'),
    description:
      'What ConStyx is, who builds it, how your data is handled, and how to support the project.',
  });
  return routes;
}

let byPath: Map<string, RouteMeta> | undefined;

/** Metadata for a router pathname; unknown paths fall back to the site title. */
export function getRouteMeta(pathname: string): RouteMeta {
  byPath ??= new Map(allRoutes().map((route) => [route.path, route]));
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return byPath.get(key) ?? { path: key, title: pageTitle('Not Found'), description: SITE.description };
}

/** Registry titles are all caps: `MOBIL AVE` → `Mobil Ave`. */
function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}
