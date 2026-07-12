# Third-party asset attribution

Running record of real, permissively-licensed assets/textures/techniques used
in the project, for the future in-app credits page. Everything here is CC0 /
MIT / public-domain or an original re-implementation of a public technique;
nothing requires attribution *legally*, but we credit voluntarily.

The project itself remains an unofficial, non-commercial fan tribute; *The
Matrix* and related imagery are © Warner Bros. (see README disclaimer).

## Textures

| Asset (in repo) | Source | Author | License | Used in |
|---|---|---|---|---|
| `src/pages/focus/scenes/office/textures/partition_fabric.jpg` | Poly Haven — [poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) | Poly Haven | CC0 | MetaCortex cubicle partition panels (diffuse; downsized to 512², warm cast graded out) |
| `src/pages/focus/scenes/office/textures/desk_veneer.jpg` | Poly Haven — [oak_veneer_01](https://polyhaven.com/a/oak_veneer_01) | Poly Haven | CC0 | MetaCortex desk laminate (diffuse; 512², desaturated + cooled) |
| `src/pages/focus/scenes/office/textures/office_carpet.jpg` | Poly Haven — [dirty_carpet](https://polyhaven.com/a/dirty_carpet) | Poly Haven | CC0 | MetaCortex floor carpet (diffuse; 512²) |
| `src/pages/focus/scenes/bridge/textures/wet_asphalt.jpg` | Poly Haven — [worn_asphalt](https://polyhaven.com/a/worn_asphalt) | Poly Haven | CC0 | Adams Street wet roadway (diffuse; 512², desaturated + cooled in shader) |
| `src/pages/focus/scenes/bridge/textures/concrete.jpg` | Poly Haven — [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008) | Poly Haven | CC0 | Adams Street viaduct arch soffit — board-formed concrete with tie-holes (diffuse; 512²) |
| `src/pages/focus/scenes/bridge/textures/brick.jpg` | Poly Haven — [dark_brick_wall](https://polyhaven.com/a/dark_brick_wall) | Poly Haven | CC0 | Adams Street abutment / embankment walls (diffuse; 512²) |

Only the diffuse/albedo map of each was used (Poly Haven also ships
normal/rough/AO/displacement under the same CC0 grant if we ever want them).
Downsized 1K→512 JPEG q82 to keep the lazy Focus chunk lean.

## Visual references (not shipped assets — reference only)

| Reference | Author | Used for |
|---|---|---|
| "The Matrix — Neo's Office" 3D recreation renders (`assets-userprovided/office/*`) | Adrien Isakovic | Primary staging reference for the round-16 MetaCortex re-composition: cubicle layout, L-desk + wood edge, overhead cabinet + valance, filing cabinet + CITY PHONE books, beige CRT/keyboard/mouse/phone, chair, teal grade. Owner-provided; lives outside the repo. |
| The Matrix (1999) window-washer shot (`window_washers.png`) | © Warner Bros. (film still, reference only) | Staging the backlit washers, heavy soap arcs, and hazy backlit city. |
| The Matrix (1999) Adams Street pickup stills + gif (`assets-userprovided/bridge/*`) | © Warner Bros. (film stills, reference only) | Staging the Adams Street underpass rebuild: the curved elliptical arch vault, the water curtain at the far mouth, wet-road reflections, camera looking down the roadway. Location confirmed as the 1926 Elizabeth Street railway viaduct ("Adam Street Bridge"), Haymarket, Sydney — a wide elliptical concrete arch. |
| 1965 Lincoln Continental film still (`assets-userprovided/bridge/1965 lincoln continental.webp`) | © Warner Bros. (film still, reference only) | Modelling the pickup car's SDF form: slab-sided body, formal squared greenhouse, stacked vertical taillights, chrome bumpers, whitewalls. |

## Shader techniques

| Technique | Lineage | Where |
|---|---|---|
| CRT tube treatment (barrel curvature + aperture-grille RGB triads + scanlines + phosphor bloom + tube vignette) | Standard Shadertoy/Lottes-style CRT approach, re-implemented from scratch | `office/shader.ts` `shade()` `ID_SCREEN` |

## Notes / wanted-but-not-obtained

- Poly Haven's texture library skews toward garment fabrics and outdoor
  materials; there is no dedicated *cubicle-panel* fabric or *commercial loop*
  carpet. `poly_wool_herringbone` (a grey office-weight herringbone) and
  `dirty_carpet` (a worn dark loop pile) are the closest CC0 matches and grade
  well to the film's palette. If a better commercial-office carpet/panel fabric
  is wanted, **ambientCG** has dedicated ones (e.g. `Carpet013`, `Fabric063`) —
  but its downloads are ZIP bundles rather than direct image files. If you want
  those, download the 1K JPG zip from ambientcg.com, extract the `_Color` map,
  drop it in `src/pages/focus/scenes/office/textures/`, and point the matching
  `slot()` in `textures.ts` at it. No account is required for either site.
