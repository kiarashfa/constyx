import { CanvasTexture } from 'three';

/**
 * Painted sunrise harbour cityscape for the MetaCortex window (round 17).
 *
 * The old procedural-in-shader city read as flat blocks. Instead we paint a
 * wide panorama once on a canvas -- smooth gradient dawn sky, a low sun glow,
 * three depth-layered building silhouettes (backlit: near-dark to far-hazy),
 * sparse lit windows, a harbour water band with a sun streak, and a horizon
 * haze bank -- and the shader samples it by ray azimuth/elevation as an
 * infinitely-distant backdrop behind the window washers (matches the film's
 * window_washers.png: warm, hazy, backlit).
 *
 * flipY=false so v=0 is the top row; the shader maps elevation -> v with the
 * horizon at HORIZON.
 */
export const CITY_HORIZON = 0.66; // v of the horizon line in the texture

export function createCityTexture(): CanvasTexture {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const horizon = H * CITY_HORIZON;

  let seed = 1337;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // --- bright hazy dawn sky gradient (warm, luminous) ---
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0.0, '#aebccb'); // pale cool-blue high sky
  sky.addColorStop(0.4, '#d8cfc4');
  sky.addColorStop(0.68, '#f4d8ad'); // warming
  sky.addColorStop(0.88, '#ffe9c4'); // bright horizon haze
  sky.addColorStop(1.0, '#fff2da');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // --- low sun glow, just above the horizon toward the right ---
  const sunX = W * 0.63;
  const sunY = horizon - 22;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 720);
  glow.addColorStop(0.0, 'rgba(255,250,232,0.98)');
  glow.addColorStop(0.3, 'rgba(255,238,198,0.6)');
  glow.addColorStop(1.0, 'rgba(255,231,184,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, horizon + 60);
  const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 70);
  disc.addColorStop(0, 'rgba(255,253,246,1)');
  disc.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = disc;
  ctx.fillRect(sunX - 90, sunY - 90, 180, 180);

  // --- building layers: hazy mid-tones (far near-white haze -> near grey-blue),
  //     NOT dark silhouettes; they read as a bright morning skyline. ---
  type Layer = { top: number; jag: number; col: string; win: number; haze: number };
  //     low skyline so bright hazy sky fills the upper window.
  const layers: Layer[] = [
    { top: horizon - 70, jag: 55, col: '#c8ced3', win: 0.015, haze: 0.74 }, // far
    { top: horizon - 120, jag: 95, col: '#9ea8af', win: 0.035, haze: 0.52 }, // mid
    { top: horizon - 185, jag: 150, col: '#727f88', win: 0.06, haze: 0.3 }, // near
  ];
  for (const L of layers) {
    let x = -40;
    while (x < W + 40) {
      const w = 34 + rand() * 96;
      const h = L.jag * (0.25 + rand() * 0.95);
      const bx = x;
      const by = L.top + (L.jag - h);
      // body (silhouette, hazed toward the sky for distance)
      ctx.fillStyle = L.col;
      ctx.globalAlpha = 1 - L.haze * 0.55;
      ctx.fillRect(bx, by, w + 1, horizon - by + 2);
      ctx.globalAlpha = 1;
      // a stepped roof or antenna occasionally
      if (rand() < 0.25) {
        ctx.fillStyle = L.col;
        ctx.globalAlpha = 1 - L.haze * 0.55;
        const cw = w * (0.2 + rand() * 0.3);
        ctx.fillRect(bx + w * 0.3, by - 12 - rand() * 26, cw, 30);
        ctx.globalAlpha = 1;
      }
      // sparse lit windows (warm at dawn) + a few dark ones
      const cols = Math.max(2, Math.floor(w / 12));
      const rows = Math.max(2, Math.floor((horizon - by) / 16));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const wx = bx + 5 + cx * 12;
          const wy = by + 8 + cy * 16;
          if (wx > bx + w - 5 || wy > horizon - 6) continue;
          const r = rand();
          if (r < L.win) {
            ctx.fillStyle = `rgba(255,${210 + Math.floor(rand() * 35)},165,${0.45 + rand() * 0.4})`;
            ctx.fillRect(wx, wy, 5, 7);
          } else if (r < L.win + 0.08) {
            ctx.fillStyle = 'rgba(40,50,60,0.1)';
            ctx.fillRect(wx, wy, 5, 7);
          }
        }
      }
      x += w + rand() * 10;
    }
  }

  // --- harbour water below the horizon: reflected bright sky + sun streak ---
  const water = ctx.createLinearGradient(0, horizon, 0, H);
  water.addColorStop(0.0, '#f0dcb4');
  water.addColorStop(0.16, '#c6b59a');
  water.addColorStop(0.5, '#8f9a94');
  water.addColorStop(1.0, '#5f6f6c');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, W, H - horizon);
  // vertical sun reflection column
  const refl = ctx.createLinearGradient(0, horizon, 0, H);
  refl.addColorStop(0, 'rgba(255,238,196,0.6)');
  refl.addColorStop(1, 'rgba(255,232,190,0)');
  ctx.fillStyle = refl;
  ctx.fillRect(sunX - 120, horizon, 240, H - horizon);
  // horizontal ripple streaks
  for (let i = 0; i < 220; i++) {
    const y = horizon + rand() * (H - horizon);
    const near = (y - horizon) / (H - horizon);
    const len = 30 + rand() * 260 * (0.4 + near);
    const rx = rand() * W;
    ctx.fillStyle = `rgba(${230 - near * 60},${220 - near * 60},${200 - near * 60},${0.04 + rand() * 0.09})`;
    ctx.fillRect(rx, y, len, 1 + near * 2);
  }

  // --- horizon haze bank (fog) over the base of the buildings + waterline ---
  const haze = ctx.createLinearGradient(0, horizon - 120, 0, horizon + 60);
  haze.addColorStop(0, 'rgba(236,214,178,0)');
  haze.addColorStop(0.6, 'rgba(240,220,186,0.55)');
  haze.addColorStop(1, 'rgba(238,218,184,0.15)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 120, W, 180);

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.anisotropy = 4;
  return texture;
}
