import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * Adams Street bridge — the first film's rain-soaked night pickup, staged at
 * the real location: the 1926 Elizabeth Street railway viaduct ("Adam Street
 * Bridge"), Haymarket, Sydney — a wide ELLIPTICAL CONCRETE ARCH carrying the
 * tracks over a four-lane road.
 *
 * Staging (owner-reviewed): first-person as Neo, standing on the RIGHT FOOTPATH
 * under the arch (a pedestrian waiting for the pickup), looking down the
 * roadway. The underpass is OPEN AT BOTH MOUTHS — nothing caps either end; the
 * street continues past the far mouth (z<MOUTH_Z) into fog with flanking
 * low-rise buildings, brick embankment retaining walls, a warm sodium lamp and
 * period traffic signals. Rain falls only in the OPEN air beyond the deck
 * footprint (the underpass is dry); water sheets off the far deck edge in
 * sparse ropes — an edge detail, not a wall. A 1965 Lincoln Continental rolls
 * through the near lane. Click leans the weather into a downpour.
 */
export const BRIDGE_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uStorm;    // 0 steady rain .. 1 downpour
uniform float uCarOn;
uniform float uCarZ;     // car center, world z (travels down the road)
uniform float uCarDir;   // +1 travelling +z (toward/past camera), -1 -z
uniform sampler2D uSign;
uniform sampler2D uAsphalt;
uniform sampler2D uConcrete;
uniform sampler2D uBrick;

#define MIN_DIST   .0025
#define MAX_DIST   90.0
#define MAX_STEPS  128.0
#define FL         1.428

#define ID_ROAD    1
#define ID_VAULT   2
#define ID_BRICK   3
#define ID_METAL   4
#define ID_SIGN    5
#define ID_LAMP    6
#define ID_BLDG    7
#define ID_CAR     8
#define ID_SIGNAL  9

// Elliptical bore of the viaduct arch (cross-section in x,y). Wide enough for
// four lanes + footpaths: springs from the road at |x|~8.8, crown at y~7.2.
#define RX   9.5
#define RY   5.2
#define CY   2.0
#define MOUTH_Z  -10.0   // far mouth (open street beyond)
#define NEAR_Z    6.0    // near mouth (open street behind the viewer)
#define CAR_X     5.0    // the Lincoln's lane (near-right, beside the footpath)

float T;
float gExt = 0.; // set when the final pixel is the exterior street (split grade)

/* cheap sRGB -> linear for raw-uploaded photo textures */
vec3 srgbTex(sampler2D s, vec2 uv) {
	vec3 c = texture2D(s, uv).rgb;
	return c * c;
}

/* Elliptical bore field: <0 inside the open tunnel, >0 in the concrete. */
float bore(vec3 p) {
	vec2 e = vec2(p.x / RX, (p.y - CY) / RY);
	return (length(e) - 1.) * min(RX, RY) * .9;
}

/* Under the bridge deck? (dry — sheltered from rain). Based on the deck
 * FOOTPRINT, not the bore: anything below the deck within the road width and
 * the viaduct's z-span is covered. Rain falls everywhere else. */
float sheltered(vec3 p) {
	return step(abs(p.x), 9.0) * step(MOUTH_Z, p.z) * step(p.z, NEAR_Z);
}

/* ---------------- the 1965 Lincoln Continental ---------------- */
/* q: car-local — x along the body (nose +x), y up from road, z across. */
float sdCar(vec3 q) {
	// Long slab-sided lower body, gently tapered toward the ends.
	float halfW = .96 - .07 * smoothstep(1.7, 2.6, abs(q.x));
	float body = sdBox(q - vec3(0., .60, 0.), vec3(2.5, .27, halfW)) - .06;
	// Formal greenhouse: a narrower box, then raked front (windshield) and
	// rear (backlight) so the roof reads as a sloped cabin, not a slab.
	float cab = sdBox(q - vec3(-.35, 1.10, 0.), vec3(1.05, .24, .74)) - .05;
	cab = max(cab, dot(q - vec3(.70, .92, 0.), normalize(vec3(.68, .73, 0.))));   // windshield rake
	cab = max(cab, dot(q - vec3(-1.40, .92, 0.), normalize(vec3(-.77, .64, 0.)))); // backlight rake
	float d = min(body, cab);
	// Chrome bumpers wrap front and rear.
	float fb = sdBox(q - vec3(2.60, .44, 0.), vec3(.10, .16, 1.0)) - .05;
	float rb = sdBox(q - vec3(-2.62, .46, 0.), vec3(.10, .18, 1.0)) - .05;
	d = min(d, min(fb, rb));
	// Four wheels (double-abs), axle at |x|=1.72, hub height .34.
	vec3 w = vec3(abs(q.x) - 1.72, q.y - .34, abs(q.z) - .94);
	float wheel = sdCyl(vec3(w.x, w.z, w.y), .14, .36);
	d = min(d, wheel);
	return d;
}

/* Store a flat sign panel: box + normalised (u,v) into the ADAMS ST atlas. */
void signPanel(inout Hit h, float d, vec2 local, vec2 half_) {
	vec2 uv = vec2(local.x / (2. * half_.x) + .5, .5 - local.y / (2. * half_.y));
	if (d < h.d) h = Hit(d, ID_SIGN, vec3(uv, 0.));
}

/* ---------------- the scene ---------------- */

Hit map(vec3 p) {
	// Road: infinite wet asphalt (continues out both mouths), raised footpaths.
	float road = p.y;
	float foot = sdBox(p - vec3(8.0, .13, -2.), vec3(1.2, .13, 24.));
	foot = min(foot, sdBox(p - vec3(-8.0, .13, -2.), vec3(1.2, .13, 24.)));
	Hit h = Hit(min(road, foot), ID_ROAD, p);

	// The viaduct: a solid concrete block with the elliptical bore carved out.
	// Its finite z-span [MOUTH_Z, NEAR_Z] gives BOTH open mouths automatically.
	float block = sdBox(p - vec3(0., 2., -2.), vec3(13., 6., 8.));
	float vault = max(block, -bore(p));
	minH(h, Hit(vault, ID_VAULT, p));

	// Brick embankment retaining walls flanking the OPEN street beyond each
	// mouth (the earth the railway approach sits on) — continuing space, not caps.
	float ret = sdBox(p - vec3(9.8, 1.8, -22.), vec3(1., 2.1, 13.));
	ret = min(ret, sdBox(p - vec3(-9.8, 1.8, -22.), vec3(1., 2.1, 13.)));
	ret = min(ret, sdBox(p - vec3(9.8, 1.8, 15.), vec3(1., 2.1, 9.)));
	ret = min(ret, sdBox(p - vec3(-9.8, 1.8, 15.), vec3(1., 2.1, 9.)));
	minH(h, Hit(ret, ID_BRICK, p));

	// Wall-pack lamp — flush on the LEFT curved vault wall (no clipping): at
	// y=3.6 the ellipse wall is near x=-9.0, so the fixture sits at x=-8.7.
	float pole = 1e6;
	float head = sdBox(p - vec3(-8.7, 3.6, -2.), vec3(.18, .15, .11));
	// Sodium street lamp out beyond the far mouth (aligned to its light + halo).
	vec3 lq = vec3(p.x + 6., p.y, p.z + 24.);
	pole = min(pole, sdCyl(lq - vec3(0., 3., 0.), 3., .07));
	pole = min(pole, sdSeg(lq, vec3(0., 5.9, 0.), vec3(1.2, 6.0, 0.), .05));
	head = min(head, length(lq - vec3(1.25, 5.95, 0.)) - .18);
	minH(h, Hit(pole, ID_METAL, p));
	minH(h, Hit(head, ID_LAMP, p));

	// Period traffic signals over the road, out on the far street.
	float sigp = 1e6;
	vec3 s1 = p - vec3(8., 0., -17.);
	sigp = min(sigp, sdCyl(s1 - vec3(0., 2.8, 0.), 2.8, .08));
	sigp = min(sigp, sdSeg(s1, vec3(0., 5.4, 0.), vec3(-3.2, 5.4, 0.), .06));
	vec3 s2 = p - vec3(-8., 0., -24.);
	sigp = min(sigp, sdCyl(s2 - vec3(0., 2.8, 0.), 2.8, .08));
	sigp = min(sigp, sdSeg(s2, vec3(0., 5.4, 0.), vec3(3.2, 5.4, 0.), .06));
	minH(h, Hit(sigp, ID_METAL, p));
	vec3 hd1 = s1 - vec3(-3.2, 4.95, 0.);
	minH(h, Hit(sdBox(hd1, vec3(.14, .42, .16)), ID_SIGNAL, hd1));
	vec3 hd2 = s2 - vec3(3.2, 4.95, 0.);
	minH(h, Hit(sdBox(hd2, vec3(.14, .42, .16)), ID_SIGNAL, hd2));

	// ADAMS ST blade sign OUT at the far mouth on the right footpath.
	vec3 sq = p - vec3(7.8, 0., -10.2);
	minH(h, Hit(sdCyl(sq - vec3(0., 1.6, 0.), 1.6, .04), ID_METAL, p));
	vec3 blq = sq - vec3(0., 3.0, 0.);
	blq.xz *= rot(2.3); // face back up the road toward the camera
	signPanel(h, sdBox(blq, vec3(.46, .115, .012)), blq.xy, vec2(.46, .115));

	// Interior name plate on the left vault wall (station-style, like Mobil Ave).
	vec3 wp = p - vec3(-8.4, 3.3, -3.5);
	signPanel(h, sdBox(wp, vec3(.03, .26, 1.05)), vec2(-wp.z, wp.y), vec2(1.05, .26));

	// Buildings FLANKING the street beyond the far mouth, receding into fog.
	float bldg = sdBox(p - vec3(-15., 8., -30.), vec3(6., 8., 10.));
	bldg = min(bldg, sdBox(p - vec3(-14., 12., -50.), vec3(7., 12., 10.)));
	bldg = min(bldg, sdBox(p - vec3(15., 7., -28.), vec3(6., 7., 9.)));
	bldg = min(bldg, sdBox(p - vec3(14., 11., -48.), vec3(7., 11., 10.)));
	minH(h, Hit(bldg, ID_BLDG, p));

	// The car (gated; bounded).
	if (uCarOn > .5) {
		vec3 tp = vec3(p.x - CAR_X, p.y, p.z - uCarZ);
		tp = vec3(tp.z * uCarDir, tp.y, -tp.x * uCarDir); // nose along travel
		float bnd = sdBox(tp - vec3(0., .75, 0.), vec3(3., 1.05, 1.25));
		minH(h, Hit(bnd > .6 ? bnd : sdCar(tp), ID_CAR, tp));
	}

	return h;
}

/* ---------------- lighting & materials ---------------- */

#define NUM_LIGHTS 4
void lightAt(int i, out vec3 lp, out vec3 lc) {
	// 0: cool wall-pack under the arch (keeps the underpass readable)
	if (i == 0) { lp = vec3(-8.7, 3.6, -2.); lc = vec3(.6, .82, .8) * 3.2; }
	// 1: soft cool sky spill from the far mouth
	else if (i == 1) { lp = vec3(0., 5., -9.); lc = vec3(.5, .72, .74) * 2.0; }
	// 2: warm sodium lamp out on the far street (warm accent + wet reflection)
	else if (i == 2) { lp = vec3(-4.75, 5.95, -24.); lc = vec3(1., .62, .28) * 6.0; }
	// 3: car light — headlight beam on approach, tail glow going away
	else {
		float nose = uCarZ + uCarDir * 2.7;
		lp = vec3(CAR_X, .7, nose);
		lc = (uCarDir > 0. ? vec3(1., .95, .82) * 6. : vec3(1., .16, .08) * 2.5) * uCarOn;
	}
}

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	if (h.id == ID_LAMP) {
		return p.z < -14. ? vec3(1., .62, .28) * 6. : vec3(.75, .95, .92) * 5.;
	}
	if (h.id == ID_SIGNAL) {
		// Dark housing; the top lens burns red (period incandescent) facing the road.
		vec3 q = h.uv;
		float lens = length(vec2(q.x, q.y - .26));
		if (q.z > .04 && lens < .1) return vec3(1., .1, .05) * 2.6;
		return vec3(.02, .022, .022);
	}
	if (h.id == ID_SIGN) {
		vec3 c = texture2D(uSign, h.uv.xy).rgb;
		vec3 n2 = calcN(p, d);
		vec3 acc2 = vec3(.1);
		for (int i = 0; i < NUM_LIGHTS; i++) {
			vec3 lp, lc; lightAt(i, lp, lc);
			vec3 ld = lp - p; float d2 = dot(ld, ld);
			acc2 += lc * clamp(dot(n2, normalize(ld)), 0., 1.) / (1. + d2 * .12);
		}
		return c * acc2;
	}

	vec3 n = calcN(p, d);
	float spec = .3, gloss = 24.;
	vec3 c;
	float wetGloss = 0.;

	if (h.id == ID_ROAD) {
		float onFoot = step(7.0, abs(p.x)) * step(.06, p.y);
		vec2 auv = p.xz * .16;
		vec3 alb = srgbTex(uAsphalt, auv);
		alb = mix(vec3(dot(alb, vec3(.33))), alb, .5);   // desaturate the warm cast
		c = alb * vec3(.62, .72, .74) * .8;              // cool, dark night asphalt
		if (onFoot > .5) c = mix(c, vec3(.17, .18, .18), .6);
		// Four-lane markings: solid centre + edge lines, dashed lane dividers.
		float carr = step(abs(p.x), 7.0) * (1. - onFoot);
		float centre = step(abs(p.x), .13);
		float divider = step(abs(abs(p.x) - 3.5), .09) * step(fract(p.z * .32), .5);
		float edge = step(abs(abs(p.x) - 7.0), .11);
		float lines = clamp(centre + divider + edge, 0., 1.) * carr;
		c = mix(c, vec3(.34, .32, .26), lines * .65);
		// Wet: broad sheen, puddles go glassy; rain agitation only where open.
		float puddle = smoothstep(.5, .68, n21(p.xz * vec2(.28, .26)));
		wetGloss = mix(.6, 1., puddle) * (1. - onFoot * .5);
		float agit = (1. - sheltered(p)) * (.4 + .6 * uStorm);
		n = normalize(n + vec3(n31(vec3(p.xz * 9., T * 5.)) - .5, 0.,
							   n31(vec3(p.xz * 9. + 40., T * 5.)) - .5) * .1 * agit * (1. - puddle * .4));
		spec = .2;
	} else if (h.id == ID_VAULT) {
		float ang = atan(p.x, max(p.y - CY, .001));
		vec2 cuv = vec2(ang * 1.5, p.z * .15);
		vec3 alb = srgbTex(uConcrete, cuv);
		c = alb * vec3(.5, .58, .58);
		c *= .8 + .35 * n31(p * .4);                     // water staining
		c *= mix(.45, 1.05, smoothstep(.2, 5., p.y));    // dark low, lighter to the crown
		spec = .12; gloss = 18.;
	} else if (h.id == ID_BRICK) {
		vec2 buv = vec2((p.x + p.z) * .2, p.y * .3);
		vec3 alb = srgbTex(uBrick, buv);
		c = alb * vec3(.7, .74, .72) * .5;
		c *= .8 + .4 * n31(p * 1.3);
		spec = .1;
	} else if (h.id == ID_METAL) {
		c = vec3(.09, .1, .1); spec = .5; gloss = 40.;
	} else if (h.id == ID_BLDG) {
		c = vec3(.06, .075, .08) * (.8 + .4 * n31(p * .8));
		vec2 wuv = vec2((p.x + p.z * .15) / 2.2, p.y / 1.7);
		vec2 wid = floor(wuv), wf = fract(wuv);
		float win = step(.3, wf.x) * step(wf.x, .68) * step(.32, wf.y) * step(wf.y, .78) * step(2.5, p.y);
		float lit = step(.9, hash22(wid * .37 + .11).x);
		if (win * lit > .5) { gExt = 1.; return vec3(1., .82, .52) * .7 * (.4 + .7 * hash22(wid).y); }
		c = mix(c, vec3(.03, .04, .045), win);
		gExt = step(p.z, MOUTH_Z);
	} else {
		// The Lincoln: near-black glossy paint, chrome, dark glass, lit lamps.
		vec3 q = h.uv;
		c = vec3(.02, .025, .03); spec = 1.3; gloss = 70.; wetGloss = .85;
		float chrome = step(abs(q.y - .74), .022) * step(abs(q.x), 2.45);   // side character line
		chrome += step(2.5, abs(q.x)) * step(q.y, .62);                     // bumpers
		chrome += step(1.25, q.y) * step(abs(q.x + .35), 1.12);             // greenhouse frame
		if (chrome > .5) { c = vec3(.55); spec = 2.2; gloss = 95.; }
		// Dark glass in the greenhouse band.
		if (q.y > .95 && q.y < 1.26 && (abs(q.z) > .66 || q.x < -1.05 || q.x > .35)) {
			c = vec3(.02, .03, .04); spec = 1.6; gloss = 80.;
		}
		// Front: a chrome grille/bumper band with small quad headlights set into it.
		if (q.x > 2.4) {
			if (q.y > .4 && q.y < .68) { c = vec3(.34); spec = 1.9; gloss = 60.; }  // chrome grille bar
			float l = min(length(vec2(abs(q.z) - .48, q.y - .55)), length(vec2(abs(q.z) - .74, q.y - .55)));
			if (l < .065) return vec3(1., .93, .78) * 3.4;
		}
		// Small vertical taillight lenses at the rear corners.
		if (q.x < -2.42 && abs(q.z) > .74 && q.y > .5 && q.y < .82) return vec3(1., .1, .05) * 3.;
		// Whitewalls + chrome hubcaps.
		vec3 w = vec3(abs(q.x) - 1.72, q.y - .34, abs(q.z) - .94);
		float rw = length(w.xy);
		if (abs(w.z) < .05 && rw < .37) {
			if (rw > .27 && rw < .335) return vec3(.72, .75, .75);
			if (rw < .14) { c = vec3(.5); spec = 2.; }
			else { c = vec3(.02); spec = .4; }
		}
	}

	float occ = calcAO(p, n);
	vec3 acc = vec3(0);
	for (int i = 0; i < NUM_LIGHTS; i++) {
		vec3 lp, lc; lightAt(i, lp, lc);
		vec3 ld = lp - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		float dif = clamp(.12 + .88 * dot(n, ld), 0., 1.);
		float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;
		if (wetGloss > 0.) {
			vec3 rv = reflect(rd, n);
			float align = max(dot(rv, ld), 0.);
			sp += pow(align, mix(14., 90., wetGloss)) * wetGloss * 2.4;
		}
		acc += (dif * .55 + sp) * lc / (1. + d2 * .09);
	}

	vec3 amb = vec3(.05, .07, .07);
	return c * amb * occ + (h.id == ID_ROAD ? mix(c, vec3(.5), .3) : c) * acc * (.4 + .6 * occ);
}

