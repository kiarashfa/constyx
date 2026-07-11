import { CanvasTexture } from 'three';

/**
 * Procedural texture atlas for the station's lettering — the one thing SDF
 * geometry is genuinely bad at. Sampled by the shader on the tile-band signs
 * and the bench plaque.
 *
 * Layout (1024x512, flipY=false so v=0 is the top row):
 *  - rows   0..256 : "MOBIL AVE" enamel sign, cream field, green double
 *                    border, mosaic grout — 4:1, matching the 3.1m x 0.775m
 *                    wall panels.
 *  - rows 280..500 : worn brass bench plaque (film homage) — matches the
 *                    0.28m x 0.066m plate.
 */
export function createStationAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };

  // --- MOBIL AVE sign ---
  ctx.fillStyle = '#ece4cd';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#1d4a37';
  ctx.lineWidth = 12;
  ctx.strokeRect(22, 22, 980, 212);
  ctx.lineWidth = 4;
  ctx.strokeRect(46, 46, 932, 164);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#17221d';
  spaced.letterSpacing = '22px';
  ctx.font = '700 106px Georgia, "Times New Roman", serif';
  ctx.fillText('MOBIL AVE', 512, 134);
  spaced.letterSpacing = '0px';

  // Mosaic grout over the sign band.
  ctx.strokeStyle = 'rgba(96, 88, 70, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= 1024; x += 32) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
  }
  for (let y = 0; y <= 256; y += 32) {
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
  }
  ctx.stroke();

  // --- bench plaque ---
  ctx.fillStyle = '#8a7648';
  ctx.fillRect(0, 280, 1024, 220);
  ctx.strokeStyle = '#5d4d2c';
  ctx.lineWidth = 10;
  ctx.strokeRect(18, 298, 988, 184);
  ctx.fillStyle = '#3a2f1a';
  spaced.letterSpacing = '4px';
  ctx.font = 'italic 600 52px Georgia, "Times New Roman", serif';
  ctx.fillText('IN MEMORY OF THOMAS ANDERSON', 512, 392);
  spaced.letterSpacing = '0px';

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.anisotropy = 4;
  return texture;
}
