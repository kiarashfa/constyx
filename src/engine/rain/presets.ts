import type { RainConfig } from './types';

/** Half-width katakana — the classic Matrix glyph set. */
export const KATAKANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝｧｨｩｪｫｬｭｮｯｰ';
export const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const DIGITS = '0123456789';

export const MATRIX_CHARSET = KATAKANA + LATIN + DIGITS;

/** Canonical Matrix-green rain. Every RainEngine starts from this. */
export const defaultRainConfig: RainConfig = {
  charset: MATRIX_CHARSET,
  color: '#00ff41',
  headColor: '#d7ffe0',
  backgroundColor: '#020604',
  fadeAlpha: 0.09,
  fontSize: 16,
  fontFamily: "'Share Tech Mono', 'MS Gothic', 'Osaka-Mono', monospace",
  speed: 16,
  speedVariance: 0.5,
  density: 0.85,
};

/**
 * Calmer variant for use behind UI (the app shell background): slower,
 * sparser, dimmer, so foreground text stays readable.
 */
export const ambientRainConfig: Partial<RainConfig> = {
  color: '#00c936',
  headColor: '#8affa8',
  speed: 10,
  speedVariance: 0.6,
  density: 0.55,
  fadeAlpha: 0.07,
};
