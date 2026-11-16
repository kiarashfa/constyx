import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * Tea house — Seraph's upstairs room in Chinatown (Reloaded), before the
 * furniture gets broken. Per the film's staging: white-painted walls, ten
 * square paper windows (five along each side wall) throwing soft diffuse
 * daylight, six rectangular bench tables in two rows of three, cups and
 * bowls with chopsticks on the tables, dark timber posts and beams, plank
 * floor. You sit at the middle table of the east row, tea set for two.
 * Click to light the incense: sandalwood smoke curls up and the light warms.
 *
 * Layout: x across (viewer on the +x/east row looking -x), z along the hall
 * (door at -z, counter at +z), y up. Windows at z = -5.6..5.6 every 2.8m on
 * both x=±4.2 walls.
 */
export const TEA_HOUSE_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uIncense; // 0 clear air .. 1 lit stick, warm haze

#define MIN_DIST   .002
#define MAX_DIST   40.0
#define MAX_STEPS  80.0
#define FL         1.428

#define ID_WALL    1
#define ID_FLOOR   2
#define ID_WOOD    3
#define ID_PAPER   4
#define ID_POT     5
#define ID_CUP     6
#define ID_DOOR    7
#define ID_SHELF   8

float T;
vec2 g = vec2(0); // x: smoke ribbons, y: window haze bloom

/* Incense + teapot steam: wavering vertical ribbons, accumulated as glow. */
void smokeRibbons(vec3 p) {
	// Incense on the table's far end (uniform-gated).
	float rise = p.y - .82;
	if (rise > 0. && rise < 2.2 && uIncense > .01) {
		float cx = 2.28 + sin(rise * 4.2 + T * 1.1) * .07 * rise;
		float cz = -.62 + cos(rise * 3.1 + T * .8) * .06 * rise;
		float d = length(vec2(p.x - cx, p.z - cz));
		float env = smoothstep(0., .15, rise) * smoothstep(2.2, 1.2, rise);
		g.x += uIncense * env * .0016 / (.004 + d * d);
	}
	// Steam off the teapot, always faintly there.
	rise = p.y - .89;
	if (rise > 0. && rise < .9) {
		float cx = 2.18 + sin(rise * 6. + T * 1.7) * .05 * rise;
		float d = length(vec2(p.x - cx, p.z - .52));
		g.x += .35 * smoothstep(0., .1, rise) * smoothstep(.9, .4, rise) * .0009 / (.004 + d * d);
	}
	// Window-proximity bloom (reads as hanging haze when the incense burns).
	float wy = smoothstep(.9, 1.4, p.y) * smoothstep(2.7, 2.2, p.y);
	float wz = abs(mod(p.z + 1.4, 2.8) - 1.4);
	float dw = max(4.2 - abs(p.x), 0.) + max(wz - .7, 0.) * 2. + (1. - wy) * 3.;
	g.y += (.25 + .75 * uIncense) * .002 / (.15 + dw * dw);
}

/* One bench table + its two benches, local to the table center. */
float sdTableSet(vec3 q) {
	float bb = sdBox(q - vec3(0., .45, 0.), vec3(1.1, .5, 1.1));
	if (bb > .5) return bb;
	float d = sdBox(q - vec3(0., .74, 0.), vec3(.35, .022, .9)) - .008; // top
	vec3 lq = vec3(q.x, q.y, abs(q.z) - .72);
	d = min(d, sdBox(lq - vec3(0., .36, 0.), vec3(.3, .36, .03)) - .008); // trestles
	d = min(d, sdBox(q - vec3(0., .18, 0.), vec3(.28, .02, .7))); // stretcher
	vec3 sq = vec3(abs(q.x) - .62, q.y, q.z);
	float bench = sdBox(sq - vec3(0., .44, 0.), vec3(.14, .018, .8)) - .006;
	vec3 blq = vec3(sq.x, sq.y, abs(sq.z) - .62);
	bench = min(bench, sdBox(blq - vec3(0., .21, 0.), vec3(.1, .21, .025)));
	return min(d, bench);
}

