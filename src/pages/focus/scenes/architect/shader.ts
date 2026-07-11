import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * The Architect's room — Reloaded. Per the film: a chamber walled entirely
 * in monitors, two flush white doors set into the screen wall, one chair.
 * You sit in the chair. The wall is a cylinder of CRTs: each cell hashes to
 * a content kind (surveillance feed with scene cuts, glyph rain, static,
 * standby), with per-screen flicker, scanlines, curved-glass shading and a
 * recessed bezel carved into the wall for real parallax. The floor takes a
 * true second raymarch for its reflection of the wall — this scene's
 * budget goes on glass and light.
 *
 * Click: uSync 0..1 — "concordantly" — every screen snaps to the same feed.
 */
export const ARCHITECT_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uSync; // 0 scattered feeds .. 1 every screen the same

#define MIN_DIST   .002
#define MAX_DIST   30.0
#define MAX_STEPS  80.0
#define REF_STEPS  44.0
#define FL         1.428

#define ID_WALL   1
#define ID_FLOOR  2
#define ID_CEIL   3
#define ID_CHAIR  4
#define ID_DOOR   5
#define ID_COVE   6

#define ROOM_R    5.2
#define ROOM_H    3.8
#define ROW_H     .64
#define ROW0      .3
#define NROWS     5.

float T;

/* ---- monitor grid on the cylinder wall ---- */

// Angular size of one monitor column (must divide 2pi-ish; drift is fine).
#define CELL_A .118

/* Wall-cell coordinates: cell id + centered local uv in meters. */
void wallCell(vec3 p, out vec2 cell, out vec2 luv) {
	float ang = atan(p.z, p.x);
	float col = floor(ang / CELL_A);
	float row = clamp(floor((p.y - ROW0) / ROW_H), 0., NROWS - 1.);
	cell = vec2(col, row);
	luv = vec2((ang - (col + .5) * CELL_A) * ROOM_R, p.y - (ROW0 + (row + .5) * ROW_H));
}

/* Doors: two flush white panels set into the wall, flanking the chair
 * left and right (the film puts Neo between them). */
float doorMask(vec3 p) {
	float ang = abs(atan(p.z, p.x));
	float d = min(ang, 3.14159 - ang); // distance to the +-x axis
	return smoothstep(.14, .11, d) * smoothstep(2.42, 2.36, p.y);
}

/* Screen rect mask inside a cell (bezel border ~4cm, soft bevel edge —
 * the wide falloff keeps the displaced wall SDF's gradient tame). */
float screenMask(vec2 luv) {
	vec2 hs = vec2(CELL_A * ROOM_R * .5 - .045, ROW_H * .5 - .045);
	vec2 q = abs(luv) - hs;
	return smoothstep(.05, -.05, max(q.x, q.y));
}

Hit map(vec3 p) {
	// Monitor bezels: screens recess 6cm into the wall, doors stay flush.
	vec2 cell, luv;
	wallCell(p, cell, luv);
	float inset = .06 * screenMask(luv) * (1. - doorMask(p))
				* step(ROW0 - .32, p.y) * step(p.y, ROW0 + NROWS * ROW_H + .32);
	float wall = length(p.xz) - (ROOM_R + inset);

	// Room cavity + a glowing cove channel recessed into the ceiling rim.
	float air = max(wall, max(p.y - ROOM_H, -p.y));
	float cove = length(vec2(length(p.xz) - (ROOM_R - .38), p.y - ROOM_H)) - .16;
	Hit h = Hit(-min(air, cove) * .55, ID_WALL, p);

	// The chair, dead center: high-back executive, slightly reclined.
	float cb = sdBox(p - vec3(0., .85, -.1), vec3(.55, .95, .65));
	if (cb < .4) {
		vec3 q = p - vec3(0., 0., 0.);
		float seat = sdBox(q - vec3(0., .52, .08), vec3(.28, .06, .3)) - .04;
		vec3 bq = q - vec3(0., 1.15, -.31);
		bq.yz *= rot(-.13);
		float back = sdBox(bq, vec3(.27, .62, .045)) - .045;
		vec3 aq = vec3(abs(q.x) - .34, q.y - .72, q.z - .1);
		float arms = sdBox(aq, vec3(.035, .045, .26)) - .025;
		arms = min(arms, sdBox(vec3(aq.x, q.y - .61, q.z - .32), vec3(.03, .1, .03)));
		float post = sdCyl(q - vec3(0., .25, .05), .25, .05);
		float base = sdCyl(q - vec3(0., .03, .05), .03, .32);
		minH(h, Hit(min(min(seat, back), min(arms, min(post, base))), ID_CHAIR, q));
	} else {
		minH(h, Hit(cb, ID_CHAIR, p));
	}

	return h;
}

