import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * Adams Street bridge — the rain-soaked night pickup from the first film.
 * Staged from the on-screen sequence, not any present-day location: you
 * stand on the sidewalk under a riveted steel girder bridge at night; rain
 * hammers the street beyond and pours off the deck edge in a sheet (the
 * film's own detail); wet asphalt throws back the streetlights; every so
 * often a dark late-60s sedan rolls through with its headlights cutting
 * cones through the rain. Cold green-cyan night with one warm sodium lamp
 * far off. Click to lean the weather from steady rain into a downpour.
 *
 * Layout: street runs along x (cars pass left<->right); viewer on the near
 * sidewalk under the deck (deck covers |x|<4.5); buildings across, z 12+.
 */
export const BRIDGE_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uStorm;    // 0 steady rain .. 1 downpour
uniform float uCarOn;
uniform float uCarX;     // car center, world x
uniform float uCarDir;   // +1 travelling +x, -1 -x
uniform sampler2D uSign;

#define MIN_DIST   .002
#define MAX_DIST   70.0
#define MAX_STEPS  90.0
#define FL         1.428

#define ID_GROUND  1
#define ID_BRICK   2
#define ID_STEEL   3
#define ID_METAL   4
#define ID_SIGN    5
#define ID_LAMP    6
#define ID_BLDG    7
#define ID_CAR     8

float T;
vec3 g = vec3(0); // x: cool lamp/headlight halos, y: warm sodium halo, z: drips

/* Under the deck? (no direct rain there) */
float sheltered(vec3 p) {
	return step(abs(p.x), 4.4) * step(p.y, 4.4);
}

/* ---------------- the car ---------------- */

float sdCar(vec3 tp) {
	// tp: car-local, x along the body, y from road, z across.
	float body = sdBox(tp - vec3(0., .62, 0.), vec3(2.35, .26, .88)) - .06;
	float cabin = sdBox(tp - vec3(-.35, 1.04, 0.), vec3(1.05, .22, .76)) - .08;
	float d = min(body, cabin);
	vec3 wq = vec3(abs(tp.x) - 1.62, tp.y - .36, abs(tp.z) - .8);
	// Wheel cylinders lie across the car: swizzle so sdCyl's y-axis is car-z.
	float wheels = sdCyl(wq.xzy, .12, .34);
	return min(d, wheels);
}

/* ---------------- the scene ---------------- */

Hit map(vec3 p) {
	// Ground: street + raised sidewalks (near curb at z=1.2, far at z=8.6).
	float side = max(sdBox(p - vec3(0., .06, -1.), vec3(60., .07, 2.2)),
					 -sdBox(p - vec3(0., .5, 5.), vec3(60., 1., 3.8)));
	side = min(side, sdBox(p - vec3(0., .06, 9.6), vec3(60., .07, 1.4)));
	Hit h = Hit(min(p.y, side), ID_GROUND, p);

	// Bridge deck + edge plates.
	float deck = sdBox(p - vec3(0., 5.1, 2.), vec3(4.5, .6, 28.));
	minH(h, Hit(deck, ID_STEEL, p));
	// Riveted I-girders running across the street (repeat along x).
	vec3 gq = vec3(mod(p.x + .75, 1.5) - .75, p.y, p.z);
	float web = max(sdBox(gq - vec3(0., 4.75, 2.), vec3(.03, .35, 28.)), abs(p.x) - 4.2);
	float flange = max(sdBox(gq - vec3(0., 4.42, 2.), vec3(.17, .03, 28.)), abs(p.x) - 4.2);
	minH(h, Hit(min(web, flange), ID_STEEL, p));
	// Edge girders (deeper) at the deck rim.
	vec3 eq = vec3(abs(p.x) - 4.35, p.y - 4.6, p.z);
	minH(h, Hit(sdBox(eq, vec3(.12, .55, 28.)), ID_STEEL, p));

	// Abutment wall behind the viewer.
	float abut = sdBox(p - vec3(0., 2.2, -2.6), vec3(4.5, 2.3, .8));
	// Far-side abutment, mostly hidden by the buildings.
	abut = min(abut, sdBox(p - vec3(0., 2.2, 11.4), vec3(4.5, 2.3, .8)));
	minH(h, Hit(abut, ID_BRICK, p));
	// Embankment slabs continuing the wall line outward.
	vec3 bq = vec3(abs(p.x) - 14., p.y, p.z);
	minH(h, Hit(sdBox(bq - vec3(5., 1.4, -2.9), vec3(10., 1.4, .5)), ID_BRICK, p));

	// Street lamps: two cool ones flanking, one warm sodium far off.
	vec3 lq = vec3(p.x + 13., p.y, p.z - .7);
	float pole = sdCyl(lq, 3.4, .06);
	pole = min(pole, sdSeg(lq, vec3(0., 3.35, 0.), vec3(.9, 3.55, .6), .045));
	float head = length(lq - vec3(.95, 3.5, .65)) - .16;
	lq = vec3(p.x - 16., p.y, p.z - 9.4);
	pole = min(pole, sdCyl(lq, 3.4, .06));
	pole = min(pole, sdSeg(lq, vec3(0., 3.35, 0.), vec3(-.9, 3.55, -.5), .045));
	head = min(head, length(lq - vec3(-.95, 3.5, -.55)) - .16);
	// Sodium lamp far up the street (down the default sightline).
	lq = vec3(p.x + 34., p.y, p.z - 1.);
	pole = min(pole, sdCyl(lq, 3.4, .06));
	head = min(head, length(lq - vec3(0., 3.5, .4)) - .16);
	// Caged wall-pack lamp on the abutment, keeping the underpass legible.
	head = min(head, sdBox(p - vec3(1.4, 3.9, -1.78), vec3(.14, .1, .06)));
	minH(h, Hit(pole, ID_METAL, p));
	minH(h, Hit(head, ID_LAMP, p));

	// ADAMS ST blade on its pole, near the curb.
	vec3 sq = p - vec3(5.6, 0., .9);
	float spole = sdCyl(sq - vec3(0., 1.45, 0.), 1.45, .035);
	minH(h, Hit(spole, ID_METAL, p));
	vec3 blq = sq - vec3(0., 2.72, 0.);
	blq.xz *= rot(-.5);
	minH(h, Hit(sdBox(blq - vec3(.42, 0., 0.), vec3(.42, .11, .012)), ID_SIGN, blq));

	// Buildings across the street: dark facades, sparse lit windows.
	float bldg = sdBox(p - vec3(-16., 5., 16.), vec3(11., 5., 5.));
	bldg = min(bldg, sdBox(p - vec3(2., 7., 19.), vec3(8., 7., 6.)));
	bldg = min(bldg, sdBox(p - vec3(20., 4., 15.), vec3(9., 4., 4.)));
	bldg = min(bldg, sdBox(p - vec3(38., 6., 18.), vec3(9., 6., 6.)));
	minH(h, Hit(bldg, ID_BLDG, p));

	// The car (gated; bounded).
	if (uCarOn > .5) {
		vec3 tp = vec3(p.x - uCarX, p.y, p.z - (uCarDir > 0. ? 3.2 : 6.6));
		tp.x *= uCarDir; // nose forward
		float bound = sdBox(tp - vec3(0., .7, 0.), vec3(2.9, 1., 1.2));
		minH(h, Hit(bound > .5 ? bound : sdCar(tp), ID_CAR, tp));
	}

	// Drips off the girders, inside the shelter line.
	vec3 dq = vec3(mod(p.x + 1.9, 3.8) - 1.9, p.y, p.z - 1.4);
	float fall = fract(p.y * .22 + T * (1.1 + hash22(vec2(floor((p.x + 1.9) / 3.8), 7.)).x));
	float dd = length(dq.xz) + .02;
	g.z += step(abs(p.x), 4.2) * smoothstep(.12, .0, dd) * smoothstep(.75, .95, fall) * .12;

	return h;
}

/* ---------------- lighting & materials ---------------- */

/* The scene's point lights, reused for surface light and wet reflections. */
#define NUM_LIGHTS 5
void lightAt(int i, out vec3 lp, out vec3 lc) {
	if (i == 0) { lp = vec3(-12.05, 3.5, 1.35); lc = vec3(.75, .95, .9) * 3.2; }
	else if (i == 1) { lp = vec3(15.05, 3.5, 8.85); lc = vec3(.75, .95, .9) * 3.2; }
	else if (i == 2) { lp = vec3(-34., 3.5, 1.4); lc = vec3(1., .65, .3) * 2.6; }
	else if (i == 3) { lp = vec3(1.4, 3.9, -1.6); lc = vec3(.6, .8, .72) * 2.4; } // wall-pack under the deck
	else { lp = vec3(uCarX + uCarDir * 2.7, .68, uCarDir > 0. ? 3.2 : 6.6); lc = vec3(1., .95, .8) * 4. * uCarOn; }
}

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	if (h.id == ID_LAMP) {
		// The sodium head burns warm; the rest cold.
		return p.x < -20. ? vec3(1., .6, .25) * 5.5 : vec3(.8, 1., .95) * 5.5;
	}
	if (h.id == ID_SIGN) {
		vec2 suv = clamp(vec2(h.uv.x / .84 + .0, .5 - h.uv.y / .22), 0., 1.);
		vec3 c = texture2D(uSign, vec2(suv.x, suv.y)).rgb;
		// still lit below by the lamps
		h.id = ID_METAL;
		vec3 n2 = calcN(p, d);
		vec3 acc2 = vec3(.06);
		for (int i = 0; i < NUM_LIGHTS; i++) {
			vec3 lp, lc;
			lightAt(i, lp, lc);
			vec3 ld = lp - p;
			float d2 = dot(ld, ld);
			acc2 += lc * clamp(dot(n2, normalize(ld)), 0., 1.) / (1. + d2 * .12);
		}
		return c * acc2;
	}

	vec3 n = calcN(p, d);
	float spec = .3, gloss = 24.;
	vec3 c;
	float wetGloss = 0.;

	if (h.id == ID_GROUND) {
		float street = step(.02, p.z) * step(p.z, 8.5) * step(p.y, .05);
		c = vec3(.13, .14, .14) * (.8 + .4 * n31(p * 6.));
		if (street < .5) c = vec3(.22, .22, .21) * (.85 + .3 * n21(floor(p.xz / vec2(.8, .8)) * 3.7)); // sidewalk slabs
		// Lane line.
		c = mix(c, vec3(.4, .38, .3), step(abs(p.z - 4.9), .07) * step(fract(p.x * .35), .55) * street * .6);
		// Wet: everything gleams; puddles go glassy.
		float puddle = smoothstep(.52, .68, n21(p.xz * vec2(.33, .5)));
		wetGloss = mix(.5, 1., puddle);
		// Rain agitation dimples the puddles outside the shelter.
		float agit = (1. - sheltered(p)) * (.4 + .6 * uStorm);
		n = normalize(n + vec3(n31(vec3(p.xz * 9., T * 5.)) - .5, 0., n31(vec3(p.xz * 9. + 40., T * 5.)) - .5) * .12 * agit * (1. - puddle * .4));
		spec = .2;
	} else if (h.id == ID_BRICK) {
		vec2 buv = vec2(p.x + p.z, p.y);
		vec2 bid = floor(buv / vec2(.42, .14));
		c = vec3(.21, .16, .13) * (.75 + .5 * n21(bid * 5.1));
		float mortar = smoothstep(.0, .12, abs(fract(buv.x / .42 + fract(bid.y * .5)) - .5))
					 * smoothstep(.0, .2, abs(fract(buv.y / .14) - .5));
		c *= mix(.6, 1., mortar);
		c *= .8 + .4 * n31(p * 2.); // grime
		spec = .15;
	} else if (h.id == ID_STEEL) {
		c = vec3(.10, .11, .11) * (.75 + .5 * n31(h.uv * 3.));
		// Rivet lines along the girders.
		float riv = smoothstep(.05, .02, length(vec2(fract(p.z * 1.6) - .5, fract(p.y * 3.) - .5)) * .5);
		c += riv * .04;
		c *= .75 + .5 * n31(p * vec3(.4, 3., .4)); // streaked rust/wash
		spec = .35;
	} else if (h.id == ID_METAL) {
		c = vec3(.12, .13, .13);
		spec = .5;
		gloss = 40.;
	} else if (h.id == ID_BLDG) {
		c = vec3(.10, .11, .11) * (.8 + .4 * n31(p * 1.5));
		vec2 wuv = vec2((p.x + p.z * .2) / 1.8, p.y / 1.5);
		vec2 wid = floor(wuv);
		vec2 wf = fract(wuv);
		float win = step(.25, wf.x) * step(wf.x, .7) * step(.3, wf.y) * step(wf.y, .8) * step(1.5, p.y);
		float lit = step(.87, hash22(wid * .37 + .11).x);
		if (win * lit > .5) return vec3(1., .8, .5) * 1.4 * (0.6 + .8 * hash22(wid).y);
		c = mix(c, vec3(.05, .06, .06), win);
	} else {
		// The sedan: near-black paint, chrome trim, lit glass.
		vec3 tp = h.uv;
		c = vec3(.05, .06, .05);
		spec = 1.2;
		gloss = 60.;
		wetGloss = .8;
		// Chrome bumpers + trim line.
		if (tp.y < .42 && abs(tp.x) > 2.3) { c = vec3(.4); spec = 2.; }
		if (abs(tp.y - .78) < .025) { c = vec3(.3); spec = 1.5; }
		// Headlights / tails on the end faces.
		if (tp.x > 2.5) {
			float lampd = length(vec2(abs(tp.z) - .55, tp.y - .68));
			if (lampd < .13) return vec3(1., .97, .85) * 5.;
		} else if (tp.x < -2.5) {
			float lampd = length(vec2(abs(tp.z) - .6, tp.y - .7));
			if (lampd < .1) return vec3(1., .1, .05) * 3.;
		}
		// Warm cabin glass — the side window band only, not the roof.
		if (tp.y > .95 && tp.y < 1.2 && abs(tp.z) > .68 && abs(tp.x + .35) < 1.0) return vec3(.9, .75, .5) * .9;
	}

	float occ = calcAO(p, n);
	vec3 acc = vec3(0);
	for (int i = 0; i < NUM_LIGHTS; i++) {
		vec3 lp, lc;
		lightAt(i, lp, lc);
		vec3 ld = lp - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		float dif = clamp(.1 + .9 * dot(n, ld), 0., 1.);
		float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;
		// Wet ground: long smeared reflections of every light.
		if (wetGloss > 0.) {
			vec3 rv = reflect(rd, n);
			float align = max(dot(rv, ld), 0.);
			sp += pow(align, mix(14., 90., wetGloss)) * wetGloss * 2.2;
		}
		acc += (dif * .55 + sp) * lc / (1. + d2 * .10);
	}

	vec3 amb = vec3(.075, .095, .09);
	return c * amb * occ + (h.id == ID_GROUND ? mix(c, vec3(.6), .35) : c) * acc * (.4 + .6 * occ);
}

