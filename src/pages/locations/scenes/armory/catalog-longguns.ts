import { FIRE_BY_ARCHETYPE, type WeaponEntry } from './types';

export const RIFLES: WeaponEntry[] = [
  {
    id: 'ak47',
    name: 'AK-47',
    category: 'rifles',
    spec: 'Soviet Union · 1949 · 7.62×39mm · long-stroke gas piston, select fire',
    body: [
      'Mikhail Kalashnikov, a tank sergeant wounded in 1941, designed the most produced firearm in human history — on the order of 75 to 100 million AK-pattern rifles exist, more than every other rifle design combined. It was adopted by the Soviet Army in 1949 and has appeared in essentially every armed conflict since.',
      'Its genius is deliberate looseness. The long-stroke gas piston slams the action through its cycle with enormous margin, and generous clearances between moving parts mean mud, sand, ice, and neglect rarely stop it. The trade — modest accuracy — was a price Soviet doctrine was happy to pay. It works when nothing else does, and everyone on Earth recognizes its curve-magazine silhouette.',
    ],
    archetype: 'rifle',
    fire: FIRE_BY_ARCHETYPE.rifle,
  },
  {
    id: 'm16',
    name: 'M16',
    category: 'rifles',
    spec: 'United States · 1964 · 5.56×45mm · direct-impingement gas, select fire',
    body: [
      'Eugene Stoner\'s AR-15 broke every convention of 1950s rifle-making: aircraft aluminum receivers, plastic furniture, and a tiny high-velocity .22-caliber cartridge in place of full-power .30. The Army adopted it as the M16 during Vietnam, where an early scandal — a propellant change plus the myth that it never needed cleaning — caused fouling failures until chrome-lined bores and cleaning kits fixed its reputation.',
      'Stoner\'s direct-impingement system pipes gas straight into the bolt carrier rather than pushing a piston, keeping reciprocating mass light and in line with the shooter\'s shoulder — a big part of why the platform is so flat-shooting and easy to control. Its M4 descendants still arm the United States and much of NATO.',
    ],
    archetype: 'rifle',
    fire: { ...FIRE_BY_ARCHETYPE.rifle, spread: 0.0045 },
  },
  {
    id: 'fnfal',
    name: 'FN FAL',
    category: 'rifles',
    spec: 'Belgium · 1953 · 7.62×51mm NATO · short-stroke gas, tilting breechblock',
    body: [
      'Dieudonné Saive\'s battle rifle was adopted by more than ninety countries and earned the nickname "the right arm of the free world" — through the Cold War, if a Western-aligned nation issued a rifle, odds were good it was a FAL.',
      'It fires the full-power 7.62 NATO cartridge from a short-stroke gas system with an adjustable regulator and a tilting breechblock. In automatic fire it climbs hard — most nations issued it semi-auto only — but as a hard-hitting, utterly serviceable infantry rifle it defined an entire generation of Western small arms before the small-caliber era.',
    ],
    archetype: 'rifle',
    fire: { ...FIRE_BY_ARCHETYPE.rifle, intervalMs: 130, kick: 0.1, spread: 0.005 },
  },
  {
    id: 'aug',
    name: 'STEYR AUG',
    category: 'rifles',
    spec: 'Austria · 1977 · 5.56×45mm · bullpup, short-stroke gas',
    body: [
      'The Armee-Universal-Gewehr was the first bullpup rifle a major army fully committed to. By placing the action behind the trigger, the AUG fits a full-length barrel into a carbine-sized package — and Steyr wrapped it in green polymer with an integrated 1.5× optic at a time when both choices looked like science fiction.',
      'Its modularity was equally ahead of schedule: barrels swap in seconds, and the trigger is two-stage by pull weight alone — half pressure for semi-auto, full pull for automatic. Austria adopted it in 1977 and it still serves there and in Australia, Ireland, and beyond.',
    ],
    archetype: 'bullpup',
    fire: FIRE_BY_ARCHETYPE.bullpup,
  },
  {
    id: 'sks',
    name: 'SKS',
    category: 'rifles',
    spec: 'Soviet Union · 1945 · 7.62×39mm · short-stroke gas, fixed magazine',
    body: [
      'Sergei Simonov\'s carbine introduced the 7.62×39mm intermediate cartridge to Soviet service, arriving just before the AK-47 made it a transitional design almost overnight. The USSR moved on quickly, but licensed production in China and across the Eastern Bloc kept the SKS in the field for decades — and made it one of the most widely distributed rifles on Earth.',
      'It is a semi-automatic with a fixed ten-round magazine fed by stripper clips, a folding bayonet under the barrel, and traditional wooden furniture: the last of the old-world service carbines, built at the exact moment the assault rifle replaced them.',
    ],
    archetype: 'rifle',
    fire: { ...FIRE_BY_ARCHETYPE.rifle, auto: false, intervalMs: 220, spread: 0.004 },
  },
];

