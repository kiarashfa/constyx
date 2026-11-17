# Third-party attribution

The project is an unofficial, non-commercial fan tribute; *The Matrix* and
related imagery are © Warner Bros. (see the README disclaimer). Assets below are
CC0 or original implementations of public techniques; nothing requires
attribution legally, but we credit voluntarily.

## Textures (CC0, Poly Haven)

Diffuse maps only, downsized to 512² JPEG.

| File | Source | Used in |
|---|---|---|
| `src/pages/sanctuary/scenes/office/textures/partition_fabric.jpg` | [poly_wool_herringbone](https://polyhaven.com/a/poly_wool_herringbone) | MetaCortex cubicle partitions |
| `src/pages/sanctuary/scenes/office/textures/desk_veneer.jpg` | [oak_veneer_01](https://polyhaven.com/a/oak_veneer_01) | MetaCortex desk laminate |
| `src/pages/sanctuary/scenes/office/textures/office_carpet.jpg` | [dirty_carpet](https://polyhaven.com/a/dirty_carpet) | MetaCortex floor |
| `src/pages/sanctuary/scenes/bridge/textures/wet_asphalt.jpg` | [worn_asphalt](https://polyhaven.com/a/worn_asphalt) | Adams Street roadway |
| `src/pages/sanctuary/scenes/bridge/textures/concrete.jpg` | [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008) | Adams Street viaduct arch |
| `src/pages/sanctuary/scenes/bridge/textures/brick.jpg` | [dark_brick_wall](https://polyhaven.com/a/dark_brick_wall) | Adams Street embankment walls |

## Scene models (CC0 materials, Poly Haven)

Scene geometry is original modelling. The Poly Haven maps below are blended into the baked scene textures at 1K.

| File | Source | Used in |
|---|---|---|
| `src/pages/simulations/scenes/white-room/assets/white-room.glb` | [leather_red_02](https://polyhaven.com/a/leather_red_02), [dark_wood](https://polyhaven.com/a/dark_wood) | White Room armchair leather and timber frame |
| `src/pages/simulations/scenes/armory/assets/armory.glb` | [dark_wood](https://polyhaven.com/a/dark_wood) | Armory weapon stocks, grips and target frame |
| `src/pages/simulations/scenes/dojo/assets/dojo.glb` | [dark_wood](https://polyhaven.com/a/dark_wood) | Dojo timber frame, floor boards, ceiling and furniture |

## Character base mesh (CC0, MakeHuman)

| File | Source | Used in |
|---|---|---|
| `src/pages/simulations/scenes/dojo/assets/opponent.glb` | [MakeHuman](http://www.makehumancommunity.org) base mesh, morph targets and skin weights (hm08, released as CC0) | Dojo sparring partner: head, hands and feet. Clothing, rig reduction and textures are original work. |
| `src/pages/simulations/scenes/rooftop/assets/rooftop.glb` | [MakeHuman](http://www.makehumancommunity.org) base mesh, morph targets and skin weights (hm08, released as CC0) | Rooftop figure on the far roof: head and hands. Clothing, pose and textures are original work. |
| `src/pages/simulations/scenes/bullet-time/assets/figures.glb` | [MakeHuman](http://www.makehumancommunity.org) base mesh, morph targets and skin weights (hm08, released as CC0) | Bullet-time figures (the operator and the agent): bodies, heads and hands. Clothing, hair, rig reduction, poses and textures are original work. |
| `src/pages/simulations/scenes/red-dress/assets/people.glb` | [MakeHuman](http://www.makehumancommunity.org) base mesh, morph targets and skin weights (hm08, released as CC0) | Street crowd figures: bodies, heads and hands. Clothing, hair, rig reduction, walk cycles and textures are original work. |

## Visual references (not shipped)

- "The Matrix – Neo's Office" 3D recreation renders by Adrien Isakovic: staging reference for the MetaCortex scene.
- Film stills from *The Matrix* (1999), © Warner Bros.: prop and staging reference for the White Room (wingback armchairs, console television, wine table).
- Film stills from *The Matrix* (1999), © Warner Bros.: staging reference for the Armory (steel racks, tiers of leaning long guns).
- Film stills from *The Matrix* (1999), © Warner Bros.: staging reference for the Dojo (timber hall, paper screens, tatami, alcove, sparring clothes).
- Film stills from *The Matrix* (1999), © Warner Bros.: staging reference for MetaCortex (window washers) and Adams Street (underpass, 1965 Lincoln Continental). The location is the 1926 Elizabeth Street railway viaduct, Haymarket, Sydney.

## Shader techniques

| Technique | Lineage | Where |
|---|---|---|
| CRT tube treatment (barrel curvature, aperture-grille triads, scanlines, bloom, vignette) | Standard Shadertoy/Lottes-style approach, re-implemented | `office/shader.ts` |
