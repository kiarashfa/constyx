/**
 * Mobil Ave — raymarched SDF scene, written for this project on the same
 * technical foundation as the Pod Bay adaptation (distance-field map ->
 * sphere-traced march -> per-material shading + glow accumulators).
 *
 * Visual research: the film shot Mobil Ave on the disused platforms of
 * St James station, Sydney — a 1926 London-Underground-style station:
 * cream ceramic tiles with green trim bands, a single vaulted platform
 * tunnel, dark tile-band lettering, and the Trainman's graffiti-covered
 * silver double-decker that "narrowly fit" the bore. The scene recreates
 * that staging: a tiled barrel vault over one platform and one track,
 * MOBIL AVE enamel signs, a wooden bench (the viewing position), pendant
 * fluorescent strips, looping tunnel portals at both ends, and a periodic
 * through-running train driven by uniforms from the React side.
 *
 * Coordinates: x across the hall (+x = bench side), y up (platform floor
 * y=0), z along the track. Vault radius 3.7 centered (0, 0.9); track center
 * x=-2.45 with rail tops at y=-0.85.
 */
export const MOBIL_AVE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform mat3 uCamBasis;
uniform vec3 uCamPos;
uniform float uNight;    // 0 full service .. 1 night service (half the tubes rest)
uniform float uTrainOn;  // 1 while a train pass is active
uniform float uTrainZ;   // train center, world z
uniform float uTrainDir; // +1 travelling toward +z, -1 toward -z
uniform sampler2D uSign;

#define MIN_DIST   .002
#define MAX_DIST   90.0
#define MAX_STEPS  90.0
#define FL         1.428
#define HALL_Z     16.0
#define FIX_STEP   4.5

vec2 g = vec2(0); // Glow: x headlight beam, y tunnel signal lamps.

struct Hit {
	float d; // SDF distance.
	int id;  // Material ID.
	vec3 uv; // Material-local position.
};

#define HASH  p = fract(p * .1031); p *= p + 3.3456; return fract(p * (p + p));

vec2 hash22(vec2 p) { HASH }
vec4 hash44(vec4 p) { HASH }

float n31(vec3 p) {
	const vec3 s = vec3(7, 157, 113);
	vec3 ip = floor(p);
	p = fract(p);
	p = p * p * (3. - 2. * p);

	vec4 h = vec4(0, s.yz, s.y + s.z) + dot(ip, s);
	h = mix(hash44(h), hash44(h + s.x), p.x);

	h.xy = mix(h.xz, h.yw, p.y);
	return mix(h.x, h.y, p.z);
}

float n21(vec2 p) { return n31(vec3(p, 1)); }

void minH(inout Hit a, Hit b) {
	if (b.d < a.d) a = b;
}

float sdBox(vec3 p, vec3 b) {
	vec3 q = abs(p) - b;
	return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.);
}

/* ---------------- the train ---------------- */

float trainDetail(vec3 tp) {
	// Three cars on 19.8m centers; clamped repetition.
	float carZ = tp.z - 19.8 * clamp(floor(tp.z / 19.8 + .5), -1., 1.);
	vec3 cq = vec3(tp.x, tp.y, carZ);

	// Double-deck body with tapered roof shoulders.
	cq.x /= 1. - .16 * smoothstep(3.3, 4.24, cq.y);
	float body = (sdBox(cq - vec3(0., 2.72, 0.), vec3(1.22, 1.40, 9.4)) - .12) * .82;

	// Inter-car gangway spine + continuous underframe.
	float gang = sdBox(tp - vec3(0., 2.6, 0.), vec3(1.0, 1.5, 29.55)) - .05;
	float under = sdBox(tp - vec3(0., .75, 0.), vec3(1.05, .5, 29.3));

	return min(body, min(gang, under));
}

/* ---------------- the station ---------------- */