/* Analytic halo: closest approach of the view ray to a light, clamped to
 * the hit distance so occluders still swallow the glow. Rain scatter makes
 * every lamp bloom — the film's look. */
float rayHalo(vec3 ro, vec3 rd, vec3 lp, float maxD) {
	vec3 w = lp - ro;
	float t = clamp(dot(w, rd), 0., maxD);
	vec3 q = w - rd * t;
	return step(.01, t) / (.06 + dot(q, q));
}

/* Layered world-anchored rain streaks. */
float rain(vec3 ro, vec3 rd) {
	float a = 0.;
	float amount = .55 + .45 * uStorm;
	for (int i = 0; i < 3; i++) {
		float dist = i == 0 ? 2.5 : (i == 1 ? 7. : 16.);
		vec3 p = ro + rd * dist;
		if (sheltered(p) > .5) continue;
		vec2 cell = floor(p.xz * (3.5 - float(i)));
		vec2 hh = hash22(cell * .37 + float(i) * 11.1);
		if (hh.x > amount * .5) continue;
		// Short falling dashes, not full-height columns.
		float seg = fract(p.y * .7 + T * (2.2 + hh.y * 1.2) + hh.y * 7.);
		float dash = smoothstep(.68, .82, seg) * smoothstep(1., .9, seg);
		float lx = abs(fract(p.x * (3.5 - float(i)) + hh.y) - .5);
		a += smoothstep(.1, .02, lx) * dash * (.14 + .1 * uStorm) * (1. - float(i) * .25);
	}
	return a;
}

