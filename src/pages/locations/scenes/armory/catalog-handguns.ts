import { FIRE_BY_ARCHETYPE, type WeaponEntry } from './types';

export const PISTOLS: WeaponEntry[] = [
  {
    id: 'm1911',
    name: 'COLT M1911',
    category: 'pistols',
    spec: 'United States · 1911 · .45 ACP · short-recoil semi-automatic',
    body: [
      'John Browning\'s masterwork and the pistol that defined the twentieth century sidearm. Adopted by the US Army in 1911 after trials that included firing thousands of rounds without a malfunction, it served as the standard American service pistol for an unmatched 74 years, through both World Wars, Korea, and Vietnam.',
      'Its short-recoil, tilting-barrel action — barrel and slide locked together for the first few millimeters of travel before the barrel cams down — remains the dominant operating principle of virtually every service pistol made today. The single-action trigger and grip/thumb safety layout still define the "1911 pattern" produced by dozens of makers.',
    ],
    archetype: 'pistol',
    fire: FIRE_BY_ARCHETYPE.pistol,
  },
  {
    id: 'glock17',
    name: 'GLOCK 17',
    category: 'pistols',
    spec: 'Austria · 1982 · 9×19mm · striker-fired semi-automatic',
    body: [
      'Designed by Gaston Glock — an engineer with no prior firearms experience — for an Austrian army tender, the Glock 17 dragged the service pistol into the polymer age. The frame is injection-molded plastic around steel inserts, cutting weight and cost, and the striker-fired "Safe Action" system replaced external hammers and manual safeties with three passive internal ones.',
      'Early press panic called it an undetectable "plastic gun" (it isn\'t — over 80% of its weight is steel), but police agencies discovered a pistol that was light, consistent, and nearly maintenance-proof. It became the archetype every modern duty pistol now follows; the name reputedly comes from it being Glock\'s seventeenth patent.',
    ],
    archetype: 'pistol',
    fire: FIRE_BY_ARCHETYPE.pistol,
  },
  {
    id: 'beretta92',
    name: 'BERETTA 92FS',
    category: 'pistols',
    spec: 'Italy · 1975 · 9×19mm · DA/SA semi-automatic, open slide',
    body: [
      'The flagship of the world\'s oldest gunmaker (Beretta has been forging barrels since 1526), the 92 series evolved from the M1951 and is instantly recognizable by its open-top slide, which exposes the barrel and all but eliminates ejection stoppages. The locking system uses a falling block borrowed from the Walther P38 rather than Browning\'s tilting barrel.',
      'In 1985 it won the US military trials to replace the M1911 and served as the M9 for three decades. Its silhouette became a fixture of 1980s–90s action cinema, particularly the Hong Kong gunplay tradition that shaped the look of two-pistol choreography.',
    ],
    filmNote: 'Beretta-pattern pistols are all over the film\'s early gunplay — the choreography inherits directly from Hong Kong action cinema.',
    archetype: 'pistol',
    fire: FIRE_BY_ARCHETYPE.pistol,
  },
  {
    id: 'deagle',
    name: 'DESERT EAGLE',
    category: 'pistols',
    spec: 'USA/Israel · 1983 · .357/.44 Magnum, .50 AE · gas-operated semi-automatic',
    body: [
      'Most self-loading pistols manage recoil with the slide alone; magnum revolver cartridges generate far too much force for that. The Desert Eagle — designed by Magnum Research and refined with Israel Military Industries — solves it like a rifle: a gas piston and rotating three-lug bolt, which is why it can chamber .50 Action Express, the most powerful mass-production pistol cartridge.',
      'The price is nearly two kilograms of pistol. It has always been more icon than service weapon — too heavy for duty holsters, but unmatched on screen, where its slab-sided profile reads as authority from across a room.',
    ],
    filmNote: 'The Agents\' sidearm. When an Agent draws on you, it is one of these.',
    archetype: 'pistol',
    fire: { ...FIRE_BY_ARCHETYPE.pistol, intervalMs: 300, kick: 0.14, spread: 0.007 },
  },
  {
    id: 'sw686',
    name: 'S&W MODEL 686',
    category: 'pistols',
    spec: 'United States · 1980 · .357 Magnum · double-action revolver',
    body: [
      'Smith & Wesson\'s L-frame revolver was built to answer a specific problem: officers practicing heavily with full-power .357 Magnum were battering the lighter K-frame guns. The 686\'s beefier frame and full-length underlug soak up magnum recoil while keeping the legendary S&W double-action trigger.',
      'The revolver\'s virtues never changed: no magazine to fail, a manual of arms with almost nothing to remember, and the ability to fire the light .38 Special from the same cylinder. Six rounds, absolute certainty — the design philosophy the self-loader never fully replaced.',
    ],
    archetype: 'revolver',
    fire: FIRE_BY_ARCHETYPE.revolver,
  },
];