/* ---- screen content ---- */

vec3 screenContent(vec2 cell, vec2 suv) {
	// suv in -1..1 across the screen face.
	vec2 seed = mix(cell, vec2(7., 3.), step(.5, uSync));
	vec2 hk = hash22(seed * vec2(.193, .719) + vec2(.37, .191));

	// Scene cuts: feeds re-seed every few seconds, like switching cameras.
	float cutLen = mix(3.5, 9., hk.y);
	float cut = floor(T / cutLen + hk.x * 7.);
	vec2 h2 = hash22(seed * .713 + cut * .311);

	vec3 c;
	if (hk.x < .48) {
		// Surveillance feed: drifting monochrome blobs, blue-grey.
		vec2 uv = suv * mix(1.5, 3.5, h2.x) + vec2(T * .05 * (h2.y - .5), 0.) + h2 * 40.;
		float l = n21(uv) * .75 + n21(uv * 3.1) * .25;
		l = smoothstep(.25, .85, l);
		c = mix(vec3(.02, .04, .05), mix(vec3(.5, .62, .6), vec3(.45, .55, .7), h2.y), l);
	} else if (hk.x < .72) {
		// Glyph rain: fine cascading columns with bright heads.
		float colId = floor(suv.x * 12.);
		vec2 ch = hash22(vec2(colId * .37, seed.x * .71 + seed.y));
		float f = fract(suv.y * -.7 + T * (.12 + ch.x * .2) + ch.y * 9.);
		float glyph = step(.45, n21(vec2(colId * 7., floor(suv.y * 16.) + floor(T * 3.))));
		float trail = pow(smoothstep(1., .05, f), 1.6);
		c = vec3(.07, .34, .15) * glyph * trail * 2.;
		c += vec3(.55, 1., .65) * glyph * smoothstep(.07, .0, f);
	} else if (hk.x < .9) {
		// Static, occasionally rolling.
		float roll = step(.8, h2.x) * fract(T * .6) * 2.;
		float s = n21(vec2(suv.x * 60., fract(suv.y + roll) * 60.) + floor(T * 22.) * 7.1);
		c = vec3(.55, .6, .58) * s;
	} else {
		// Standby: near-black, a patient cursor.
		float blink = step(.5, fract(T * .8 + hk.y));
		float cur = smoothstep(.08, .04, length(suv - vec2(-.6, -.6)));
		c = vec3(.01, .02, .02) + vec3(.2, .8, .4) * cur * blink;
	}

	// Per-screen brightness variance + flicker + scanlines + tube vignette.
	c *= mix(.45, 1.15, hk.y);
	c *= .82 + .25 * n21(vec2(dot(seed, vec2(3.7, 1.3)), floor(T * 11.)));
	c *= .85 + .2 * sin(suv.y * 90.);
	c *= 1. - .55 * pow(length(suv) * .72, 3.);

	return c;
}

/* Wall shading shared by primary + reflection rays. */
vec3 wallColor(vec3 p) {
	vec2 cell, luv;
	wallCell(p, cell, luv);
	float door = doorMask(p);
	float rowBand = step(ROW0 - .32, p.y) * step(p.y, ROW0 + NROWS * ROW_H + .32);
	float scr = screenMask(luv) * (1. - door) * rowBand;

	vec3 bezel = vec3(.07, .072, .075) * (.85 + .3 * n31(p * 12.));
	vec2 hs = vec2(CELL_A * ROOM_R, ROW_H) * .5;
	vec3 c = mix(vec3(.6, .6, .58), bezel, rowBand * (1. - door)); // plaster above/below rows

	if (scr > .001) {
		vec2 suv = luv / (hs - .045);
		c = mix(c, screenContent(cell, suv) * 2.4, scr);
	}
	if (door > .001) {
		// Flush white door panel with a hairline seam.
		vec3 dc = vec3(.78, .78, .76);
		float ang = abs(atan(p.z, p.x));
		float seam = smoothstep(.015, .005, abs(min(ang, 3.14159 - ang) * ROOM_R - .48));
		dc *= 1. - seam * .4;
		c = mix(c, dc, door);
	}
	return c;
}

/* ---- lighting ---- */

