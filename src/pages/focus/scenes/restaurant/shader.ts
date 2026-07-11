import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * Le Vrai — the Merovingian's restaurant from Reloaded. Per the film and
 * this round's brief: a long, opulent French dining hall high in a tower —
 * marble colonnades, arched night windows down one wall with drapes,
 * chandeliers, rows of white-clothed round tables each with its own candle,
 * and the room *populated*: seated diners in evening black at the far
 * tables, gently animated. You have a table of your own, set for one.
 *
 * Layout: hall along z (x across, camera on the +x inner row at z=0 looking
 * -x across the aisle). Tables live on a folded grid: two rows per side
 * (inner ±2.35, outer ±5.55), z cells every 3.4m.
 *
 * Click: uDim 0..1 — the maître d' lowers the chandeliers and the room
 * drops to candlelight.
 */
export const RESTAURANT_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uDim; // 0 full service .. 1 candlelight

#define MIN_DIST   .002
#define MAX_DIST   45.0
#define MAX_STEPS  90.0
#define FL         1.428

#define ID_ROOM    1
#define ID_COLUMN  2
#define ID_CLOTH   3
#define ID_DINER   4
#define ID_FLAME   5
#define ID_WINDOW  6
#define ID_DRAPE   7
#define ID_WOOD    8
#define ID_SILVER  9
#define ID_GOLD    10
#define ID_CHINA   11
#define ID_CANDLE  12

#define HALL_X 7.0
#define HALL_Z_MIN -16.0
#define HALL_Z_MAX 10.0
#define HALL_H 5.2

float T;

/* ---------------- table grid ---------------- */

/* Nearest table cell for a point; returns center + a stable cell hash. */
void tableCell(vec3 p, out vec3 center, out vec2 id) {
	float side = sign(p.x + .0001);
	float row = abs(p.x) < 3.95 ? 2.35 : 5.55;
	float k = clamp(floor((p.z + 13.6) / 3.4 + .5), 0., 6.);
	center = vec3(side * row, 0., k * 3.4 - 13.6);
	id = vec2(side * row, k);
}

/* Is this the player's own table cell? (inner +x row, z=0) */
float isPlayerCell(vec2 id) {
	return step(abs(id.x - 2.35), .01) * step(abs(id.y - 4.), .01);
}

float flameFlicker(vec2 id) {
	return .75 + .45 * n21(vec2(T * 2.6, dot(id, vec2(3.1, 7.7))));
}

/* Tiny polar fold (local; the chandelier candle ring). */
vec2 opModPolarLite(vec2 p, float n) {
	float angle = 3.14159 / n;
	float a = mod(atan(p.y, p.x), 2. * angle) - angle;
	return length(p) * vec2(cos(a), sin(a));
}