/* Water sheeting off the deck edges — the film's own detail. */
float curtain(vec3 ro, vec3 rd, float dHit) {
	float a = 0.;
	for (int s = 0; s < 2; s++) {
		float px = s == 0 ? 4.55 : -4.55;
		float denom = rd.x;
		if (abs(denom) < .001) continue;
		float t = (px - ro.x) / denom;
		if (t < 0. || t > dHit) continue;
		vec3 c = ro + rd * t;
		if (c.y < .0 || c.y > 4.4 || c.z < -6. || c.z > 12.) continue;
		// Sparse ropes of water with long gaps — see-through, brightest near
		// the deck edge where the sheet peels off.
		float lane = n21(vec2(floor(c.z * 6.) * .61, 7.1));
		float rope = smoothstep(.8, .96, n21(vec2(c.z * 24., c.y * .2 + T * 7.))) * step(lane, .3 + .35 * uStorm);
		float fringe = smoothstep(3.4, 4.35, c.y) * .12;
		a += (rope * .14 + fringe) * (.45 + .75 * uStorm);
	}
	return a;
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

	vec3 gg = g;

	vec3 c = d < MAX_DIST ? shade(p, rd, d, h) : vec3(.012, .02, .02) * (1. - rd.y);

	// Night haze, heavier in the downpour.
	c = mix(c, vec3(.015, .028, .027), 1. - exp(-d * (.02 + .015 * uStorm)));

	// Lamp halos, bloomed by the rain.
	float scat = .06 + .05 * uStorm;
	c += vec3(.7, .9, .85) * scat * rayHalo(ro, rd, vec3(-12.05, 3.5, 1.35), d);
	c += vec3(.7, .9, .85) * scat * rayHalo(ro, rd, vec3(15.05, 3.5, 8.85), d);
	c += vec3(1., .6, .25) * scat * 1.3 * rayHalo(ro, rd, vec3(-34., 3.5, 1.4), d);
	if (uCarOn > .5) {
		// Headlight beam: a few analytic samples along the cone axis.
		float lane = uCarDir > 0. ? 3.2 : 6.6;
		for (int s = 0; s < 4; s++) {
			float along = float(s) * 3.5;
			vec3 bp = vec3(uCarX + uCarDir * (2.6 + along), .68, lane);
			c += vec3(1., .95, .8) * scat * (1.4 - along * .09) * .5 * rayHalo(ro, rd, bp, d);
		}
	}

	// Drips catching the light.
	c += gg.z * vec3(.6, .75, .7);

	// The rain itself + the curtain off the deck.
	c += rain(ro, rd) * vec3(.55, .68, .65);
	c += curtain(ro, rd, d) * vec3(.5, .65, .6);

	return c;
}

void main()
{
	T = uTime;

	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	col *= vec3(.92, 1.05, 1.02); // cold green-cyan night
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
