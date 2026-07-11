/**
 * Audio trigger points for Locations.
 *
 * Round 12: the jack-in is no longer a silent stub — it plays a synthesized
 * rising sweep + glitch ticks + white-out impact from the shared procedural
 * audio engine (src/engine/audio). If a real recording is ever preferred,
 * drop it in assets-userprovided/ and swap the body of playJackInSound()
 * for an <audio> element pointing at the imported file; every call site
 * already goes through this function.
 */
import { sfxJackIn } from '../../engine/audio';

export function playJackInSound(): void {
  sfxJackIn();
}