/* One set table + seated diners, local to the cell center. */
Hit tableSet(vec3 q, vec2 id, float player) {
	vec2 hh = hash22(id * .317 + .719);

	// Tablecloth: cylinder with a draped flare to the floor.
	float flare = .06 * smoothstep(.25, .0, q.y);
	float ripple = .01 * sin(atan(q.z, q.x) * 11. + hh.x * 7.);
	float cloth = length(q.xz) - (.52 + flare + ripple * smoothstep(.5, .1, q.y));
	cloth = max(cloth, q.y - .74);
	// Soften the top rim.
	cloth = min(cloth, max(length(q.xz) - .5, abs(q.y - .73) - .012) - .008);
	Hit h = Hit(cloth * .85, ID_CLOTH, q);

	// Candle + flame.
	vec3 cq = q - vec3(.12, .74, -.08);
	minH(h, Hit(sdCyl(cq - vec3(0., .05, 0.), .05, .016), ID_CANDLE, q));
	float fl = flameFlicker(id);
	float flame = sdEll(cq - vec3(0., .135 + .006 * fl, 0.), vec3(.011, .026 * fl, .011));
	minH(h, Hit(flame, ID_FLAME, vec3(fl)));

	// Place settings: plates + glasses around the rim.
	for (int j = 0; j < 3; j++) {
		float fj = float(j);
		if (player > .5 && fj > 0.) break; // your table is set for one
		float ang = fj * 2.09 + hh.y * 6.28;
		vec2 dir = vec2(cos(ang), sin(ang));
		vec3 pq = q - vec3(dir.x * .3, .745, dir.y * .3);
		minH(h, Hit(sdCyl(pq, .006, .11), ID_CHINA, q));
		vec3 gq = q - vec3(dir.x * .18 - dir.y * .1, .79, dir.y * .18 + dir.x * .1);
		minH(h, Hit(sdCyl(gq, .05, .026), ID_SILVER, q)); // glass reads by its speculars
	}
	if (player > .5) {
		// Your own setting: knife + fork beside the plate.
		vec3 sq = q - vec3(.42, .745, .14);
		float cut = sdBox(sq, vec3(.008, .0015, .085));
		cut = min(cut, sdBox(q - vec3(.42, .745, -.02) - vec3(0., 0., 0.), vec3(.006, .0015, .07)));
		minH(h, Hit(cut, ID_SILVER, q));
	}

	// Diners in evening black (none at yours).
	if (player < .5) {
		float n = floor(hash22(id * .871 + .13).x * 3.2); // 0..3 guests
		for (int j = 0; j < 3; j++) {
			if (float(j) >= n) break;
			float ang = float(j) * 2.2 + hh.x * 6.28;
			vec2 dir = vec2(cos(ang), sin(ang));
			vec3 dq = q - vec3(dir.x * .85, 0., dir.y * .85);
			// Gentle conversational sway.
			float sway = sin(T * (.4 + .2 * hh.y) + float(j) * 2.7 + hh.x * 9.) * .045;
			dq.xz += sway * dir.yx * vec2(-1., 1.);
			// Torso leaning toward the table, head, one forearm on the cloth.
			vec3 lean = normalize(vec3(-dir.x * .22, 1., -dir.y * .22));
			float body = sdSeg(dq, vec3(0., .5, 0.), lean * .68 + vec3(0., .5, 0.), .17);
			body = smin(body, length(dq - (lean * .78 + vec3(0., .53, 0.))) - .1, .05);
			vec3 hand = vec3(-dir.x * .42, .76, -dir.y * .42);
			body = min(body, sdSeg(dq, lean * .55 + vec3(dir.y * .14, .48, -dir.x * .14), hand, .045));
			minH(h, Hit(body, ID_DINER, dq));
			// Chair back behind them.
			vec3 bq = dq - vec3(dir.x * .28, .62, dir.y * .28);
			minH(h, Hit(sdBox(bq, vec3(.19, .34, .028)) - .015, ID_WOOD, dq));
		}
	}

	return h;
}

/* ---------------- the hall ---------------- */

Hit map(vec3 p) {
	// Hall cavity + arched window recesses along the -x wall.
	float air = max(abs(p.x) - HALL_X,
				max(p.y - HALL_H, -p.y));
	air = max(air, max(HALL_Z_MIN - p.z, p.z - HALL_Z_MAX));

	float wz = mod(p.z + 2.6, 5.2) - 2.6;
	vec3 aq = vec3(p.x + HALL_X + .1, p.y, wz);
	// Arched window recess: a box up to the springline, a half-cylinder top.
	float arch = min(sdBox(aq - vec3(0., 1.6, 0.), vec3(.35, 1.6, .95)),
			   max(length(vec2(aq.y - 3.2, aq.z)) - .95, abs(aq.x) - .35));
	Hit h = Hit(-min(air, arch) * .8, ID_ROOM, p);

	// Colonnades: fluted columns with base + capital, beams overhead.
	vec3 colq = vec3(abs(p.x) - 4.3, p.y, mod(p.z + 2.6, 5.2) - 2.6);
	float flute = .005 * abs(sin(atan(colq.z, colq.x) * 12.));
	float col = sdCyl(colq - vec3(0., 2.3, 0.), 1.75, .28 - flute);
	col = min(col, sdCyl(colq - vec3(0., .3, 0.), .3, .38) - .02);
	col = min(col, sdCyl(colq - vec3(0., 4.25, 0.), .22, .4) - .02);
	col = max(col, p.z - HALL_Z_MAX + .8); // stop the repeat at the far end
	minH(h, Hit(col, ID_COLUMN, colq));
	float beam = sdBox(vec3(p.x, p.y - 4.7, mod(p.z + 2.6, 5.2) - 2.6), vec3(HALL_X, .22, .3)) - .02;
	minH(h, Hit(beam, ID_ROOM, p));

	// Drapes flanking each arch.
	vec3 drq = vec3(p.x + HALL_X - .28, p.y - 2.1, abs(wz) - 1.25);
	float fold = .04 * sin(p.y * 6. + wz * 3.);
	float drape = sdBox(drq, vec3(.14 + fold, 2.1, .22));
	minH(h, Hit(drape * .8, ID_DRAPE, p));

	// Chandeliers on the center line.
	float zc = clamp(floor((p.z + 2.5) / 6.5 + .5), -1., 1.) * 6.5 - 2.5;
	vec3 chq = vec3(p.x, p.y, p.z - zc);
	float chb = length(chq - vec3(0., 4.15, 0.)) - .9;
	if (chb < .4) {
		float ring = length(vec2(length(chq.xz) - .52, chq.y - 4.0)) - .045;
		float ring2 = length(vec2(length(chq.xz) - .3, chq.y - 4.28)) - .035;
		float stem = sdCyl(chq - vec3(0., 4.7, 0.), .5, .025);
		minH(h, Hit(min(min(ring, ring2), stem), ID_GOLD, chq));
		// Candle points on the rings.
		vec2 rq = opModPolarLite(chq.xz, 8.);
		float cnd = sdCyl(vec3(rq.x - .52, chq.y - 4.08, rq.y), .07, .015);
		minH(h, Hit(cnd, ID_CANDLE, chq));
		float cfl = sdEll(vec3(rq.x - .52, chq.y - 4.19, rq.y), vec3(.012, .028, .012));
		minH(h, Hit(cfl, ID_FLAME, vec3(flameFlicker(vec2(zc, 1.)))));
	} else {
		minH(h, Hit(chb, ID_GOLD, chq));
	}

	// Tables (nearest cell), bounded.
	vec3 tc;
	vec2 tid;
	tableCell(p, tc, tid);
	float player = isPlayerCell(tid);
	float exists = step(hash22(tid * .531 + .277).y, .88) + player;
	if (exists > .5) {
		vec3 q = p - tc;
		float bb = length(q - vec3(0., .7, 0.)) - 1.55;
		if (bb < .4) {
			minH(h, tableSet(q, tid, player));
		} else {
			minH(h, Hit(bb, ID_CLOTH, q));
		}
	}

	return h;
}