export const SHOTGUNS: WeaponEntry[] = [
  {
    id: 'rem870',
    name: 'REMINGTON 870',
    category: 'shotguns',
    spec: 'United States · 1950 · 12 gauge · pump action',
    body: [
      'The most produced shotgun in history — well past eleven million — and the pattern most people picture when they hear "pump action." Remington built it on a receiver machined from a solid billet of steel, with twin action bars that cured the binding older single-bar pumps suffered.',
      'Its manual action is its virtue: cycling is powered by the shooter, not the shell, so it digests everything from light birdshot to heavy slugs without adjustment. It has served hunters, every level of American law enforcement, and military forces continuously for seventy years.',
    ],
    archetype: 'shotgun',
    fire: FIRE_BY_ARCHETYPE.shotgun,
  },
  {
    id: 'spas12',
    name: 'FRANCHI SPAS-12',
    category: 'shotguns',
    spec: 'Italy · 1979 · 12 gauge · dual-mode: gas semi-automatic / pump',
    body: [
      'The Sporting Purpose Automatic Shotgun (a name chosen with importers in mind — it was designed for police and military use) can switch between gas-operated semi-automatic fire for full-power loads and manual pump operation for low-pressure specialty rounds like tear gas or beanbags.',
      'The dual mode made it heavy and complex, and its folding stock with the distinctive over-arm hook made it look like nothing else — which is why filmmakers adored it. Its menacing profile made it one of the most-cast shotguns in action cinema history.',
    ],
    filmNote: 'A fixture of 80s–90s action films; widely documented among the lobby scene\'s arsenal.',
    archetype: 'shotgun',
    fire: { ...FIRE_BY_ARCHETYPE.shotgun, intervalMs: 500 },
  },
  {
    id: 'coach',
    name: 'COACH GUN',
    category: 'shotguns',
    spec: 'Various · 19th century · 12 gauge · side-by-side break action',
    body: [
      'The short-barreled double gun that rode shotgun — literally; the phrase comes from the guard seated beside a stagecoach driver with one of these across his lap. Two barrels, two triggers, break-action loading: a design so simple it has never needed improvement.',
      'With no gas system, no magazine, and no cycling to fail, the double gun\'s two instant shots remain the most reliable payload delivery firearms have ever managed. Every hinge-action shotgun made today is its direct descendant.',
    ],
    archetype: 'double',
    fire: FIRE_BY_ARCHETYPE.double,
  },
  {
    id: 'auto5',
    name: 'BROWNING AUTO-5',
    category: 'shotguns',
    spec: 'Belgium/USA · 1902 · 12 gauge · long-recoil semi-automatic',
    body: [
      'John Browning called it his finest achievement — the first successful semi-automatic shotgun, patented in 1900 and manufactured by FN in Belgium for nearly a full century. The unmistakable "humpback" receiver isn\'t styling; it is the housing for the long-recoil action, in which the entire barrel recoils rearward with the bolt before they return separately.',
      'That mechanism meant the gun had to be tuned to its ammunition with friction rings, a small price for reliable self-loading decades before gas systems matured. Around three million were made, and the humpback silhouette remains one of the most recognizable in the sporting world.',
    ],
    archetype: 'shotgun',
    fire: { ...FIRE_BY_ARCHETYPE.shotgun, intervalMs: 450, spread: 0.024 },
  },
];