Hit map(vec3 p) {
	// Station air = vaulted hall + tunnel bore + track trench, carved from
	// solid. Each term is a cavity SDF (negative inside); the union of air
	// negated gives the wall distance the marcher wants.
	vec2 vq = p.xy - vec2(0., .9);
	float vault = max(max(length(vq) - 3.7, abs(p.z) - HALL_Z), -p.y);
	vec2 tq = vec2((p.x + 2.45) / 1.9, (p.y - 1.2) / 2.4);
	float tube = max((length(tq) - 1.) * 1.9, -(p.y + 1.05));
	float trench = sdBox(p - vec3(-2.45, -.55, 0.), vec3(1.45, .56, 66.));
	Hit h = Hit(-min(vault, min(tube, trench)), 1, p);

	// Rails (mirrored pair about the track center).
	vec3 rp = vec3(abs(p.x + 2.45) - .7175, p.y + .98, p.z);
	minH(h, Hit(sdBox(rp, vec3(.045, .13, 66.)), 3, p));

	// Bench against the near wall at z=0 — the viewing position.
	vec3 bp = p - vec3(3.24, 0., 0.);
	float bb = sdBox(bp - vec3(0., .6, 0.), vec3(.6, .7, 1.4));
	if (bb < .5) {
		float seat = sdBox(bp - vec3(0., .44, 0.), vec3(.26, .028, 1.05)) - .012;
		float back = sdBox(bp - vec3(.26, .86, 0.), vec3(.028, .24, 1.05)) - .012;
		vec3 lp = vec3(bp.x, bp.y, abs(bp.z) - .82);
		float legs = sdBox(lp - vec3(0., .22, 0.), vec3(.21, .22, .035));
		minH(h, Hit(min(seat, min(back, legs)), 2, p));
		// Small dedication plate on the backrest.
		minH(h, Hit(sdBox(bp - vec3(.225, .95, -.5), vec3(.014, .033, .14)), 7, p));
	} else {
		minH(h, Hit(bb, 2, p)); // conservative bound
	}

	// Pendant fluorescent strips over the platform, every 4.5m.
	float cell = clamp(floor(p.z / FIX_STEP + .5), -3., 3.);
	vec3 fp = vec3(p.x - 1.1, p.y, p.z - cell * FIX_STEP);
	float housing = sdBox(fp - vec3(0., 3.16, 0.), vec3(.10, .04, .64));
	float rod = sdBox(fp - vec3(0., 3.8, 0.), vec3(.014, .62, .014));
	minH(h, Hit(min(housing, rod), 3, p));
	vec3 tubep = fp - vec3(0., 3.08, 0.);
	tubep.z -= clamp(tubep.z, -.58, .58);
	minH(h, Hit(length(tubep) - .03, 4, vec3(cell, 0., 0.)));

	// Signal lamps deep in each bore (green; red while the train runs).
	vec3 sp = vec3(p.x + 3.55, p.y - 1.45, abs(p.z) - 40.);
	float sig = length(sp) - .07;
	g.y += .0006 / (.05 + sig * sig);
	minH(h, Hit(sig, 6, p));

	// The train (uniform-gated so the idle scene never pays for it).
	if (uTrainOn > .5) {
		vec3 tp = vec3(p.x + 2.45, p.y + .85, p.z - uTrainZ);
		float bound = sdBox(tp - vec3(0., 2.25, 0.), vec3(1.6, 2.2, 29.9));
		minH(h, Hit(bound > .6 ? bound : trainDetail(tp), 5, tp));

		// Volumetric-ish headlight beam.
		vec3 q = tp - vec3(0., 2.4, uTrainDir * 29.7);
		float along = clamp(q.z * uTrainDir, 0., 26.);
		q.z -= uTrainDir * along;
		float dseg = length(q);
		g.x += (1. - along * .033) * .004 / (.03 + dseg * dseg * .5);
	}

	return h;
}

vec3 calcN(vec3 p, float t) {
	float h = min(t * .3, .5);
	vec3 n = vec3(0);
	for (int i = 0; i < 4; i++) {
		vec3 e = .005773 * (2. * vec3((((i + 3) >> 1) & 1), (i >> 1) & 1, i & 1) - 1.);
		n += e * map(p + e * h).d;
	}

	return normalize(n);
}

float calcAO(vec3 p, vec3 n) {
	float occ = 0., sca = 1.;
	for (int i = 0; i < 5; i++) {
		float h = .02 + .11 * float(i);
		occ += (h - map(p + n * h).d) * sca;
		sca *= .75;
	}

	return clamp(1. - 1.7 * occ, 0., 1.);
}