/* Analytic halo: closest approach of the view ray to a light, clamped to the
 * hit distance so occluders swallow the glow. Rain scatter blooms every lamp. */
float rayHalo(vec3 ro, vec3 rd, vec3 lp, float maxD) {
	vec3 w = lp - ro;
	float t = clamp(dot(w, rd), 0., maxD);
	vec3 q = w - rd * t;
	return step(.01, t) / (.06 + dot(q, q));
}

/* Layered world-anchored rain — ONLY in the open air (skips the dry deck
 * footprint), so it falls out both mouths and beyond the water curtain. */
float rain(vec3 ro, vec3 rd, float dHit) {
	float a = 0.;
	float amount = .5 + .5 * uStorm;
	for (int i = 0; i < 3; i++) {
		float dist = i == 0 ? 11. : (i == 1 ? 18. : 28.);
		if (dist > dHit) continue;          // don't bleed over closer surfaces
		vec3 p = ro + rd * dist;
		if (sheltered(p) > .5) continue;
		vec2 cell = floor(p.xy * (3.2 - float(i) * .7));
		vec2 hh = hash22(cell * .37 + float(i) * 11.1);
		if (hh.x > amount * .55) continue;
		float seg = fract(p.y * .7 + T * (2.2 + hh.y * 1.2) + hh.y * 7.);
		float dash = smoothstep(.66, .82, seg) * smoothstep(1., .88, seg);
		float lx = abs(fract(p.x * (3.2 - float(i) * .7) + hh.y) - .5);
		a += smoothstep(.11, .02, lx) * dash * (.16 + .12 * uStorm) * (1. - float(i) * .2);
	}
	return a;
}

