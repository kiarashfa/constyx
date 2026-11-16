/**
 * Audio trigger points for Simulations.
 *
 * The jack-in plays a synthesized rising sweep + glitch ticks + white-out
 * impact from the shared procedural audio engine (src/engine/audio). To use a
 * recording instead, swap the body of playJackInSound(); every call site goes
 * through this function.
 */
import { sfxJackIn } from '../../engine/audio';

export function playJackInSound(): void {
  sfxJackIn();
}