/* ---------------- lighting ---------------- */

float fixtureOn(float k) {
	// Night service rests every other tube.
	float on = 1. - uNight * step(.5, mod(k + 100., 2.));
	// One tired ballast, worse at night.
	if (k == 2.) on *= 1. - (.06 + .12 * uNight) * step(.72, n21(vec2(floor(uTime * 13.), k)));
	return on;
}

vec3 stationLight(vec3 p, vec3 n, vec3 rd, float spec, float gloss) {
	vec3 acc = vec3(0);
	vec3 fixCol = vec3(1., .96, .84) * 2.1 * mix(1., .82, uNight);
	float k0 = clamp(floor(p.z / FIX_STEP + .5), -3., 3.);
	float k1 = clamp(k0 + sign(p.z - k0 * FIX_STEP + .001), -3., 3.);

	for (int j = 0; j < 2; j++) {
		float k = j == 0 ? k0 : k1;
		if (j == 1 && k == k0) break;
		vec3 ld = vec3(1.1, 3.02, k * FIX_STEP) - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		float att = fixtureOn(k) / (1. + d2 * .16);
		float dif = clamp(.12 + .88 * dot(n, ld), 0., 1.);
		float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;
		acc += (dif + sp) * att * fixCol;
	}

	// The passing train carries its own light: window spill + headlight splash.
	if (uTrainOn > .5) {
		float wz = uTrainZ + clamp(p.z - uTrainZ, -28., 28.);
		vec3 ld = vec3(-1.05, 1.9, wz) - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		acc += vec3(1., .78, .5) * clamp(dot(n, ld), 0., 1.) * 1.1 / (1. + d2 * .3);

		ld = vec3(-2.45, .7, uTrainZ + uTrainDir * 30.5) - p;
		d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		acc += vec3(1., .95, .8) * clamp(dot(n, ld), 0., 1.) * 2.2 / (1. + d2 * .05);
	}

	return acc;
}

/* ---------------- materials ---------------- */

vec3 masonry(vec3 p, inout vec3 n, inout float spec, inout float gloss) {
	bool inHall = abs(p.z) < HALL_Z + .01;
	vec3 c;

	if (p.y < -.3) {
		// Track bed: ballast + sleepers.
		c = vec3(.13, .125, .115) * (.75 + .5 * n31(p * 9.));
		if (abs(p.x + 2.45) < 1.25 && fract(p.z / .62) < .38) c = vec3(.16, .12, .09);
		spec = .05;
		gloss = 8.;
	} else if (p.y < .12 && n.y > .4 && p.x > -1.06 && inHall) {
		// Platform: terrazzo slabs, coping stones along the edge.
		vec2 tid = floor(p.xz / .6);
		c = vec3(.55, .53, .47) * (.9 + .2 * n21(tid * 7.3));
		c *= .94 + .06 * n31(p * 23.);
		if (p.x < -.62) c = vec3(.66, .62, .5) * (.92 + .12 * n21(tid * 3.1));
		vec2 e = abs(fract(p.xz / .6) - .5);
		c *= mix(1., .78, smoothstep(.46, .5, max(e.x, e.y)));
		spec = .5;
		gloss = 26.;
	} else if (inHall) {
		// The tiled vault. Parametrize by arc length so tiles stay square.
		vec2 vq = p.xy - vec2(0., .9);
		float ang = atan(vq.x, vq.y);
		vec2 tuv = vec2(p.z, 3.7 * ang);
		if (abs(n.z) > .7) tuv = vec2(p.x, p.y); // end walls

		if (p.y > 2.9 && abs(n.z) < .7) {
			// Painted plaster above the cornice line.
			c = vec3(.60, .58, .51) * (.92 + .12 * n31(p * 3.));
			spec = .15;
			gloss = 12.;
		} else {
			vec2 tid = floor(tuv / vec2(.15, .075));
			vec2 tfr = fract(tuv / vec2(.15, .075));
			float grout = smoothstep(.0, .08, tfr.x) * smoothstep(1., .92, tfr.x)
						* smoothstep(.0, .16, tfr.y) * smoothstep(1., .84, tfr.y);

			// Cream field, green trim bands, dark skirting.
			c = vec3(.72, .69, .60);
			if ((p.y > .92 && p.y < 1.14) || (p.y > 2.56 && p.y < 2.72)) c = vec3(.14, .32, .22);
			if (p.y < .25) c = vec3(.35, .33, .30);

			// Green surround at the portal mouths.
			vec2 tq = vec2((p.x + 2.45) / 1.9, (p.y - 1.2) / 2.4);
			if (abs(n.z) > .7 && length(tq) < 1.14) c = vec3(.14, .32, .22);

			// Per-tile glaze variance: tint + a tiny normal tilt so the
			// fixtures glint unevenly along the wall.
			float tv = n21(tid + (abs(n.z) > .7 ? 50. : 0.));
			c *= .96 + .08 * tv;
			n = normalize(n + .025 * (vec3(n21(tid + 13.1), n21(tid + 27.7), n21(tid + 41.3)) - .5));
			c *= mix(.80, 1., grout);
			spec = .9 * grout;
			gloss = 60.;

			// Station name signs let into the tile band.
			float sgz = 1e5;
			if (p.x < -3.) sgz = p.z - 9. * clamp(floor(p.z / 9. + .5), -1., 1.);
			else if (p.x > 3.) sgz = abs(p.z) - 7.;
			if (abs(sgz) < 1.55 && p.y > 1.55 && p.y < 2.325 && abs(n.z) < .7) {
				// Reading direction flips with the wall you face: from the
				// bench, screen-right on the far wall is -z.
				float su = p.x < 0. ? (1.55 - sgz) / 3.1 : (sgz + 1.55) / 3.1;
				vec2 suv = vec2(su, (p.y - 1.55) / .775);
				c = texture2D(uSign, vec2(suv.x, (1. - suv.y) * .5)).rgb * .9;
				spec = .6;
				gloss = 40.;
			}
		}

		// Vertical grime streaks age the whole hall gently.
		c *= .92 + .08 * n31(p * vec3(.5, 3., .5));
	} else {
		// Tunnel lining: ringed concrete, grime.
		c = vec3(.23, .225, .21) * (.7 + .6 * n31(p * vec3(1.4, 1.4, .5)));
		if (abs(fract(p.z / 2.2) - .5) > .44) c *= 1.25;
		spec = .15;
		gloss = 12.;
	}

	return c;
}