export const SUPPORT: WeaponEntry[] = [
  {
    id: 'm60',
    name: 'M60',
    category: 'support',
    spec: 'United States · 1957 · 7.62×51mm NATO · belt-fed, open bolt',
    body: [
      'America\'s first true general-purpose machine gun, borrowing its belt-feed mechanism from the German MG42 and its gas system lineage from the FG42. Vietnam made it an icon: at over ten kilograms loaded, the soldiers who carried it called it "the Pig," and the assistant gunner draped in belts became one of the war\'s defining images.',
      'It fires from an open bolt to keep a hot chamber from cooking off rounds, with a quick-change barrel for sustained fire. Temperamental in its early marks — the bipod and gas system came off with the barrel — it was progressively refined and soldiered on into the 2000s.',
    ],
    archetype: 'lmg',
    fire: FIRE_BY_ARCHETYPE.lmg,
  },
  {
    id: 'rpk',
    name: 'RPK',
    category: 'support',
    spec: 'Soviet Union · 1961 · 7.62×39mm · long-stroke gas, magazine-fed',
    body: [
      'The Soviet squad automatic answer was characteristically pragmatic: take the AKM, give it a longer and heavier barrel, a strengthened receiver, a bipod, and larger magazines. The RPK shares almost every part and every habit with the rifles beside it — same manual of arms, same ammunition, same indifference to abuse.',
      'The fixed barrel limits sustained fire compared to belt-fed guns, but the doctrine never asked for that; it asked for accurate automatic fire a rifleman could carry and any AK-trained conscript could use instantly. Tens of thousands still serve worldwide.',
    ],
    archetype: 'lmg',
    fire: { ...FIRE_BY_ARCHETYPE.lmg, intervalMs: 100, spread: 0.01 },
  },
  {
    id: 'm2',
    name: 'BROWNING M2',
    category: 'support',
    spec: 'United States · 1933 · .50 BMG · short-recoil, belt-fed',
    body: [
      '"Ma Deuce" is the longest-serving firearm design in the US arsenal — John Browning developed the gun and its enormous .50 BMG cartridge at the end of WWI, the M2HB form arrived in 1933, and it remains in front-line service today, essentially unchanged, over ninety years later.',
      'The short-recoil action throws a 45-gram bullet past 900 m/s, effective against vehicles, aircraft, and emplacements out beyond anything smaller. It has been mounted on virtually everything the US military operates. When engineers occasionally propose replacing it, the replacement loses.',
    ],
    archetype: 'lmg',
    fire: { ...FIRE_BY_ARCHETYPE.lmg, intervalMs: 130, kick: 0.14, spread: 0.009 },
  },
];

export const PRECISION: WeaponEntry[] = [
  {
    id: 'rem700',
    name: 'REMINGTON 700',
    category: 'precision',
    spec: 'United States · 1962 · .308 Win and others · bolt action',
    body: [
      'The bedrock of American precision shooting. Remington\'s 1962 action enclosed the cartridge head in what marketing called "three rings of steel" — bolt face, chamber, and receiver ring — producing a stiff, concentric action that gunsmiths found ideal to build accurate rifles around.',
      'Both the US Army\'s M24 and the Marine Corps\' M40 sniper rifles are built on the 700 action, and millions of civilian hunting rifles share it. When a police marksman or a custom rifle builder starts a project, this is still the default starting point.',
    ],
    archetype: 'sniper',
    fire: FIRE_BY_ARCHETYPE.sniper,
  },
  {
    id: 'svd',
    name: 'DRAGUNOV SVD',
    category: 'precision',
    spec: 'Soviet Union · 1963 · 7.62×54mmR · short-stroke gas, semi-automatic',
    body: [
      'The SVD invented a category. Where Western doctrine kept bolt-action sniper rifles for specialists, the Soviets issued Yevgeny Dragunov\'s slim semi-automatic to one designated marksman in every platoon — extending accurate fire to 600–800 meters as an organic part of ordinary infantry.',
      'It fires the full-power 7.62×54mmR (a cartridge in service since 1891) through a short-stroke gas system, wearing the PSO-1 scope with its rangefinding reticle. Long, light, and quick to shoulder, it trades match-grade precision for speed and reach — exactly the job it was designed to do.',
    ],
    archetype: 'sniper',
    fire: { ...FIRE_BY_ARCHETYPE.sniper, auto: false, intervalMs: 600, spread: 0.002 },
  },
];
