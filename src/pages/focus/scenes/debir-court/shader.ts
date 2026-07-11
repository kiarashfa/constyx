import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * Debir Court — the park where the Oracle waits in Reloaded, minutes before
 * the Burly Brawl. Film staging, not the real shoot location: an ordinary
 * inner-city playground under an overcast, green-graded sky — paved court
 * with faded paint lines, a concrete path with wooden benches (the Oracle's
 * bench is yours; the seat beside you stays empty), a wire trash can, trees
 * overhead throwing moving dappled light, a swing set and the lone steel
 * pole out on the court, low brownstone blocks hazing off around the park.
 * Six pigeons patrol the path; click to scatter crumbs and they gather.
 *
 * Layout: y up, ground y=0. Bench at origin facing +z; path band z 0.8..2.6
 * runs along x; the court is z 2.6..26. Trees behind and beside the bench.
 */
export const DEBIR_COURT_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uFeed; // 0 idle patrols .. 1 crumbs scattered, pigeons gather

#define MIN_DIST   .002
#define MAX_DIST   90.0
#define MAX_STEPS  90.0
#define FL         1.428

#define ID_GROUND  1
#define ID_BENCH   2
#define ID_IRON    3
#define ID_TRUNK   4
#define ID_LEAF    5
#define ID_BIRD    6
#define ID_CITY    7

float T;

/* ---------------- trees (shared with the dapple mask) ---------------- */

// Trunk positions. Canopies hang over the bench and path, framing the view.
#define TREE_COUNT 5
vec3 treeAt(int i) {
	if (i == 0) return vec3(-3.1, 0., -.7);
	if (i == 1) return vec3(3.5, 0., -.9);
	if (i == 2) return vec3(6.3, 0., 2.6);
	if (i == 3) return vec3(-6.6, 0., 3.1);
	return vec3(4., 0., 21.); // one across the court for depth
}

/* How much canopy shade covers ground point p (0 open sky, 1 deep shade). */
float canopyCover(vec2 p) {
	float w = 0.;
	for (int i = 0; i < TREE_COUNT; i++) {
		vec3 t = treeAt(i);
		w = max(w, smoothstep(6.5, 2., length(p - t.xz)));
	}
	return w;
}

/* ---------------- pigeons ---------------- */

vec3 birdPos(float i, out float settle) {
	vec2 h = hash22(vec2(i * .37 + .11, i * .71 + .29));
	vec3 base = vec3(mix(-6., 6., h.x), 0., mix(2.4, 8.5, h.y));
	vec3 feed = vec3(mix(-1.7, 1.7, h.x), 0., 1.45 + .9 * h.y);

	// Staggered walk-in when crumbs land.
	settle = smoothstep(i * .13, i * .13 + .55, uFeed);
	vec3 pos = mix(base, feed, settle);

	// Idle wander, damped once they're on the crumbs.
	pos.xz += vec2(sin(T * .31 + i * 2.1), cos(T * .23 + i * 4.3)) * .3 * (1. - settle * .75);

	// Little hops while relocating.
	float moving = settle * (1. - settle) * 4.;
	pos.y += abs(sin(T * 9. + i * 1.7)) * .05 * moving;

	return pos;
}

float sdBird(vec3 p, float i, float settle) {
	// Face the crumbs when feeding, else a fixed random heading.
	vec2 h = hash22(vec2(i * .53 + .71, i * .13 + .37));
	float yaw = mix(h.x * 6.28, 3.14 + (h.y - .5), settle);
	p.xz *= rot(yaw);

	// Body.
	float d = sdEll(p - vec3(0., .105, 0.), vec3(.085, .07, .125));

	// Pecking head.
	float peck = smoothstep(.3, .9, sin(T * 3.7 + i * 2.6)) * (.4 + .6 * settle);
	vec3 hp = vec3(0., .195 - .095 * peck, .095 + .055 * peck);
	d = smin(d, length(p - hp) - .038, .04);

	// Tail.
	return smin(d, sdEll(p - vec3(0., .125, -.15), vec3(.045, .018, .09)), .03);
}