vec3 trainSkin(vec3 tp, inout vec3 n, inout float spec, inout float gloss,
			   out float emiss, out vec3 emissCol) {
	float carZ = tp.z - 19.8 * clamp(floor(tp.z / 19.8 + .5), -1., 1.);
	float carId = floor(tp.z / 19.8 + .5);
	vec3 c = vec3(.30, .31, .33); // stainless steel
	emiss = 0.;
	emissCol = vec3(0);
	spec = 1.1;
	gloss = 30.;

	float side = smoothstep(.5, .8, abs(n.x));

	// Corrugated flanks.
	n = normalize(n + vec3(0., .16 * sin(tp.y * 34.), 0.) * side);

	if (abs(n.z) > .8 && abs(tp.z) > 28.) {
		// Cab faces: headlights lead, tail lamps trail.
		c = vec3(.16, .17, .18);
		bool leading = sign(tp.z) == sign(uTrainDir);
		float lamp = length(vec2(abs(tp.x) - .55, tp.y - 1.55));
		float board = step(abs(tp.x), .5) * step(3.5, tp.y) * step(tp.y, 3.75);
		if (leading) {
			emiss = smoothstep(.17, .12, lamp) * 4. + board * 1.4;
			emissCol = vec3(1., .95, .85);
		} else {
			emiss = smoothstep(.11, .07, lamp) * 2.2;
			emissCol = vec3(1., .1, .06);
		}
	} else if (n.y > .7) {
		// Roof grime.
		c = vec3(.20, .20, .21) * (.8 + .4 * n31(tp * 3.));
	} else {
		// Double-deck window bands, warm-lit inside.
		if (abs(carZ) < 8.9) {
			float wz = fract(carZ / 1.9);
			float pillar = smoothstep(.06, .16, wz) * smoothstep(.94, .84, wz);
			float band = (smoothstep(1.72, 1.82, tp.y) - smoothstep(2.42, 2.52, tp.y))
					   + (smoothstep(3.22, 3.32, tp.y) - smoothstep(3.92, 4.02, tp.y));
			float win = clamp(band, 0., 1.) * pillar * side;
			emiss = win * 1.35;
			emissCol = vec3(1., .82, .55);
		} else if (abs(carZ) < 9.4) {
			c *= .8; // door recesses
		}

		// Graffiti wraps the lower body.
		float gm = smoothstep(.45, .75, n31(vec3(carZ * .33, tp.y * .55, tp.x) + carId * 7.3))
				 * smoothstep(2.9, 2.2, tp.y) * smoothstep(.9, 1.3, tp.y) * side;
		float hue = n31(vec3(carZ * .1, 1.7, tp.y * .2) + carId * 3.1);
		vec3 gcol = mix(vec3(.55, .12, .18), vec3(.12, .35, .5), step(.45, hue));
		gcol = mix(gcol, vec3(.6, .5, .12), step(.75, hue));
		c = mix(c, gcol, gm * .85 * (1. - emiss));
	}

	return c;
}

