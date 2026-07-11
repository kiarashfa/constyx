import type { Lesson } from '../types';
import hierarchy from '../assets/bjj-hierarchy.svg';

export const jiuJitsu: Lesson = {
  id: 'jiu-jitsu',
  code: 'C-02',
  title: 'JIU-JITSU',
  tagline: 'The gentle art. Leverage beats strength; position beats everything.',
  category: 'combat',
  summary:
    'From samurai grappling to the Gracie garage to the first UFC: the history of Brazilian Jiu-Jitsu, the positional hierarchy that organizes it, and the core toolbox of sweeps, escapes, and submissions.',
  sizeLabel: '512 EXABYTES',
  estMinutes: 9,
  sections: [
    {
      id: 'roots',
      heading: 'BATTLEFIELD ROOTS: JUJUTSU AND JUDO',
      blocks: [
        {
          type: 'paragraph',
          text:
            '**Jujutsu** (柔術) was the unarmed toolkit of the samurai — what you do when the sword is gone and the other man is wearing armor. Striking armor breaks your hand, so the old schools (*koryu*) specialized in throws, pins, chokes, and joint locks. The name translates as the "gentle" or, better, *yielding* art: use the opponent\'s force and structure against him instead of meeting strength with strength.',
        },
        {
          type: 'paragraph',
          text:
            'In 1882 an educator named **Kano Jigoro** distilled the jujutsu schools he had studied into **judo**. His crucial innovation was less technical than methodological: he removed the techniques too dangerous to rehearse at full power, precisely *so that* everything remaining could be trained at full power against full resistance — live sparring, called **randori**. A practitioner who drills against real resistance every night beats one who rehearses lethal moves slowly. That single training-method insight is the engine behind everything else in this lesson.',
        },
        {
          type: 'callout',
          label: 'CORE PRINCIPLE',
          text:
            'Kano\'s motto: **seiryoku zen\'yo** — maximum efficiency, minimum effort. Jiu-jitsu\'s entire family tree is an argument that technique, leverage, and timing are a form of force multiplication.',
        },
      ],
    },
    {
      id: 'brazil',
      heading: 'THE BRAZILIAN FORK',
      blocks: [
        {
          type: 'paragraph',
          text:
            '**Mitsuyo Maeda**, a Kodokan judoka nicknamed "Count Koma," left Japan to demonstrate the art in challenge matches around the world and settled in Belém, Brazil, in the 1910s. There he taught, among others, **Carlos Gracie**, who opened an academy with his brothers in 1925. The youngest brother, **Hélio**, small and frail by family legend, became the style\'s ideologue: where a technique demanded strength or explosiveness, he and his brothers reworked it around *leverage, timing, and patience* — a system a smaller person could impose on a bigger one, especially on the ground.',
        },
        {
          type: 'paragraph',
          text:
            'The Gracies proved the product in **vale tudo** ("anything goes") matches and open challenges for decades. Then came the export moment: in 1993, Rorion Gracie co-created the **Ultimate Fighting Championship** in Denver largely as an advertisement, and his slight, calm brother **Royce** — deliberately chosen over larger family members — choked out three bigger men in one night. Every fight going to the ground while the world watched did in one evening what seventy years of challenge matches had done in Brazil. Ground grappling became mandatory education for every fighter on earth.',
        },
        {
          type: 'paragraph',
          text:
            'Since then the art has split into overlapping worlds — self-defense curricula, sport BJJ under IBJJF-style rules (points for takedowns, passes, mount, back control), no-gi submission grappling, and its permanent role inside MMA. A famous footnote connects the branches: the **kimura** shoulder lock is named for judoka Masahiko Kimura, who broke Hélio Gracie\'s arm with it in their legendary 1951 match — the Gracies named the technique after the man who beat them, which tells you something about the culture\'s respect for what works.',
        },
      ],
    },
    {
      id: 'hierarchy',
      heading: 'THE POSITIONAL HIERARCHY',
      blocks: [
        {
          type: 'paragraph',
          text:
            'BJJ\'s deepest idea is that ground fighting is not chaos — it is a *ladder of positions*, each defined by how much control you have over the opponent\'s movement and how many of your weapons work versus theirs. The guiding maxim is **"position before submission"**: climb first, attack from altitude. A submission attempted from a bad position usually costs you the position; one attempted from a dominant position risks nothing.',
        },
        {
          type: 'paragraph',
          text:
            'The unique piece is the **guard** — fighting off your back with your legs between you and the opponent. In most arts, being underneath is defeat; in jiu-jitsu it is a neutral, even offensive, position with its own families (closed, half, open variants like spider and butterfly). The guard is why the art equalizes size: legs are longer and stronger than arms, and the bottom player gets to use all four limbs while the top player\'s base is busy holding him up.',
        },
        {
          type: 'list',
          style: 'bullet',
          items: [
            '**Sweep** — from guard, reverse the position: bottom becomes top (+2 in sport rules).',
            '**Pass** — the top player\'s counter-project: get past the legs to side control (+3).',
            '**Escape** — from anywhere bad, recover guard or stand up. White-belt year one is mostly this.',
            '**Submission** — the ladder\'s exit: chokes and joint locks that end the match from control.',
          ],
        },
      ],
      image: {
        src: hierarchy,
        alt: 'Ladder diagram of Brazilian Jiu-Jitsu positions from back control down to being flattened out',
        caption: 'FIG 2.1 — the positional ladder; sport-rule points annotated',
      },
    },
    {
      id: 'toolbox',
      heading: 'THE TOOLBOX',
      blocks: [
        {
          type: 'readout',
          entries: [
            { term: 'REAR-NAKED CHOKE', detail: 'From back control; forearm across the carotids. The highest-percentage finish in the art.' },
            { term: 'TRIANGLE CHOKE', detail: 'Legs figure-four around neck and one arm, strangling with your thighs — the guard\'s signature ambush.' },
            { term: 'ARMBAR', detail: 'Hips against the elbow joint, whole body versus one arm. Available from guard, mount, and back.' },
            { term: 'KIMURA / AMERICANA', detail: 'Figure-four shoulder locks; the kimura doubles as a control system.' },
            { term: 'GUILLOTINE', detail: 'Front headlock choke — the standard tax on careless takedown entries.' },
            { term: 'LEG LOCKS', detail: 'Ankle locks to heel hooks; the modern no-gi meta. Trained late because knees give little warning before they give way.' },
          ],
        },
        {
          type: 'paragraph',
          text:
            'Under the named techniques sit the real fundamentals: **frames** (skeletal structure placed so the opponent lifts bone, not muscle), **hip escapes** ("shrimping" — the art\'s single most drilled movement), **base** (a posture that cannot be tipped), **grips**, and **pressure**. Advanced players describe the art as a conversation of weight distribution; the submissions are just punctuation.',
        },
      ],
    },
    {
      id: 'culture',
      heading: 'BELTS, ROLLING, AND WHY IT WORKS',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Adult ranks run **white → blue → purple → brown → black**, and the timeline is famously honest: black belts typically take around a decade. There is no memorizing your way up — promotion tracks what you can *do* to resisting training partners. The daily practice is **rolling**: full-resistance sparring, every session, at every level. It is judo\'s randori inheritance, and it is why the art\'s claims are self-auditing. You cannot pretend to have escaped mount.',
        },
        {
          type: 'paragraph',
          text:
            'The culture\'s safety contract is the **tap** — slap the mat or the person, everything stops instantly, no shame attached. Tapping early keeps fifty-year-olds training; treating the tap as data instead of defeat is the sport\'s entire mental game. Gyms repeat the same koans for a reason: *leave your ego at the door*; *you win or you learn*; and the one every white belt is told on day one — **just survive**. Comfort under a heavier opponent\'s pressure, breathing where panic wants to live, is the first skill, and the one that transfers furthest outside the mats.',
        },
        {
          type: 'quote',
          text: 'A black belt is a white belt who never quit.',
          attribution: 'mat proverb, lineage disputed, truth undisputed',
        },
      ],
    },
  ],
  sources: [
    'Robert Drysdale, *Opening Closed Guard: The Origins of Jiu-Jitsu in Brazil* (documentary & book research, 2020)',
    'John Danaher & Renzo Gracie, *Mastering Jujitsu* (2003)',
    'Kodokan Judo Institute — historical materials on Kano Jigoro and randori',
  ],
};