/* Water sheeting off the far deck edge in SPARSE ROPES — an atmospheric detail
 * at the top of the mouth, see-through so the street beyond reads clearly.
 * (Deliberately scaled back from a hero curtain per owner note.) */
float curtain(vec3 ro, vec3 rd, float dHit) {
	float zc = MOUTH_Z + .3;
	if (abs(rd.z) < .001) return 0.;
	float t = (zc - ro.z) / rd.z;
	if (t < 0. || t > dHit) return 0.;
	vec3 c = ro + rd * t;
	if (bore(vec3(c.x, c.y, zc)) > -.1 || c.y < 0.) return 0.;
	// Concentrated near the top lip (the deck edge); fades to nothing lower down.
	float lip = smoothstep(1.5, 5.5, c.y);
	if (lip < .01) return 0.;
	float fr = 7.;
	float lane = hash22(vec2(floor(c.x * fr), 3.)).x;
	if (lane > .5) return 0.;                        // most columns absent → sparse
	float col = smoothstep(.32, .0, abs(fract(c.x * fr) - .5));
	float fall = fract(-c.y * .4 - T * (6. + lane * 3.) + lane * 5.);
	float dash = smoothstep(.5, .75, fall) * smoothstep(1., .82, fall);
	return col * dash * lip * (.22 + .3 * uStorm);
}

