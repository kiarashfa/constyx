import type { Lesson } from '../types';
import siteMap from '../assets/site-map.svg';

export const lessonZero: Lesson = {
  id: 'operator-protocols',
  code: 'C-00',
  title: 'OPERATOR PROTOCOLS',
  tagline: 'Before you free your mind, read the manual.',
  category: 'orientation',
  summary:
    'Mandatory onboarding for new operators: what this console is, how each program works, and where your data lives. The only program about the ship itself.',
  sizeLabel: '1.44 MEGABYTES',
  estMinutes: 4,
  sections: [
    {
      id: 'welcome',
      heading: 'WELCOME ABOARD',
      blocks: [
        {
          type: 'paragraph',
          text:
            'You are reading a training program inside **OPERATOR**, an unofficial, non-commercial fan tribute to *The Matrix* trilogy. The premise: your browser is the operator station of a hovercraft, and every section of this site is a program registered to that console. No accounts, no server, no tracking — the whole ship runs as static files delivered to your machine, and everything you do here stays in your browser.',
        },
        {
          type: 'callout',
          label: 'FOURTH WALL STATUS',
          text:
            'Temporarily lowered. This is the one program about the site itself. Every other program in the Construct teaches something real from the world outside the window.',
        },
      ],
    },
    {
      id: 'console',
      heading: 'READING THE CONSOLE',
      blocks: [
        {
          type: 'paragraph',
          text:
            'The bar at the top of every page is the ship\'s program registry. Slots **[00]** through **[06]** are permanent; your current location is highlighted in solid green. Slot [00] is the console itself — the boot screen you landed on. Two programs are live today, and four are still compiling.',
        },
        {
          type: 'readout',
          entries: [
            { term: '[00] CONSOLE', detail: 'Boot screen and program launcher.' },
            { term: '[01] OPERATOR', detail: 'Live. A playable monitoring shift — see next section.' },
            { term: '[02] CONSTRUCT', detail: 'Live. This training library.' },
            { term: '[03]–[06]', detail: 'Locations, Focus, Screensaver, ASCII — pending compilation in future builds.' },
          ],
        },
      ],
      image: {
        src: siteMap,
        alt: 'Diagram of the six programs registered to the operator console',
        caption: 'FIG 0.1 — signal topology of this console',
      },
    },
    {
      id: 'operator',
      heading: 'PROGRAM 01 :: RUNNING A SHIFT',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Operator is a two-minute monitoring shift. Anomalies surface *inside the falling code* — not in the side panels, which only tell you a sector. Find the column that looks wrong, click it, and answer with the matching verb. Four signatures exist:',
        },
        {
          type: 'readout',
          entries: [
            { term: 'COLD WHITE + FAST', detail: 'An Agent moving through the code. Verb: **JACK OUT**.' },
            { term: 'ONE GLYPH REPEATING', detail: 'Déjà vu — a code glitch. Sluggish, stuttering, acid-green. Verb: **PATCH**.' },
            { term: 'PULSING DIGITS', detail: 'A redpill dialing for an exit. Verb: **HARDLINE**.' },
            { term: 'DIM, FAINT, SLOW', detail: 'Residual echo. Harmless static. Verb: **DISMISS**.' },
          ],
        },
        {
          type: 'paragraph',
          text:
            'Wrong calls, missed threats, and probing clean columns all heat the **TRACE** meter; at 100% the shift ends early. Correct calls cool it. Number keys 1–4 answer faster than the mouse, and *Esc* backs out of a target. Your career record — shifts, best score, times traced — persists between visits.',
        },
      ],
    },
    {
      id: 'construct',
      heading: 'PROGRAM 02 :: THIS LIBRARY',
      blocks: [
        {
          type: 'paragraph',
          text:
            'The Construct is a library of skill uploads. Choose a program from the library shelf, let the loader run (or skip it — impatience is very human), and read. Each program is a genuine crash course written for this site: real history, real technique, real references. The white void you are standing in is intentional — loading programs live outside the Matrix\'s green rain.',
        },
        {
          type: 'list',
          style: 'bullet',
          items: [
            'A **LOADED** badge and download counter appear on every program you have completed.',
            'The section manifest on the left of each lesson jumps between modules.',
            'Programs are safe to re-download any number of times. Knowledge does not overwrite.',
          ],
        },
      ],
    },
    {
      id: 'data',
      heading: 'DATA INTEGRITY',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Everything the console remembers about you — Operator career stats, Construct download records — lives in your browser\'s **localStorage** under keys prefixed `operator.` and `construct.`. Nothing is transmitted anywhere. The corollary: clearing site data, switching browsers, or going incognito starts you from a blank record. There is no cloud. There is only your machine.',
        },
        {
          type: 'callout',
          label: 'ATTRIBUTION',
          text:
            'This project is fan-made and non-commercial. *The Matrix* and all related characters, names, and imagery are © Warner Bros. Entertainment Inc.; the films were created by the Wachowskis. This console is not affiliated with, sponsored by, or endorsed by Warner Bros.',
        },
        {
          type: 'quote',
          text: 'I can only show you the door. You\'re the one that has to walk through it.',
          attribution: 'Morpheus — which is also how the rest of this library works',
        },
      ],
    },
  ],
};
