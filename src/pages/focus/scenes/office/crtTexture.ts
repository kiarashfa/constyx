import { CanvasTexture } from 'three';

/**
 * Texture atlas for Neo's CRT (1024x512, flipY=false):
 *  - rows   0..256 : the day job — a drab beige spreadsheet, 1999-style.
 *  - rows 256..512 : the screensaver — green glyph columns on black; the
 *                    shader scrolls this half vertically for the cascade.
 */
export function createCrtAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // --- spreadsheet half ---
  ctx.fillStyle = '#b8b6a6';
  ctx.fillRect(0, 0, 1024, 256);
  // Menu/tool bars.
  ctx.fillStyle = '#8d8b7c';
  ctx.fillRect(0, 0, 1024, 26);
  ctx.fillStyle = '#a09e8e';
  ctx.fillRect(0, 26, 1024, 22);
  // Column headers + row numbers.
  ctx.fillStyle = '#9a9888';
  ctx.fillRect(0, 48, 1024, 18);
  ctx.fillRect(0, 48, 46, 208);
  // Cell grid.
  ctx.strokeStyle = 'rgba(70, 70, 60, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 46; x <= 1024; x += 88) {
    ctx.moveTo(x, 48);
    ctx.lineTo(x, 256);
  }
  for (let y = 66; y <= 256; y += 17) {
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
  }
  ctx.stroke();
  // Sparse cell data.
  ctx.fillStyle = '#3c3c32';
  ctx.font = '12px "Courier New", monospace';
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      if (rand() < 0.55) {
        ctx.fillText((rand() * 90000).toFixed(2), 52 + c * 88, 79 + r * 17);
      }
    }
  }
  // Selection highlight.
  ctx.strokeStyle = '#2a3a2e';
  ctx.lineWidth = 2;
  ctx.strokeRect(46 + 3 * 88, 66 + 4 * 17, 88, 17);

  // --- glyph-rain half ---
  ctx.fillStyle = '#020604';
  ctx.fillRect(0, 256, 1024, 256);
  const glyphs = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈ0123456789Z:・.=*+-<>';
  ctx.font = '700 15px monospace';
  for (let col = 0; col < 56; col++) {
    const x = 9 + col * 18;
    const len = 6 + Math.floor(rand() * 10);
    const top = Math.floor(rand() * 10);
    for (let row = 0; row < len; row++) {
      const y = 272 + ((top + row) % 15) * 16;
      const head = row === len - 1;
      const g = 120 + Math.floor(rand() * 135);
      ctx.fillStyle = head ? '#d8ffe8' : `rgba(40, ${g}, 90, ${0.35 + 0.6 * (row / len)})`;
      ctx.fillText(glyphs[Math.floor(rand() * glyphs.length)], x, y);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.anisotropy = 4;
  return texture;
}
