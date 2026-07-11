import type { Lesson } from '../types';
import stylesMap from '../assets/kung-fu-styles.svg';

export const kungFu: Lesson = {
  id: 'kung-fu',
  code: 'C-01',
  title: 'KUNG FU',
  tagline: 'I know kung fu. — Show me.',
  category: 'combat',
  summary:
    'What "kung fu" actually means, fifteen centuries of history from temple legend to cinema, the internal/external map of major styles, and the philosophy that holds it together.',
  sizeLabel: '847 EXABYTES',
  estMinutes: 9,
  sections: [
    {
      id: 'name',
      heading: 'WHAT THE WORD ACTUALLY MEANS',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Here is the first surprise: in Chinese, **gongfu** (功夫) does not mean "martial art." It means *skill earned through sustained effort* — time put in. A calligrapher can have gongfu. A cook can have gongfu. The word the language uses for martial arts as a category is **wushu** (武術, "martial technique"), and older texts say **quanfa** (拳法, "fist methods"). Calling the fighting arts "kung fu" is largely a twentieth-century export, popularized when Cantonese-speaking masters and Hong Kong cinema carried the arts abroad.',
        },
        {
          type: 'paragraph',
          text:
            'The mistranslation is accidentally profound, and every teacher leans into it: the arts are not a set of secret techniques you receive, they are ordinary movements made extraordinary by *years of repetition*. The name promises nothing except work.',
        },
        {
          type: 'callout',
          label: 'TERMINOLOGY NOTE',
          text:
            'Modern usage splits one more way: **wushu** now also names the acrobatic performance sport codified in mainland China in the 1950s, while traditional combat lineages often prefer "gongfu" or "traditional Chinese martial arts" to distinguish themselves from it.',
        },
      ],
    },
    {
      id: 'history',
      heading: 'FIFTEEN CENTURIES IN FIVE PARAGRAPHS',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Organized fighting skill in China is as old as its armies — Zhou- and Han-dynasty texts already describe wrestling, swordsmanship, and archery as trained disciplines. The civilian arts you would recognize as kung fu coalesced much later, absorbing military technique, village self-defense, opera acrobatics, and religious practice into distinct family and temple lineages.',
        },
        {
          type: 'paragraph',
          text:
            'The most famous origin story centers on the **Shaolin Monastery** in Henan province. Legend credits *Bodhidharma* (Damo), an Indian monk of the fifth–sixth century, with teaching exercises to monks whose meditation had made their bodies weak — the seed, supposedly, of Shaolin boxing. Historians treat this as myth grafted on centuries later; what the record does support is that by the Ming dynasty, Shaolin monks were famous enough as fighters — especially with the staff — to be hired against coastal pirates. The temple\'s reputation became a gravity well: styles across the country claimed Shaolin ancestry the way restaurants claim a grandmother\'s recipe.',
        },
        {
          type: 'paragraph',
          text:
            'The Qing era (1644–1912) drove the arts sideways — into secret societies, village militias, and traveling performance troupes, where anti-Qing sentiment and martial training mixed. This is the era most southern styles date themselves to, full of stories about the burning of a (probably legendary) southern Shaolin temple and fugitive masters seeding new lineages.',
        },
        {
          type: 'paragraph',
          text:
            'The twentieth century modernized everything. The **Jingwu Athletic Association** (Shanghai, 1910) taught martial arts publicly and cross-style, breaking clan secrecy. After 1949, the People\'s Republic standardized performance **wushu** as a national sport, while many traditional masters carried their systems to Hong Kong, Taiwan, and Chinatowns worldwide. From Hong Kong, one man — **Bruce Lee** — detonated the word "kung fu" into global vocabulary in the early 1970s.',
        },
        {
          type: 'paragraph',
          text:
            'Today the ecosystem spans temple tourism, Olympic-track wushu, village lineages, and MMA gyms testing which traditional tools survive pressure. The arts have always adapted; adaptation *is* the tradition.',
        },
      ],
    },
    {
      id: 'map',
      heading: 'THE MAP: INTERNAL, EXTERNAL, NORTH, SOUTH',
      blocks: [
        {
          type: 'paragraph',
          text:
            'With hundreds of documented styles, practitioners navigate by two rough axes. **External (waijia)** styles emphasize conditioning, speed, and visible power; **internal (neijia)** styles emphasize structure, sensitivity, and redirecting force — categories coined by internal-arts advocates and, like all good maps, only approximately true. The geographic axis says "**southern fists, northern legs**": southern styles favor rooted stances and close-range hand work; northern styles favor long-range strikes, footwork, and kicks.',
        },
        {
          type: 'readout',
          entries: [
            { term: 'SHAOLINQUAN', detail: 'The northern temple root system: long-range, athletic, staff-heavy. More parent lineage than single style.' },
            { term: 'TAIJIQUAN', detail: 'Internal. Slow-trained spirals and yielding that hide throws and joint work; Chen village origin, Yang family popularization.' },
            { term: 'WING CHUN', detail: 'Southern, close-range: centerline theory, chain punches, sticky-hands sensitivity. Yip Man taught it; Bruce Lee started here.' },
            { term: 'HUNG GA', detail: 'Southern power: deep horse stances, bridge-arm conditioning, tiger and crane imagery.' },
            { term: 'CHOY LI FUT', detail: 'Southern but long-armed: swinging, whipping strikes designed for multiple opponents.' },
            { term: 'BAGUAZHANG', detail: 'Internal. Circle-walking and constant turning — fighting while orbiting the opponent.' },
            { term: 'XINGYIQUAN', detail: 'Internal but blunt: linear, aggressive five-element strikes. The internal art that behaves like a battering ram.' },
            { term: 'PRAYING MANTIS', detail: 'Northern: hooking mantis grips, rapid combination trapping.' },
            { term: 'BAJIQUAN', detail: 'Short-range explosiveness — elbows and shoulder strikes from sudden closing steps. Historically favored by bodyguards.' },
          ],
        },
      ],
      image: {
        src: stylesMap,
        alt: 'Simplified classification tree of Chinese martial arts styles',
        caption: 'FIG 1.1 — a working map, not a taxonomy',
      },
    },
    {
      id: 'training',
      heading: 'HOW IT IS TRAINED',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Nearly every lineage builds from the same four layers. **Basics (jibengong)**: stances, stepping, flexibility, conditioning — years of horse stance before anything cinematic. **Forms (taolu)**: choreographed solo sequences that act as the style\'s living textbook, compressing its techniques and body mechanics into rehearsable shape. **Partner work**: drills, sticky hands, applications extracted from the forms. **Free practice**: sparring formats like *sanda* (Chinese kickboxing) or push hands, where technique meets resistance.',
        },
        {
          type: 'paragraph',
          text:
            'The traditional arts also carry an ethical frame, **wude** ("martial virtue"): humility, restraint, respect for lineage, and the obligation not to misuse what you learn. Many schools braid in Chan (Zen) Buddhist meditation or Daoist breath-and-energy work (*qigong*) — the "qi" of it reads to a modern eye as an old vocabulary for breath, alignment, intent, and trained relaxation.',
        },
        {
          type: 'quote',
          text: 'I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.',
          attribution: 'Bruce Lee',
        },
      ],
    },
    {
      id: 'cinema',
      heading: 'WHY THE MATRIX FIGHTS LIKE THIS',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Kung fu\'s global image was built on film: the Shaw Brothers studio codified the genre in 1960s–70s Hong Kong, Bruce Lee gave it philosophy and box-office fire, and Jackie Chan folded in opera-school acrobatics and comedy. The bridge to this website\'s source material is direct — the Wachowskis hired **Yuen Woo-ping**, the Hong Kong action director behind *Drunken Master*, to choreograph *The Matrix*. The cast trained for months in wire work and kung fu shapes; the dojo sparring program, the wire-assisted weightlessness, even "I know kung fu" itself are Hong Kong cinema grammar quoted lovingly by Hollywood.',
        },
        {
          type: 'paragraph',
          text:
            'So when Neo downloads kung fu in seconds, the joke lands *because* the word means the opposite: skill that cannot be downloaded, only earned. Ten thousand hours, compressed into a cheat code — every practitioner in the audience smiled at that.',
        },
      ],
    },
  ],
  sources: [
    'Meir Shahar, *The Shaolin Monastery: History, Religion, and the Chinese Martial Arts* (2008)',
    'Peter Lorge, *Chinese Martial Arts: From Antiquity to the Twenty-First Century* (2012)',
    'Benjamin Judkins & Jon Nielson, *The Creation of Wing Chun* (2015)',
  ],
};
