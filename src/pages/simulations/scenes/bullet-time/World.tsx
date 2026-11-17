import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  Color,
  LinearFilter,
  MeshBasicMaterial,
  RepeatWrapping,
  ShaderMaterial,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three';
import { getGLTF, getTexture, preloadGLTF, preloadTexture } from '../../engine3d/assets';
import { RendererLook } from '../../engine3d/RendererLook';
import layout from './layout.json';
import sceneUrl from './assets/bullet.glb?url';
import lightmapUrl from './assets/bullet_lm.webp?url';
import skyUrl from './assets/bullet_sky.webp?url';

export const preloadWorld = () =>
  Promise.all([preloadGLTF(sceneUrl), preloadTexture(lightmapUrl), preloadTexture(skyUrl)]);

/** Where the agent stands (three coords); the operator is at the origin facing -z. */
export const AGENT_AT = layout.agent as [number, number, number];
/** Toward the sun (three coords): behind the agent and to his right, about 34 degrees up. */
export const SUN_DIR = layout.sun as [number, number, number];
export const ROTOR_HUB = layout.rotorHub as [number, number, number];

/** Baked daylight on the roof: the lightmap and the lit atlases store radiance / range. */
const LIGHT_RANGE = layout.lightmap.range;
const EXPOSURE = 0.86;
/** The horizon haze (matches the sky panorama's horizon). */
export const HAZE = '#bed2c1';
/** The haze as the graded frame shows it (the sky shader applies the same lift). */
const HAZE_GRADED = '#c3d2b4';
const HAZE_DENSITY = 0.0006;
const HAZE_K = 0.0009;
const HAZE_CHUNK = /* glsl */ `
#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1.0 - exp(-vFogDepth * ${HAZE_K.toFixed(6)}));
#endif
`;
export const FAR = 9000;
/** The film's grade: everything leans a little warm-green (multiplied into every material). */
export const GRADE = new Color(1.02, 1.0, 0.87);

const LIGHTMAPPED = ['Pavers', 'Concrete', 'Render', 'Paint'];
const LIT_ATLAS = ['Props', 'Heli'];

interface WorldParts {
  root: Object3D;
  sky: Texture;
}

function prepareWorld(maxAnisotropy: number): WorldParts | null {
  const gltf = getGLTF(sceneUrl);
  const lightmap = getTexture(lightmapUrl);
  const sky = getTexture(skyUrl);
  if (!gltf || !lightmap || !sky) return null;
  if (gltf.scene.userData.bulletReady) return { root: gltf.scene, sky };
  const mesh = (name: string) => gltf.scene.getObjectByName(name) as Mesh | undefined;

  lightmap.channel = 1;
  lightmap.generateMipmaps = false;
  lightmap.minFilter = LinearFilter;
  lightmap.needsUpdate = true;
  sky.wrapS = RepeatWrapping;
  sky.generateMipmaps = false;
  sky.minFilter = LinearFilter;
  sky.needsUpdate = true;

  for (const name of LIGHTMAPPED) {
    const m = mesh(name)?.material as MeshStandardMaterial | undefined;
    if (!m) continue;
    m.lightMap = lightmap;
    m.lightMapIntensity = LIGHT_RANGE * Math.PI;
    m.envMapIntensity = 0;
    m.color.multiply(GRADE);
    if (m.map) m.map.anisotropy = maxAnisotropy;
    m.needsUpdate = true;
  }
  // Props and the helicopter carry their own baked daylight: the atlas goes out as emission.
  for (const name of LIT_ATLAS) {
    const m = mesh(name)?.material as MeshStandardMaterial | undefined;
    if (!m) continue;
    m.emissiveMap = m.map;
    m.emissive = GRADE.clone();
    m.emissiveIntensity = LIGHT_RANGE;
    m.map = null;
    m.color = new Color(0, 0, 0);
    m.envMapIntensity = 0;
    m.needsUpdate = true;
  }
  // The city is a painted backdrop: texture x baked shade, dissolved by the haze.
  gltf.scene.traverse((node) => {
    const m = node as Mesh;
    if (!m.isMesh || LIGHTMAPPED.includes(m.name) || LIT_ATLAS.includes(m.name)) return;
    const baked = m.material as MeshStandardMaterial;
    if (baked.map) baked.map.anisotropy = m.name === 'Ground' ? 1 : maxAnisotropy;
    const flat = new MeshBasicMaterial({ map: baked.map, color: GRADE, vertexColors: true, toneMapped: false });
    flat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', HAZE_CHUNK);
    };
    flat.customProgramCacheKey = () => 'bullet-haze';
    m.material = flat;
    m.frustumCulled = false;
  });
  gltf.scene.userData.bulletReady = true;
  return { root: gltf.scene, sky };
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    // The panorama's centre column looks toward the agent (-Z); east (+X) is to its right.
    float u = atan(d.x, -d.z) / 6.2831853 + 0.5;
    float v = 0.5 - asin(clamp(d.y, -1.0, 1.0)) / 3.1415927;
    gl_FragColor = texture2D(map, vec2(u, v)) * vec4(1.03, 1.0, 0.92, 1.0);
    #include <colorspace_fragment>
  }
`;

/** The hazy sky with the sun bloom: a panorama on a dome that travels with the camera. */
function Sky({ map }: { map: Texture }) {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { map: { value: map } },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [map],
  );
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[50, 32, 16]} />
    </mesh>
  );
}

/** The helipad roof, the glass tower behind the agent and the city to the horizon. */
export function BulletWorld() {
  const gl = useThree((state) => state.gl);
  const world = useMemo(() => prepareWorld(gl.capabilities.getMaxAnisotropy()), [gl]);
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.far = FAR;
    camera.updateProjectionMatrix();
  }, [camera]);
  return (
    <>
      <RendererLook exposure={EXPOSURE} />
      <color attach="background" args={[HAZE_GRADED]} />
      <fogExp2 attach="fog" args={[HAZE_GRADED, HAZE_DENSITY]} />
      {world && (
        <>
          <Sky map={world.sky} />
          <primitive object={world.root} />
        </>
      )}
    </>
  );
}