/* ---------------- shading ---------------- */

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	// Emissives shortcut the lighting model entirely.
	if (h.id == 4)
		return vec3(1., .97, .88) * 2.6 * fixtureOn(h.uv.x) + vec3(.06);
	if (h.id == 6)
		return uTrainOn > .5 ? vec3(1., .12, .06) * 3. : vec3(.15, 1., .3) * 2.2;

	vec3 n = calcN(p, d);
	float spec = .3, gloss = 24., emiss = 0.;
	vec3 emissCol = vec3(0);
	vec3 c;

	if (h.id == 1) {
		c = masonry(p, n, spec, gloss);
	} else if (h.id == 2) {
		// Bench: worn hardwood, grain running along the slats.
		c = vec3(.34, .22, .12) * (.8 + .4 * n31(vec3(p.x * 2., p.y * 2., p.z * 18.)));
		spec = .25;
		gloss = 16.;
	} else if (h.id == 3) {
		// Dark ironwork; the rail heads gleam.
		c = vec3(.09, .09, .095);
		if (p.y < 0. && p.y > -.92) {
			c = vec3(.22);
			spec = 2.5;
			gloss = 90.;
		}
	} else if (h.id == 5) {
		c = trainSkin(h.uv, n, spec, gloss, emiss, emissCol);
	} else {
		// Brass plaque.
		vec2 puv = vec2(clamp((p.z + .64) / .28, 0., 1.), clamp((p.y - .917) / .066, 0., 1.));
		c = texture2D(uSign, vec2(puv.x, .547 + (1. - puv.y) * .43)).rgb * .9;
		spec = 1.2;
		gloss = 50.;
	}

	float occ = calcAO(p, n);
	vec3 amb = vec3(.16, .165, .15) * (1. - .45 * uNight);
	vec3 col = c * (amb * occ + stationLight(p, n, rd, spec, gloss) * (.45 + .55 * occ));
	col += emissCol * emiss;

	return col;
}

vec3 march(vec3 ro, vec3 rd) {
	vec3 p;
	float d = .01;
	Hit h;
	for (float i = 0.; i < MAX_STEPS; i++) {
		p = ro + rd * d;
		h = map(p);

		if (abs(h.d) < MIN_DIST || d > MAX_DIST)
			break;

		d += h.d;
	}

	// Stash glow before normal/AO calls keep accumulating into it.
	vec2 gg = g;

	vec3 c = d < MAX_DIST ? shade(p, rd, d, h) : vec3(0);

	// Haze toward the dark of the bores.
	c = mix(c, vec3(.004, .005, .0045), 1. - exp(-d * .022));

	c += gg.x * vec3(1., .93, .78); // headlight beam
	c += gg.y * (uTrainOn > .5 ? vec3(1., .12, .06) : vec3(.15, 1., .3)) * .5; // signals

	return c;
}

vec3 vignette(vec3 c, vec2 fc) {
	vec2 q = fc.xy / uRes.xy;
	c *= .5 + .5 * pow(16. * q.x * q.y * (1. - q.x) * (1. - q.y), .4);
	return c;
}

void main()
{
	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	col *= vec3(1.04, 1.01, .94); // warm cream grade — Mobil Ave sits outside the Matrix green
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
