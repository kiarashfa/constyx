import { CanvasTexture } from 'three';

/**
 * "ADAMS ST" street-name blade (512x128, flipY=false) — the address
 * Morpheus gives Neo for the pickup. Late-90s US blade: green field,
 * white border, white uppercase lettering.
 */
export function createSignAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1d4a30';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#cfd8cc';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 108);

  ctx.fillStyle = '#e8efe6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  spaced.letterSpacing = '10px';
  ctx.font = '700 64px "Arial Narrow", Arial, sans-serif';
  ctx.fillText('ADAMS ST', 256, 68);
  spaced.letterSpacing = '0px';

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.anisotropy = 4;
  return texture;
}