/* ---------------- the park ---------------- */

Hit map(vec3 p) {
	// Ground.
	Hit h = Hit(p.y, ID_GROUND, p);

	// Benches along the path (ours at x=0, a twin down the way).
	vec3 bp = vec3(p.x - 8.5 * step(4.2, p.x), p.y, p.z); // cheap two-bench repeat
	float bb = sdBox(bp - vec3(0., .55, .05), vec3(1.15, .62, .55));
	if (bb < .5) {
		vec3 q = bp - vec3(0., .43, .12);
		float seat = sdBox(vec3(q.x, q.y, abs(q.z) - .12) - vec3(0., 0., 0.), vec3(.92, .022, .09)) - .008;
		q = bp - vec3(0., .74, -.26);
		q.yz *= rot(.22);
		float back = sdBox(vec3(q.x, abs(q.y) - .1, q.z), vec3(.92, .05, .022)) - .008;
		minH(h, Hit(min(seat, back), ID_BENCH, bp));
		vec3 e = vec3(abs(bp.x) - .95, bp.y, bp.z);
		float ends = sdBox(e - vec3(0., .25, .05), vec3(.035, .25, .3)) - .01;
		ends = min(ends, sdBox(e - vec3(0., .6, -.2), vec3(.035, .2, .06)) - .01);
		minH(h, Hit(ends, ID_IRON, bp));
	} else {
		minH(h, Hit(bb, ID_BENCH, bp));
	}

	// Wire trash can by the bench.
	float can = sdCyl(p - vec3(-2.1, .42, 1.1), .42, .3);
	minH(h, Hit(max(can, -(sdCyl(p - vec3(-2.1, .53, 1.1), .42, .27))), ID_IRON, p));

	// Trees: trunk + blobby canopy.
	for (int i = 0; i < TREE_COUNT; i++) {
		vec3 t = treeAt(i);
		vec3 q = p - t;
		float tb = length(q - vec3(0., 3.4, 0.)) - 3.6;
		if (tb < .8) {
			float trunk = sdCyl(q - vec3(0., 1.5, 0.), 1.5, .17 + .05 * (1. - q.y * .3));
			minH(h, Hit(trunk, ID_TRUNK, q));
			float sway = sin(T * .5 + float(i) * 2.) * .06;
			// Canopies lean out over the path, the way bench trees do.
			vec3 c = q - vec3(sway, 4.1, .9);
			float can2 = length(c) - 1.9;
			can2 = smin(can2, length(c - vec3(1.1, -.5, .7)) - 1.3, .6);
			can2 = smin(can2, length(c - vec3(-1., -.3, -.6)) - 1.25, .6);
			// Leafy irregularity.
			can2 += (n31(q * 2.1 + T * .1) - .5) * .22;
			minH(h, Hit(can2 * .8, ID_LEAF, q));
		} else {
			minH(h, Hit(tb, ID_LEAF, q));
		}
	}

	// Swing set out on the court.
	vec3 sq = p - vec3(-6., 0., 10.);
	float sb = sdBox(sq - vec3(0., 1.3, 0.), vec3(2.2, 1.5, 1.2));
	if (sb < .5) {
		vec3 aq = vec3(abs(sq.x) - 1.7, sq.y, sq.z);
		float frame = sdSeg(aq, vec3(0., 2.35, 0.), vec3(.5, 0., .8), .04);
		frame = min(frame, sdSeg(aq, vec3(0., 2.35, 0.), vec3(.5, 0., -.8), .04));
		frame = min(frame, sdSeg(sq, vec3(-1.7, 2.35, 0.), vec3(1.7, 2.35, 0.), .035));
		float sway = sin(T * .8) * .05;
		vec3 wq = vec3(abs(sq.x) - .7, sq.y, sq.z);
		wq.yz *= rot(sway);
		float chains = sdSeg(wq, vec3(-.18, 2.3, 0.), vec3(-.18, .55, 0.), .012);
		chains = min(chains, sdSeg(wq, vec3(.18, 2.3, 0.), vec3(.18, .55, 0.), .012));
		float seat = sdBox(wq - vec3(0., .53, 0.), vec3(.24, .02, .1)) - .01;
		minH(h, Hit(min(frame, min(chains, seat)), ID_IRON, sq));
	} else {
		minH(h, Hit(sb, ID_IRON, sq));
	}

	// The steel pole, standing alone on the court.
	minH(h, Hit(sdCyl(p - vec3(2.4, 1.15, 16.), 1.15, .05), ID_IRON, p));

	// Park boundary rail + city blocks beyond, hazed off.
	float rail = sdSeg(vec3(abs(p.x), p.y, p.z), vec3(13.5, .85, 2.), vec3(13.5, .85, 26.), .03);
	rail = min(rail, sdSeg(vec3(p.x, p.y, p.z), vec3(-13.5, .85, 26.), vec3(13.5, .85, 26.), .03));
	vec3 postQ = vec3(abs(p.x) - 13.5, p.y, mod(p.z, 4.) - 2.);
	rail = min(rail, max(sdCyl(vec3(postQ.x, p.y - .45, postQ.z), .45, .035), p.z - 27.));
	minH(h, Hit(rail, ID_IRON, p));

	float city = sdBox(p - vec3(-16., 6., 38.), vec3(11., 6., 6.));
	city = min(city, sdBox(p - vec3(13., 8., 44.), vec3(12., 8., 7.)));
	city = min(city, sdBox(p - vec3(30., 5., 20.), vec3(7., 5., 14.)));
	city = min(city, sdBox(p - vec3(-28., 7., 12.), vec3(6., 7., 16.)));
	city = min(city, sdBox(p - vec3(4., 5.5, -26.), vec3(24., 5.5, 8.)));
	minH(h, Hit(city, ID_CITY, p));

	// Pigeons (bounded as a flock).
	float fb = length(vec3(p.x, p.y - .15, p.z - 4.) * vec3(1., 2., 1.)) - 7.5;
	if (fb < .4) {
		for (float i = 0.; i < 6.; i++) {
			float settle;
			vec3 bpos = birdPos(i, settle);
			minH(h, Hit(sdBird(p - bpos, i, settle), ID_BIRD, p));
		}
	} else {
		minH(h, Hit(fb, ID_BIRD, p));
	}

	return h;
}