Hit map(vec3 p) {
	smokeRibbons(p);

	// The hall: room cavity + window recesses carved into the side walls.
	float room = max(sdBox(p - vec3(0., 1.6, 0.), vec3(4.2, 1.6, 7.)), -p.y);
	// Window recesses (5 per side): repeated along z, sunk .16 into the wall.
	float wz = mod(p.z + 1.4, 2.8) - 1.4;
	vec3 wq = vec3(abs(p.x) - 4.28, p.y - 1.8, wz);
	float recess = sdBox(wq, vec3(.16, .68, .68));
	// Door recess at the -z end.
	float door = sdBox(vec3(p.x, p.y - 1.15, p.z + 7.06), vec3(.8, 1.15, .14));
	float air = min(room, min(recess, door));
	Hit h = Hit(-air, ID_WALL, p);

	// Timber posts between windows + ceiling beams.
	vec3 pq = vec3(abs(p.x) - 4.14, p.y - 1.6, mod(p.z, 2.8) - 1.4);
	float post = max(sdBox(pq, vec3(.07, 1.6, .07)), abs(p.z) - 7.1);
	vec3 bq = vec3(p.x, p.y - 3.06, mod(p.z, 2.8) - 1.4);
	post = min(post, max(sdBox(bq, vec3(4.2, .09, .07)), abs(p.z) - 7.1));
	minH(h, Hit(post, ID_WOOD, p));

	// Two rows of three tables.
	vec3 tq = vec3(abs(p.x) - 2.3, p.y, p.z - 4.2 * clamp(floor(p.z / 4.2 + .5), -1., 1.));
	minH(h, Hit(sdTableSet(tq), ID_WOOD, tq));

	// Tea service on your table (east row, z=0).
	float sb = length(p - vec3(2.25, .85, 0.)) - .75;
	if (sb < .3) {
		vec3 q = p - vec3(2.18, .81, .52);
		float pot = sdEll(q, vec3(.068, .055, .068));
		pot = smin(pot, sdSeg(q, vec3(.04, .015, .0), vec3(.095, .04, .0), .013), .018);
		pot = min(pot, sdCyl(q - vec3(0., .06, 0.), .01, .017));
		minH(h, Hit(pot, ID_POT, q));
		vec3 cq = p - vec3(2.34, .785, -.12);
		float cups = sdCyl(cq, .032, .034);
		cups = min(cups, sdCyl(p - vec3(2.16, .785, -.3), .032, .034));
		cups = max(cups, -sdCyl(cq - vec3(0., .02, 0.), .032, .027));
		minH(h, Hit(cups, ID_CUP, p));
		// Bowl with chopsticks.
		float bowl = max(length(p - vec3(2.42, .74, .18)) - .06, p.y - .795);
		bowl = max(bowl, -(length(p - vec3(2.42, .75, .18)) - .05));
		minH(h, Hit(bowl, ID_CUP, p));
		float sticks = sdSeg(p, vec3(2.34, .79, .10), vec3(2.52, .805, .27), .0035);
		sticks = min(sticks, sdSeg(p, vec3(2.36, .79, .085), vec3(2.54, .805, .245), .0035));
		minH(h, Hit(sticks, ID_WOOD, p));
		// Incense holder.
		float inc = sdCyl(p - vec3(2.28, .795, -.62), .02, .025);
		inc = min(inc, sdSeg(p, vec3(2.28, .81, -.62), vec3(2.29, .95, -.63), .003));
		minH(h, Hit(inc, ID_POT, p));
	} else {
		minH(h, Hit(sb, ID_POT, p));
	}

	// Counter + shelf wall at the +z end.
	float counter = sdBox(p - vec3(0., .5, 6.55), vec3(1.6, .5, .35)) - .01;
	counter = min(counter, sdBox(p - vec3(0., 2.1, 6.93), vec3(1.8, .9, .06)));
	vec3 shq = vec3(mod(p.x + .4, .8) - .4, p.y - 2.05, p.z - 6.86);
	counter = min(counter, max(sdCyl(shq - vec3(0., 0., 0.), .11, .07), abs(p.x) - 1.6));
	minH(h, Hit(counter, ID_SHELF, p));

	return h;
}

/* ---------------- lighting & materials ---------------- */

