import type { Lesson } from '../types';
import pomodoro from '../assets/pomodoro-cycle.svg';

export const deepWork: Lesson = {
  id: 'deep-work',
  code: 'C-03',
  title: 'DEEP WORK PROTOCOL',
  tagline: 'Free your mind — from the notification tray.',
  category: 'mind',
  summary:
    'Why sustained attention is rare and valuable, what context switching actually costs, and a field-tested protocol — time blocks, Pomodoro cycles, environment design, and real rest — for reclaiming it.',
  sizeLabel: '256 TERABYTES',
  estMinutes: 8,
  sections: [
    {
      id: 'problem',
      heading: 'THE PROBLEM: RESIDUE',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Attention does not switch cleanly. When you jump from a report to a chat window and back, part of your mind stays with the chat — business researcher **Sophie Leroy** named this **attention residue** (2009), and showed that performance on the second task drops while the residue persists. The cost of an interruption is not the thirty seconds it takes; it is the re-immersion afterward, which for demanding work can take many minutes. A workday sliced by dozens of small switches can contain hours of motion and zero depth.',
        },
        {
          type: 'paragraph',
          text:
            'Cal Newport\'s *Deep Work* (2016) split effort into two categories that are worth internalizing: **deep work** — cognitively demanding, distraction-free effort that pushes your abilities and produces hard-to-replicate value — and **shallow work** — logistical, interruptible tasks that feel busy but could be done by almost anyone at almost any time. His argument: the economy increasingly rewards the first, while modern tools relentlessly train you for the second. The skill of concentrating is therefore both scarcer and more valuable than it used to be — and, like any skill, it responds to training.',
        },
        {
          type: 'callout',
          label: 'THREAT ASSESSMENT',
          text:
            'The phone deserves special mention. A 2017 study led by **Adrian Ward** found that the mere *presence* of your own smartphone — face down, silenced, on the desk — measurably taxes working memory versus leaving it in another room. The device does not need to buzz to cost you; your brain spends background cycles *not checking it*.',
        },
      ],
    },
    {
      id: 'blocks',
      heading: 'PROTOCOL 1 :: BLOCK THE TIME',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Depth does not happen in the gaps between meetings; it has to be scheduled like one. **Time blocking** means giving every hour of the working day a job in advance — including blocks explicitly reserved for deep work, ideally at your best hours and protected like appointments. The plan will break by 11:00; that is fine. The practice is revising the plan, not abandoning it, because the alternative is letting the inbox schedule your day.',
        },
        {
          type: 'list',
          style: 'bullet',
          items: [
            '**Decide the one target** before the block starts. A deep block with a vague goal degrades into research-flavored browsing.',
            '**Ritualize entry**: same place, same drink, phone in another room, one full-screen window. Rituals cut the startup cost of focus.',
            '**Define shutdown**: an explicit end-of-day review — capture loose ends, plan tomorrow\'s blocks — so unfinished tasks stop replaying all evening (the Zeigarnik itch).',
            '**Quota the shallow**: batch email/chat into set windows instead of ambient monitoring.',
          ],
        },
      ],
    },
    {
      id: 'pomodoro',
      heading: 'PROTOCOL 2 :: THE POMODORO CYCLE',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Inside a deep block, the **Pomodoro Technique** is the standard-issue engine. Designed by **Francesco Cirillo** in the late 1980s (named for his tomato-shaped kitchen timer), the cycle is brutally simple: **25 minutes** of single-task focus, **5 minutes** of real break, and after four cycles a **longer break of 15–30 minutes**. During the 25, nothing else exists; if a stray to-do surfaces, write it on a capture sheet and return.',
        },
        {
          type: 'paragraph',
          text:
            'Why such a blunt tool works so well: the timer **externalizes discipline** (you only ever commit to 25 minutes, which defeats the resistance to starting), creates **mild deadline pressure** that suppresses wandering, and produces a countable unit of focus — four pomodoros is a measurable morning. The numbers are defaults, not law: common variants run 50/10 or 90/20, the latter tracking the body\'s roughly 90-minute **ultradian rhythm** of alertness. Match the interval to the work; keep the structure.',
        },
        {
          type: 'callout',
          label: 'BREAK DISCIPLINE',
          text:
            'A break that opens a feed is not a break — it is a context switch with residue. Stand, stretch, water, window. The 5 minutes are for your eyes and spine, not your dopamine.',
        },
      ],
      image: {
        src: pomodoro,
        alt: 'Diagram of the Pomodoro cycle: 25-minute focus block, 5-minute break, repeated four times, then a long break',
        caption: 'FIG 3.1 — the standard cycle; tune the numbers, keep the loop',
      },
    },
    {
      id: 'environment',
      heading: 'PROTOCOL 3 :: RIG THE ENVIRONMENT',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Willpower is a spot repair; environment is infrastructure. The reliable moves are all versions of one idea — **add friction to distraction, remove friction from the work**:',
        },
        {
          type: 'list',
          style: 'bullet',
          items: [
            'Phone in another room (see threat assessment above). Not pocket. Room.',
            'One screen, one full-screen app during deep blocks; every visible tab is an open loop.',
            'Notifications default-off, allowlist the few that matter, instead of default-on with muting.',
            'Leave the work **mid-stride** at day\'s end — a half-written paragraph is an on-ramp for tomorrow.',
            'Steady background sound beats variable chatter; silence or repetitive audio outperforms lyrics for verbal work.',
          ],
        },
      ],
    },
    {
      id: 'rest',
      heading: 'REST IS PART OF THE PROTOCOL',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Focus is a muscle with a daily budget — most practitioners find roughly **three to four hours** of genuinely deep work per day is the sustainable ceiling, and pretending otherwise just produces shallow work in a deep costume. What restores the budget is unglamorous: real sleep (memory consolidation happens there, not at the desk), walks and exercise, and time where the mind idles — the diffuse mode in which stuck problems have a habit of un-sticking. Downtime is not the opposite of the work; it is the half of the work that happens off-screen.',
        },
        {
          type: 'quote',
          text: 'Do not try and bend the spoon — that\'s impossible. Instead, only try to realize the truth: there is no spoon. It is not the spoon that bends, it is only yourself.',
          attribution: 'Spoon Boy — also, roughly, how attention training works: you do not fight the distraction, you change the attender',
        },
      ],
    },
  ],
  sources: [
    'Cal Newport, *Deep Work: Rules for Focused Success in a Distracted World* (2016)',
    'Francesco Cirillo, *The Pomodoro Technique* (2006 edition of the 1980s method)',
    'Sophie Leroy, "Why is it so hard to do my work?" — attention residue, *Org. Behavior and Human Decision Processes* (2009)',
    'Adrian Ward et al., "Brain Drain: The Mere Presence of One\'s Own Smartphone Reduces Available Cognitive Capacity" (2017)',
  ],
};