/* ---------------- lighting ---------------- */

vec3 chandelierLight(vec3 p, vec3 n, vec3 rd, float spec, float gloss) {
	vec3 warm = vec3(1., .74, .45);
	vec3 acc = vec3(0);
	float lvl = mix(2.0, .35, uDim);
	for (int i = 0; i < 3; i++) {
		vec3 lp = vec3(0., 4.0, float(i - 1) * 6.5 - 2.5);
		vec3 ld = lp - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		float dif = clamp(.08 + .92 * dot(n, ld), 0., 1.);
		float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;
		acc += (dif + sp) * warm * lvl / (1. + d2 * .13);
	}
	// Nearest table candle: a small warm pool that owns the dim scenes.
	vec3 tc;
	vec2 tid;
	tableCell(p, tc, tid);
	vec3 cp = tc + vec3(.12, .88, -.08);
	vec3 ld = cp - p;
	float d2 = dot(ld, ld);
	ld *= inversesqrt(d2);
	float fl = flameFlicker(tid);
	acc += vec3(1., .62, .3) * fl * mix(.5, 1.15, uDim) * clamp(dot(n, ld), 0., 1.) / (1. + d2 * 3.5);
	return acc;
}

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	if (h.id == ID_FLAME) {
		float fl = h.uv.x;
		return mix(vec3(1., .45, .1), vec3(1., .85, .5), .5 + .3 * fl) * 5. * fl;
	}
	if (h.id == ID_WINDOW) return vec3(0);

	vec3 n = calcN(p, d);
	float spec = .2, gloss = 24.;
	vec3 c;

	if (h.id == ID_ROOM) {
		if (p.y < .02) {
			// Deep red carpet with a woven motif + gold aisle border.
			vec2 cu = p.xz * .55;
			float motif = smoothstep(.4, .6, n21(floor(cu) * 3.7)) * .5
						+ smoothstep(.35, .65, abs(fract(cu.x + cu.y) - .5)) * .5;
			c = mix(vec3(.23, .05, .05), vec3(.32, .09, .07), motif);
			c *= .85 + .3 * n31(p * 15.); // pile
			float border = step(abs(abs(p.x) - 1.35), .05);
			c = mix(c, vec3(.45, .32, .12), border * .7);
			spec = .04;
		} else if (p.y > HALL_H - .35 || abs(n.y) > .8 && p.y > 4.) {
			// Coffered ceiling.
			vec2 cf = fract(p.xz / 1.3) - .5;
			float coffer = smoothstep(.32, .42, max(abs(cf.x), abs(cf.y)));
			c = mix(vec3(.5, .42, .3), vec3(.62, .54, .4), coffer);
		} else {
			// Warm panelled walls: cream above a dark wainscot, gold cornice.
			c = vec3(.55, .46, .34) * (.92 + .12 * n31(p * 2.));
			if (p.y < 1.1) c = vec3(.24, .15, .09) * (.85 + .3 * n31(p * vec3(1., 6., 1.)));
			if (abs(p.y - 4.55) < .08) c = vec3(.5, .36, .14);
			spec = .25;
		}
	} else if (h.id == ID_COLUMN) {
		// Warm marble: veined, polished.
		float vein = smoothstep(.45, .55, n31(h.uv * vec3(2., .7, 2.) + n31(h.uv * 5.) * .8));
		c = mix(vec3(.45, .40, .33), vec3(.3, .25, .2), vein);
		spec = .8;
		gloss = 50.;
	} else if (h.id == ID_CLOTH) {
		c = vec3(.72, .69, .62) * (.9 + .15 * n31(h.uv * 18.));
		spec = .06;
	} else if (h.id == ID_DINER) {
		c = vec3(.045, .04, .045) * (.8 + .4 * n31(h.uv * 8.));
		// A hint of skin at the head height.
		if (h.uv.y > 1.2) c = vec3(.35, .24, .17);
		spec = .15;
	} else if (h.id == ID_DRAPE) {
		c = vec3(.17, .045, .045) * (.7 + .55 * abs(sin(p.y * 6. + p.z * 3.)));
		spec = .12;
	} else if (h.id == ID_WOOD) {
		c = vec3(.2, .12, .07) * (.8 + .4 * n31(h.uv * 12.));
		spec = .3;
	} else if (h.id == ID_SILVER) {
		c = vec3(.35, .36, .37);
		spec = 2.2;
		gloss = 90.;
	} else if (h.id == ID_GOLD) {
		c = vec3(.42, .3, .1);
		spec = 1.6;
		gloss = 60.;
	} else if (h.id == ID_CHINA) {
		c = vec3(.72, .7, .66);
		spec = .9;
		gloss = 70.;
	} else {
		c = vec3(.68, .64, .55); // candle wax
		spec = .3;
	}

	float occ = calcAO(p, n);
	vec3 lit = chandelierLight(p, n, rd, spec, gloss);
	// Cool spill from the night windows on the -x side.
	float winFill = clamp(dot(n, vec3(1., .2, 0.)), 0., 1.) * smoothstep(0., -6., p.x);
	lit += vec3(.2, .28, .4) * winFill * .5;

	vec3 amb = mix(vec3(.085, .06, .042), vec3(.04, .028, .022), uDim);
	return c * (amb * occ + lit * (.4 + .6 * occ));
}