vec3 march(vec3 ro, vec3 rd) {
	vec3 p; float d = .01; Hit h;
	for (float i = 0.; i < MAX_STEPS; i++) {
		p = ro + rd * d;
		h = map(p);
		if (abs(h.d) < MIN_DIST || d > MAX_DIST) break;
		d += h.d;
	}

	bool escaped = d >= MAX_DIST;
	vec3 c;
	if (escaped) {
		// Open sky / street haze down either mouth — cool, lifting near the road.
		float horizon = smoothstep(.35, -.15, rd.y);
		c = mix(vec3(.01, .02, .025), vec3(.06, .1, .12), horizon);
		gExt = 1.;
	} else {
		c = shade(p, rd, d, h);
	}

	// Night haze; the open street beyond a mouth reads brighter (continuing space
	// fading into atmosphere, never a wall).
	float fz = smoothstep(MOUTH_Z + 2., MOUTH_Z - 12., p.z);
	vec3 fog = mix(vec3(.014, .026, .028), vec3(.05, .085, .1), fz);
	c = mix(c, fog, 1. - exp(-d * (.022 + .016 * uStorm)));

	// Lamp + signal halos, bloomed by the rain.
	float scat = .06 + .05 * uStorm;
	c += vec3(.6, .82, .8) * scat * rayHalo(ro, rd, vec3(-8.7, 3.6, -2.), d);
	c += vec3(1., .6, .26) * scat * 1.4 * rayHalo(ro, rd, vec3(-4.75, 5.95, -24.), d);
	c += vec3(1., .12, .07) * scat * .8 * rayHalo(ro, rd, vec3(4.8, 5.19, -16.85), d);
	c += vec3(1., .12, .07) * scat * .8 * rayHalo(ro, rd, vec3(-4.8, 5.19, -23.85), d);
	if (uCarOn > .5) {
		float nose = uCarZ + uCarDir * 2.7;
		vec3 col = uCarDir > 0. ? vec3(1., .95, .82) : vec3(1., .2, .1);
		for (int s = 0; s < 4; s++) {
			vec3 bp = vec3(CAR_X, .68, nose + uCarDir * float(s) * 3.);
			c += col * scat * (1.3 - float(s) * .12) * .55 * rayHalo(ro, rd, bp, d);
		}
	}

	// Rain (open air) + the sparse water ropes at the far deck edge.
	c += rain(ro, rd, d) * vec3(.5, .64, .62);
	c += curtain(ro, rd, d) * vec3(.62, .78, .78);

	return c;
}

void main()
{
	T = uTime;
	gExt = 0.;

	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	// Cool green-cyan night grade inside; a gentle warm lift for the open,
	// lit exterior so the street beyond the mouths doesn't go teal.
	col *= mix(vec3(.9, 1.06, 1.03), vec3(1.02, 1.01, .98), gExt);
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