/* ---------------- lighting & materials ---------------- */

vec3 skyCol(vec3 rd) {
	float y = max(rd.y, 0.);
	vec3 c = mix(vec3(.62, .68, .62), vec3(.78, .84, .8), y);
	c += .1 * n21(rd.xz / (rd.y + .25) * 1.5 + T * .01);
	return c;
}

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	vec3 n = calcN(p, d);
	vec3 c;
	float spec = .1, gloss = 12.;

	if (h.id == ID_GROUND) {
		float pathBand = smoothstep(.7, .9, p.z) * smoothstep(2.7, 2.5, p.z);
		float court = smoothstep(2.5, 2.7, p.z) * smoothstep(26.5, 26., p.z) * step(abs(p.x), 14.);
		// Grass / dirt.
		c = vec3(.22, .29, .18) * (.7 + .6 * n31(p * vec3(3., 1., 3.)));
		n = normalize(n + .12 * (vec3(n31(p * 9.1), 0., n31(p * 9.7)) - .25));
		// Concrete path with slab joints.
		vec3 path = vec3(.52, .52, .48) * (.9 + .2 * n21(floor(p.xz / vec2(1.2, .9)) * 3.7));
		path *= mix(.75, 1., smoothstep(.0, .06, abs(fract(p.x / 1.2) - .5) * 1.2));
		c = mix(c, path, pathBand);
		// Asphalt court + faded paint lines.
		vec3 asph = vec3(.20, .21, .21) * (.8 + .4 * n31(p * 5.));
		float lines = step(abs(abs(p.x) - 10.), .06) + step(abs(p.z - 5.), .06) * step(abs(p.x), 10.)
					+ step(abs(length(p.xz - vec2(0., 14.)) - 3.), .06);
		asph = mix(asph, vec3(.5, .48, .38), clamp(lines, 0., 1.) * .5);
		c = mix(c, asph, court);
		spec = mix(.05, .18, court + pathBand);
	} else if (h.id == ID_BENCH) {
		// Park-green painted slats, worn.
		c = vec3(.16, .26, .18) * (.8 + .4 * n31(h.uv * vec3(2., 8., 8.)));
		c = mix(c, vec3(.3, .24, .16), smoothstep(.55, .8, n31(h.uv * 13.))); // chipped to wood
		spec = .3;
		gloss = 20.;
	} else if (h.id == ID_IRON) {
		c = vec3(.13, .15, .13) * (.8 + .4 * n31(h.uv * 7.));
		// The wire trash drum: diamond mesh reads as punched darkening.
		if (abs(p.x + 2.1) < .5 && abs(p.z - 1.1) < .5 && p.y < .9) {
			float mesh = smoothstep(.2, .45, abs(fract((p.x + p.z) * 14.) - .5))
					   * smoothstep(.2, .45, abs(fract((p.x - p.z) * 14.) - .5));
			c *= .55 + .8 * mesh;
		}
		spec = .5;
		gloss = 30.;
	} else if (h.id == ID_TRUNK) {
		c = vec3(.23, .19, .15) * (.7 + .6 * n31(h.uv * vec3(6., 2., 6.)));
	} else if (h.id == ID_LEAF) {
		float v = n31(h.uv * 3.5 + T * .12);
		c = mix(vec3(.16, .24, .13), vec3(.34, .42, .22), v);
	} else if (h.id == ID_BIRD) {
		c = vec3(.28, .29, .33) * (.7 + .6 * n31(h.uv * 14.));
	} else {
		// City blocks: muted brick faces with a window grid.
		c = vec3(.34, .30, .27);
		vec2 wuv = fract(vec2(p.x + p.z, p.y) / vec2(1.6, 1.2));
		float win = step(.25, wuv.x) * step(wuv.x, .65) * step(.25, wuv.y) * step(wuv.y, .75);
		c = mix(c, vec3(.14, .16, .16), win * step(1.8, p.y));
	}

	// Overcast key from high behind-left + sky ambient + moving tree dapple.
	vec3 ld = normalize(vec3(-.35, .85, -.4));
	float dif = clamp(.25 + .75 * dot(n, ld), 0., 1.);
	float cover = canopyCover(p.xz);
	float dap = mix(1., .18 + .82 * smoothstep(.3, .78, n21(p.xz * 1.4 + vec2(T * .18, T * .07))), cover * step(p.y, 2.8));
	float occ = calcAO(p, n);

	vec3 sky = skyCol(reflect(rd, n));
	float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;

	vec3 col = c * (vec3(.85, .9, .84) * 1.35 * dif * dap * (.45 + .55 * occ)
			 + vec3(.33, .38, .36) * (.5 + .5 * n.y) * occ)
			 + sky * sp * occ;

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

	vec3 c = d < MAX_DIST ? shade(p, rd, d, h) : skyCol(rd);

	// Damp haze folds the city into the overcast — but leaves the park crisp.
	c = mix(c, vec3(.6, .66, .62), (1. - exp(-max(d - 6., 0.) * .012)) * .8);

	return c;
}

void main()
{
	T = uTime;

	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	col *= vec3(.95, 1.04, .97); // the Matrix's green grade, gently
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