export const SMGS: WeaponEntry[] = [
  {
    id: 'mp5',
    name: 'H&K MP5',
    category: 'smgs',
    spec: 'West Germany · 1966 · 9×19mm · roller-delayed blowback',
    body: [
      'Most submachine guns fire from an open bolt — simple, but the lurch of the bolt slamming forward ruins the first shot. Heckler & Koch scaled down the G3 rifle\'s roller-delayed blowback action into a 9mm package that fires from a closed bolt, giving the MP5 rifle-like first-shot accuracy no other SMG of its era could touch.',
      'It became the signature weapon of the counter-terrorist age — cemented in public consciousness when the SAS stormed the Iranian Embassy in London in 1980, MP5s in hand, live on television. For thirty years, if a hostage-rescue team existed, it carried this.',
    ],
    archetype: 'smg',
    fire: FIRE_BY_ARCHETYPE.smg,
  },
  {
    id: 'uzi',
    name: 'UZI',
    category: 'smgs',
    spec: 'Israel · 1954 · 9×19mm · open-bolt blowback, telescoping bolt',
    body: [
      'Designed by Major Uziel Gal for the young Israeli army, the Uzi\'s defining trick is the telescoping bolt — most of the bolt\'s mass wraps *around* the rear of the barrel, and the magazine feeds through the pistol grip. The result is a full 10-inch barrel in a weapon barely longer than a large pistol.',
      'Stamped from sheet steel for fast, cheap production, it armed Israeli forces, dozens of export customers, and — most famously in photographs — the US Secret Service, whose agents produced Uzis from briefcases during the 1981 Reagan assassination attempt.',
    ],
    archetype: 'smg',
    fire: FIRE_BY_ARCHETYPE.smg,
  },
  {
    id: 'thompson',
    name: 'THOMPSON M1928',
    category: 'smgs',
    spec: 'United States · 1921 · .45 ACP · delayed blowback',
    body: [
      'General John T. Thompson wanted a "trench broom" for the Western Front; the war ended before his gun arrived, and the Thompson instead found its first fame in Prohibition-era Chicago, where the drum-fed "Tommy gun" became the mob\'s calling card — and then the G-men\'s answer.',
      'Beautifully machined from solid steel (and priced accordingly — around $200 in 1921, half a car), it was simplified for WWII mass production as the M1 and issued across every theater. Few weapons carry two such different legends at once: gangster icon and GI companion.',
    ],
    archetype: 'smg',
    fire: { ...FIRE_BY_ARCHETYPE.smg, intervalMs: 85, kick: 0.06 },
  },
  {
    id: 'skorpion',
    name: 'ŠKORPION vz. 61',
    category: 'smgs',
    spec: 'Czechoslovakia · 1961 · .32 ACP · blowback machine pistol',
    body: [
      'A true machine pistol: small enough to holster, yet fitted with a folding wire stock and a 20-round magazine. Czechoslovakia issued it to vehicle crews, radio operators, and anyone whose hands were already full — people who needed more than a pistol but had no room for a rifle.',
      'The tiny .32 ACP cartridge is the point, not a compromise: it keeps the featherweight gun controllable in automatic fire, helped by a clever inertia rate-reducer in the grip that slows the cyclic rate to a manageable ~850 rpm.',
    ],
    archetype: 'smg',
    fire: { ...FIRE_BY_ARCHETYPE.smg, intervalMs: 70, spread: 0.013, kick: 0.035 },
  },
  {
    id: 'p90',
    name: 'FN P90',
    category: 'smgs',
    spec: 'Belgium · 1990 · 5.7×28mm · bullpup PDW, top-mounted magazine',
    body: [
      'FN designed the P90 around a question NATO asked in the late 1980s: what should the millions of soldiers who aren\'t riflemen carry, now that pistol-caliber SMGs can\'t defeat body armor? The answer was a new small-caliber, high-velocity cartridge (5.7×28mm) in a radically compact bullpup.',
      'Everything about it is unconventional: a translucent 50-round magazine lying flat along the top of the receiver, rotating cartridges 90° as they feed; fully ambidextrous controls; downward ejection. It looks like science fiction and has been cast as such ever since.',
    ],
    archetype: 'bullpup',
    fire: { ...FIRE_BY_ARCHETYPE.smg, intervalMs: 67, spread: 0.008 },
  },
];