/* Nearest paper window on each side wall acts as a soft area light. */
vec3 windowLight(vec3 p, vec3 n, vec3 rd, float spec, float gloss) {
	vec3 acc = vec3(0);
	vec3 wcol = mix(vec3(1., .99, .96), vec3(1., .9, .78), uIncense * .5) * 2.3;
	for (int s = 0; s < 2; s++) {
		float side = s == 0 ? 4.2 : -4.2;
		float k = clamp(floor(p.z / 2.8 + .5), -2., 2.);
		vec3 lp = vec3(side * .93, 1.8, k * 2.8);
		vec3 ld = lp - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		float dif = clamp(.15 + .85 * dot(n, ld), 0., 1.);
		float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;
		acc += (dif + sp) * wcol / (1. + d2 * .22);
	}
	return acc;
}

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	// Paper windows: emissive, with dark muntin bars (3x3 lattice).
	if (h.id == ID_WALL && abs(p.x) > 4.2 && abs(p.y - 1.8) < .72 && p.y > 1.05) {
		float wz = mod(p.z + 1.4, 2.8) - 1.4;
		if (abs(wz) < .72) {
			vec2 wuv = vec2(wz, p.y - 1.8) / .68;
			float bars = min(abs(fract(wuv.x * 2. + .5) - .5), abs(fract(wuv.y * 2. + .5) - .5));
			float lattice = smoothstep(.02, .05, bars * .5);
			vec3 paper = mix(vec3(1., .99, .95), vec3(1., .93, .8), uIncense * .4);
			float glow = 2.4 * (1. - .12 * n21(wuv * 9.)); // fibrous paper
			return mix(vec3(.1, .08, .06), paper * glow, lattice);
		}
	}

	vec3 n = calcN(p, d);
	float spec = .15, gloss = 16.;
	vec3 c;

	if (h.id == ID_WALL) {
		if (p.y < .02) {
			// Plank floor, boards running the length of the hall — greyer than
			// the furniture so the two never read as one material.
			float board = floor(p.x / .16);
			c = vec3(.27, .23, .18) * (.75 + .35 * n21(vec2(board * 7.7, floor(p.z / 2.6))));
			c *= mix(.65, 1., smoothstep(.0, .12, abs(fract(p.x / .16) - .5) * 2.));
			c *= .85 + .3 * n31(vec3(p.x * 3., 0., p.z * .6));
			spec = .4;
			gloss = 30.;
		} else if (p.y > 3.18) {
			c = vec3(.2, .16, .12); // dark plank ceiling
		} else {
			// White plaster, gently aged.
			c = vec3(.85, .84, .79) * (.92 + .1 * n31(p * 2.2));
			c *= .92 + .08 * n31(p * vec3(.6, 4., .6)); // faint streaks
			spec = .05;
		}
	} else if (h.id == ID_WOOD) {
		c = vec3(.28, .18, .10) * (.75 + .5 * n31(h.uv * vec3(3., 24., 3.)));
		spec = .45;
		gloss = 30.;
	} else if (h.id == ID_POT) {
		c = vec3(.22, .13, .09); // dark yixing clay
		spec = .5;
		gloss = 40.;
	} else if (h.id == ID_CUP) {
		c = vec3(.48, .54, .47); // celadon
		spec = .45;
		gloss = 50.;
	} else if (h.id == ID_DOOR) {
		c = vec3(.22, .15, .1);
		spec = .2;
	} else {
		c = vec3(.32, .24, .16) * (.8 + .4 * n31(p * 5.)); // counter/shelf wood
		spec = .3;
	}

	float occ = calcAO(p, n);
	vec3 lit = windowLight(p, n, rd, spec, gloss);
	vec3 amb = mix(vec3(.22, .22, .21), vec3(.24, .2, .16), uIncense * .5);
	vec3 col = c * (amb * occ + lit * (.45 + .55 * occ));

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

	vec2 gg = g;

	vec3 c = d < MAX_DIST ? shade(p, rd, d, h) : vec3(0);

	// Gentle interior air fade.
	c = mix(c, vec3(.5, .48, .42), (1. - exp(-d * .03)) * .25);

	// Smoke + window haze.
	c += gg.x * vec3(.65, .6, .55);
	c += gg.y * mix(vec3(.7, .72, .7), vec3(.85, .7, .5), uIncense) * .5;

	return c;
}

void main()
{
	T = uTime;

	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	col *= mix(vec3(1.0, 1.0, .97), vec3(1.05, .99, .9), uIncense * .6); // warms as the stick burns
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