vec3 shadePoint(vec3 p, vec3 rd, vec3 n, int id, vec3 uv, float occ) {
	if (id == ID_WALL) {
		// The wall is its own light.
		return wallColor(p);
	}
	if (id == ID_COVE) return vec3(1., 1., .96) * 2.6;

	// Everything else is lit by the monitor ring + the ceiling cove.
	vec3 toWall = normalize(vec3(p.x, 0., p.z) + vec3(.001, 0., 0.));
	float wallFace = clamp(dot(n, toWall) * .5 + .5, 0., 1.);
	vec3 ringGlow = mix(vec3(.34, .4, .4), vec3(.25, .36, .3), uSync * .4) * 2.1;
	vec3 coveDir = normalize(vec3(p.x * .3, ROOM_H - p.y, p.z * .3) + vec3(0., .001, 0.));
	float coveL = clamp(dot(n, coveDir), 0., 1.);

	vec3 c;
	float spec = .2, gloss = 24.;
	if (id == ID_FLOOR) {
		c = vec3(.62, .63, .62) * (.95 + .08 * n21(floor(p.xz * 2.) * 3.7));
		vec2 gf = abs(fract(p.xz * 2.) - .5);
		c *= mix(.85, 1., smoothstep(.0, .04, min(gf.x, gf.y) * .5));
	} else if (id == ID_CEIL) {
		c = vec3(.68, .68, .66);
	} else if (id == ID_CHAIR) {
		c = vec3(.05, .05, .055) * (.85 + .3 * n31(uv * 9.));
		spec = .8;
		gloss = 40.;
	} else {
		c = vec3(.7);
	}

	vec3 hv = normalize(toWall - rd);
	float sp = pow(max(dot(n, hv), 0.), gloss) * spec;

	return c * (ringGlow * wallFace + vec3(.5, .5, .48) * coveL * .8 + vec3(.12)) * occ
		 + ringGlow * sp * occ;
}

/* Cheap per-cell screen glow for reflections (full content would be wasted
 * under the fresnel blur, and doubles the compile). */
vec3 screenGlowCheap(vec3 p) {
	vec2 cell, luv;
	wallCell(p, cell, luv);
	vec2 seed = mix(cell, vec2(7., 3.), step(.5, uSync));
	vec2 hk = hash22(seed * .193 + .37);
	vec3 tint = hk.x < .48 ? vec3(.35, .45, .5) : (hk.x < .72 ? vec3(.1, .5, .2) : vec3(.4));
	float flick = .7 + .5 * n21(vec2(dot(seed, vec2(3.7, 1.3)), floor(T * 11.)));
	return tint * flick * screenMask(luv) * 2. + vec3(.06);
}

/* Secondary march for the floor reflection: wall + chair, emissive-first. */
vec3 marchReflection(vec3 ro, vec3 rd) {
	float d = .02;
	Hit h;
	vec3 p;
	for (float i = 0.; i < REF_STEPS; i++) {
		p = ro + rd * d;
		h = map(p);
		if (abs(h.d) < .004 || d > MAX_DIST) break;
		d += h.d;
	}
	if (d > MAX_DIST) return vec3(.1);
	if (h.id == ID_WALL) return screenGlowCheap(p);
	if (h.id == ID_CHAIR) return vec3(.03);
	if (p.y > ROOM_H - .2) return vec3(.5);
	return vec3(.2);
}

vec3 march(vec3 ro, vec3 rd) {
	float d = .01;
	Hit h;
	vec3 p;
	for (float i = 0.; i < MAX_STEPS; i++) {
		p = ro + rd * d;
		h = map(p);
		if (abs(h.d) < MIN_DIST || d > MAX_DIST) break;
		d += h.d;
	}

	// Resolve which surface of the cavity we struck (thresholds must be
	// looser than the march epsilon / SDF scale, or everything reads WALL).
	int id = h.id;
	if (p.y <= .015) id = ID_FLOOR;
	if (p.y >= ROOM_H - .015) id = ID_CEIL;
	if (length(vec2(length(p.xz) - (ROOM_R - .38), p.y - ROOM_H)) < .19) id = ID_COVE;

	vec3 n = calcN(p, d);
	float occ = calcAO(p, n);
	vec3 c = shadePoint(p, rd, n, id, h.uv, .35 + .65 * occ);

	// Real reflection on the polished floor.
	if (id == ID_FLOOR) {
		vec3 rr = reflect(rd, n);
		vec3 refc = marchReflection(p + vec3(0., .01, 0.), rr);
		float fres = .3 + .6 * pow(1. + dot(rd, n), 2.);
		c = mix(c, refc, clamp(fres, 0., .8) * .65);
	}

	// Cove ring glow (analytic halo around the rim).
	float ringD = abs(length(p.xz) - (ROOM_R - .3)) + abs(p.y - (ROOM_H - .12));
	c += vec3(.5, .52, .5) * .07 / (.3 + ringD * ringD * 2.);

	// The room's clinical air: barely-there cool haze.
	c = mix(c, vec3(.45, .47, .46), (1. - exp(-d * .03)) * .12);

	return c;
}

void main()
{
	T = uTime;

	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	col *= vec3(.97, 1.0, 1.0); // cold, clinical
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
