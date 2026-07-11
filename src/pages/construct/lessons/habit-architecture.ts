import type { Lesson } from '../types';
import habitLoop from '../assets/habit-loop.svg';

export const habitArchitecture: Lesson = {
  id: 'habit-architecture',
  code: 'C-04',
  title: 'HABIT ARCHITECTURE',
  tagline: 'The Matrix is a system of loops. So are you.',
  category: 'mind',
  summary:
    'How habits actually form (the loop, the timeline, the myths), the four laws for installing new ones, the inversion for deleting old ones, and why identity beats willpower.',
  sizeLabel: '128 TERABYTES',
  estMinutes: 7,
  sections: [
    {
      id: 'loop',
      heading: 'THE LOOP UNDER EVERYTHING',
      blocks: [
        {
          type: 'paragraph',
          text:
            'A habit is behavior that has been compiled — moved from the brain\'s slow, deliberate systems into fast automatic machinery (the basal ganglia are heavily involved) so it runs without conscious debate. The compiler\'s input format is a loop. Charles Duhigg popularized it as *cue → routine → reward*; James Clear\'s **Atomic Habits** (2018) splits it into four beats: **cue** (the trigger), **craving** (the wanting it produces), **response** (the behavior), **reward** (the payoff that teaches the brain to run it again). Every habit you have — good, bad, invisible — is this loop with the serial numbers filed off.',
        },
        {
          type: 'paragraph',
          text:
            'Two myths to delete. First, "21 days to form a habit" is folklore (it traces to a plastic surgeon\'s observations about amputees adjusting to their bodies, not to habit research). The real data — **Phillippa Lally\'s** 2010 study — found automaticity took anywhere from **18 to 254 days, averaging about 66**, depending on the person and the behavior. Second, missing a day does not reset the counter; the curve barely notices single gaps. The rule that matters: **never miss twice**. Once is an accident; twice is the start of a rival habit.',
        },
      ],
      image: {
        src: habitLoop,
        alt: 'Circular diagram of the habit loop: cue, craving, response, reward, each paired with one of the four laws',
        caption: 'FIG 4.1 — the loop, annotated with the four laws of behavior change',
      },
    },
    {
      id: 'install',
      heading: 'INSTALLING: THE FOUR LAWS',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Clear\'s framework maps one design rule onto each beat of the loop. To build a habit, engineer all four in its favor:',
        },
        {
          type: 'readout',
          entries: [
            { term: '1. MAKE IT OBVIOUS', detail: 'Design the cue. The strongest tool is the **implementation intention** (Peter Gollwitzer\'s research): "When *situation X*, I will *behavior Y*" — e.g. "When I pour my morning coffee, I will write one sentence." Vague intentions fail because the brain never receives a trigger. **Habit stacking** chains a new habit onto an existing one.' },
            { term: '2. MAKE IT ATTRACTIVE', detail: 'Bundle the behavior with something you want (only the podcast while running), and exploit the social gradient — join the group where your desired behavior is the normal one. We absorb the habits of our tribes.' },
            { term: '3. MAKE IT EASY', detail: 'Shrink the start: the **two-minute rule** says the habit\'s entry version should take under two minutes ("read one page," "put on the gi"). Reduce friction — gym bag packed by the door, editor already open. You are not training the outcome yet; you are training *showing up*.' },
            { term: '4. MAKE IT SATISFYING', detail: 'The brain repeats what pays immediately. Add a small instant reward, and track the streak — a marked calendar is a reward dispenser. What gets measured gets repeated.' },
          ],
        },
      ],
    },
    {
      id: 'uninstall',
      heading: 'UNINSTALLING: RUN THE LAWS IN REVERSE',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Bad habits are not deleted by willpower; they are **starved and outcompeted**. Invert each law: make the cue *invisible* (the single highest-leverage move — remove the app, the snack, the tab from your environment rather than resisting them in place), make it *unattractive* (reframe what it costs you), make it *hard* (add friction: log out, unplug, move it to another room), make it *unsatisfying* (visibility — a tracked slip, an accountability partner).',
        },
        {
          type: 'paragraph',
          text:
            'Note the pattern: every effective move edits the **environment**, not the self. Willpower is real but expensive and depletable; people who look disciplined mostly live in better-designed rooms. And because old loops are dormant rather than erased, the reliable strategy is **replacement** — keep the cue and reward, swap the response — rather than leaving a vacuum where the routine used to fire.',
        },
        {
          type: 'callout',
          label: 'KNOWN EXPLOIT',
          text:
            'Trackers can become the habit. When the streak number matters more than the behavior it measures, quality quietly collapses into checkbox-satisfying minimums. Audit occasionally: is the loop still producing the thing, or just the metric?',
        },
      ],
    },
    {
      id: 'identity',
      heading: 'IDENTITY: THE ROOT ACCESS LAYER',
      blocks: [
        {
          type: 'paragraph',
          text:
            'The deepest version of the practice ignores outcomes entirely. Outcome-based thinking says "I want to run a marathon"; **identity-based** thinking says "I am becoming a runner," and every completed loop is a *vote for that identity*. Votes compound: the person with two hundred small runs behind them does not need motivation to run, any more than you need motivation to brush your teeth. The habit has stopped being something they do and become someone they are.',
        },
        {
          type: 'paragraph',
          text:
            'This is also the honest frame for systems versus goals: a goal is a finish line, a **system** is the loop that runs regardless. Winners and losers often share the same goals; what separates them is what they repeat on the days nothing special happens. Choose the identity, build the loop, and let the outcomes arrive as side effects.',
        },
        {
          type: 'quote',
          text: 'There is a difference between knowing the path and walking the path.',
          attribution: 'Morpheus — the entire habit literature in one sentence',
        },
      ],
    },
  ],
  sources: [
    'James Clear, *Atomic Habits* (2018)',
    'Charles Duhigg, *The Power of Habit* (2012)',
    'Phillippa Lally et al., "How are habits formed: Modelling habit formation in the real world," *European Journal of Social Psychology* (2010)',
    'Peter Gollwitzer, "Implementation Intentions: Strong Effects of Simple Plans," *American Psychologist* (1999)',
  ],
};