/* Analytic halo (same trick as the bridge lamps). */
float rayHalo(vec3 ro, vec3 rd, vec3 lp, float maxD) {
	vec3 w = lp - ro;
	float t = clamp(dot(w, rd), 0., maxD);
	vec3 q = w - rd * t;
	return step(.01, t) / (.06 + dot(q, q));
}

vec3 march(vec3 ro, vec3 rd) {
	vec3 p;
	float d = .01;
	Hit h;
	for (float i = 0.; i < MAX_STEPS; i++) {
		p = ro + rd * d;
		h = map(p);
		if (abs(h.d) < MIN_DIST || d > MAX_DIST) break;
		d += h.d;
	}

	vec3 c;
	if (d < MAX_DIST) {
		// The window recesses show the night city instead of a wall hit.
		if (p.x < -HALL_X - .05) {
			vec2 wuv = vec2(p.z * 4., p.y * 4.);
			float dot1 = step(.94, hash22(floor(wuv) * .391).x) * hash22(floor(wuv) * .173).y;
			c = mix(vec3(.02, .035, .06), vec3(.05, .07, .1), smoothstep(0., 4., p.y));
			c += vec3(1., .75, .4) * dot1 * .9;
			// Window frame bars.
			vec2 wf = abs(fract(vec2(p.z / .95, p.y / 1.05)) - .5);
			c *= mix(.25, 1., smoothstep(.02, .05, min(wf.x, wf.y)));
		} else {
			c = shade(p, rd, d, h);
		}
	} else {
		c = vec3(.01, .015, .02);
	}

	// Warm haze + chandelier and candle halos.
	c = mix(c, mix(vec3(.05, .032, .02), vec3(.018, .012, .009), uDim), 1. - exp(-d * .022));
	float lvl = mix(1., .3, uDim);
	for (int i = 0; i < 3; i++) {
		c += vec3(1., .7, .4) * .05 * lvl * rayHalo(ro, rd, vec3(0., 4.05, float(i - 1) * 6.5 - 2.5), d);
	}
	c += vec3(1., .55, .25) * .012 * mix(1., 1.8, uDim) * rayHalo(ro, rd, vec3(2.47, .88, -.08), d);

	return c;
}

void main()
{
	T = uTime;

	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	col *= vec3(1.03, .96, .87) * .92; // candlelit gold, held dark
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
