import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * MetaCortex — Neo's cubicle, 1999. Period grammar per the film's opening:
 * tall grey-olive fabric partitions (no modern open plan), drop ceiling with
 * fluorescent troffers, beige CRT + keyboard + desk phone + paper stacks,
 * carpet tiles. Per this round's brief the big exterior window sits on the
 * cubicle's one open side, with the two window cleaners on a suspended
 * scaffold outside working their squeegee strokes through the soap — the
 * scene's ambient life. City towers haze off beyond.
 *
 * Layout: viewer seated at the desk facing +z; partitions close off -z, -x,
 * +x; window wall at z~5.6; scaffold at z~6.3; city z 30+.
 *
 * The glass is not geometry: the window is a hole in the wall, and march()
 * analytically intersects the glass plane, compositing soap/drips/squeegee
 * wipe over whatever was hit beyond it.
 */
export const OFFICE_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uScreen; // 0 spreadsheet .. 1 the glyph-rain screensaver
uniform sampler2D uCrt;

#define MIN_DIST   .002
#define MAX_DIST   150.0
#define MAX_STEPS  90.0
#define FL         1.428

#define ID_FLOOR   1
#define ID_CEIL    2
#define ID_PART    3
#define ID_DESK    4
#define ID_CRT     5
#define ID_SCREEN  6
#define ID_PLASTIC 7
#define ID_PAPER   8
#define ID_METAL   9
#define ID_CLEANER 10
#define ID_CITY    11
#define ID_WALL    12
#define ID_MUG     13

float T;

/* ---------------- window cleaners ---------------- */

/* Squeegee stroke: 7s cycle — wipe down, lift, shift to the next column. */
void squeegeeState(out float xc, out float yBlade, out float press) {
	float cyc = floor(T / 7.);
	float ph = fract(T / 7.);
	float col0 = mod(cyc, 3.) - 1.;      // -1, 0, 1
	float col1 = mod(cyc + 1., 3.) - 1.;
	float shift = smoothstep(.38, .58, ph);
	xc = -.4 + mix(col0, col1, shift) * .7;
	// Blade rides down the pane, then returns up while shifting over.
	float down = smoothstep(.02, .36, ph);
	float up = smoothstep(.42, .6, ph);
	yBlade = mix(2.05, 1.15, down) + (2.05 - 1.15) * up;
	press = smoothstep(.0, .04, ph) * (1. - smoothstep(.36, .42, ph)); // against glass mid-wipe
}

float sdCleanerA(vec3 p) {
	float xc, yB, press;
	squeegeeState(xc, yB, press);
	vec3 q = p - vec3(-.4, .58, 6.32); // standing on the platform
	float d = sdSeg(q, vec3(0., .0, 0.), vec3(-.07, .5, 0.), .09);          // legs
	d = min(d, sdSeg(q, vec3(.07, 0., 0.), vec3(.07, .5, 0.), .09));
	d = smin(d, sdSeg(q, vec3(0., .55, 0.), vec3(0., 1.05, 0.), .17), .06); // torso
	d = smin(d, length(q - vec3(0., 1.28, 0.)) - .11, .04);                 // head
	d = min(d, sdSeg(q, vec3(-.19, 1., 0.), vec3(-.24, .55, .08), .05));    // rest arm
	// Working arm reaches the blade on the glass.
	vec3 hand = vec3(xc + .4, yB - .58 + .06, -.42); // to body-local
	vec3 elbow = mix(vec3(.22, .95, 0.), hand, .45) + vec3(.1, .05, .12);
	d = min(d, sdSeg(q, vec3(.19, 1.02, 0.), elbow, .05));
	d = min(d, sdSeg(q, elbow, hand, .045));
	// Squeegee: handle + blade against the pane.
	vec3 g = p - vec3(xc, yB, 5.92);
	d = min(d, sdSeg(g, vec3(.0, .06, .12), vec3(0., 0., 0.), .02));
	d = min(d, sdBox(g, vec3(.26, .015, .02)));
	return d;
}

float sdCleanerB(vec3 p) {
	// Second cleaner: slow circular sponge scrub, off to the right.
	vec3 q = p - vec3(1.45, .58, 6.32);
	float d = sdSeg(q, vec3(-.07, 0., 0.), vec3(-.07, .5, 0.), .09);
	d = min(d, sdSeg(q, vec3(.07, 0., 0.), vec3(.07, .5, 0.), .09));
	d = smin(d, sdSeg(q, vec3(0., .55, 0.), vec3(0., 1.08, 0.), .18), .06);
	d = smin(d, length(q - vec3(0., 1.31, 0.)) - .11, .04);
	d = min(d, sdSeg(q, vec3(-.2, 1.02, 0.), vec3(-.26, .6, .05), .05));
	vec2 scrub = vec2(cos(T * 1.3), sin(T * 1.3)) * .22;
	vec3 hand = vec3(.25 + scrub.x, 1.35 + scrub.y, -.42);
	vec3 elbow = mix(vec3(.2, 1., 0.), hand, .5) + vec3(.12, 0., .1);
	d = min(d, sdSeg(q, vec3(.2, 1.02, 0.), elbow, .05));
	d = min(d, sdSeg(q, elbow, hand, .045));
	d = min(d, length(q - hand - vec3(0., 0., -.05)) - .09); // sponge
	return d;
}

/* ---------------- soap on the glass ---------------- */

float suds(vec2 g) {
	float xc, yB, press;
	squeegeeState(xc, yB, press);
	// Soap film patches + slow drips.
	float a = smoothstep(.33, .75, n21(g * vec2(1.5, 2.1) + vec2(0., T * .012))) * .55;
	a += smoothstep(.72, .95, n21(vec2(g.x * 12., g.y * .6 - T * .05))) * .28;
	// The stroke's column is wiped clean above the blade.
	float inCol = smoothstep(.3, .24, abs(g.x - xc));
	a *= mix(1., .08, inCol * smoothstep(yB - .06, yB + .02, g.y) * press);
	// Squeegee water line just under the blade.
	a += inCol * smoothstep(.05, .0, abs(g.y - yB + .04)) * press * .5;
	return clamp(a, 0., 1.);
}

/* ---------------- the office ---------------- */

Hit map(vec3 p) {
	// Floor & ceiling slabs — bounded to the interior so they don't float
	// past the window over the city.
	Hit h = Hit(max(p.y, p.z - 5.72), ID_FLOOR, p);
	minH(h, Hit(max(2.7 - p.y, p.z - 5.72), ID_CEIL, p));

	// Cubicle partitions: -z behind, ±x sides; open side faces the window.
	vec3 pq = vec3(p.x, p.y - .78, p.z + 1.38);
	float part = sdBox(pq, vec3(1.5, .78, .028)) - .012;
	pq = vec3(abs(p.x) - 1.48, p.y - .78, p.z - .05);
	part = min(part, sdBox(pq, vec3(.028, .78, 1.45)) - .012);
	// Neighboring rows of partition tops, receding behind (z < -2.6 only).
	vec3 rq = vec3(p.x, p.y - .78, mod(p.z + 4.6, 3.2) - 1.6);
	part = min(part, max(sdBox(rq, vec3(17., .78, .03)) - .012, p.z + 2.6));
	minH(h, Hit(part, ID_PART, p));

	// Desk: work surface + side panels, facing the window.
	float db = sdBox(p - vec3(0., .5, .95), vec3(1.4, .55, .45));
	if (db < .5) {
		float desk = sdBox(p - vec3(0., .71, .92), vec3(1.32, .018, .42)) - .006;
		vec3 sq = vec3(abs(p.x) - 1.28, p.y - .36, p.z - .92);
		desk = min(desk, sdBox(sq, vec3(.02, .36, .4)));
		minH(h, Hit(desk, ID_DESK, p));

		// CRT monitor, square in front of the seat.
		vec3 mq = p - vec3(.35, .74, 1.16);
		mq.xz *= rot(-.12);
		float crt = sdBox(mq - vec3(0., .21, .04), vec3(.17, .18, .17)) - .02;
		crt = min(crt, sdBox(mq - vec3(0., .015, 0.), vec3(.13, .02, .13)) - .008);
		minH(h, Hit(crt, ID_CRT, mq));
		// Screen face (slightly proud, bulged).
		float scr = sdEll(mq - vec3(0., .21, -.15), vec3(.135, .12, .045));
		minH(h, Hit(scr, ID_SCREEN, mq));

		// Keyboard, phone, papers, mug.
		vec3 kq = p - vec3(-.12, .735, .68);
		kq.xz *= rot(.06);
		minH(h, Hit(sdBox(kq, vec3(.21, .012, .08)) - .006, ID_PLASTIC, kq));
		vec3 phq = p - vec3(-.88, .755, 1.05);
		float phone = sdBox(phq, vec3(.11, .025, .13)) - .01;
		phone = min(phone, sdBox(phq - vec3(0., .045, -.02), vec3(.085, .018, .028)) - .012);
		minH(h, Hit(phone, ID_PLASTIC, phq));
		minH(h, Hit(sdBox(p - vec3(-.45, .75, 1.16), vec3(.14, .028, .1)), ID_PAPER, p));
		minH(h, Hit(sdBox(p - vec3(.02, .76, 1.18), vec3(.12, .04, .09)), ID_PAPER, p));
		minH(h, Hit(sdCyl(p - vec3(1.0, .77, .78), .055, .04), ID_MUG, p));
	} else {
		minH(h, Hit(db, ID_DESK, p));
	}

	// Perimeter induction unit under the window — 1999 tower furniture.
	float hvac = sdBox(p - vec3(0., .3, 5.32), vec3(20., .31, .19)) - .015;
	minH(h, Hit(hvac, ID_CRT, p)); // beige metal, same palette as the monitor shell

	// Window wall: spandrel below, header above, mullions through the hole.
	float wall = sdBox(p - vec3(0., .42, 5.72), vec3(20., .43, .13));
	wall = min(wall, sdBox(p - vec3(0., 2.63, 5.72), vec3(20., .08, .13)));
	wall = min(wall, sdBox(vec3(abs(p.x) - 14., p.y - 1.7, p.z - 5.72), vec3(6., .86, .13)));
	minH(h, Hit(wall, ID_WALL, p));
	vec3 mq2 = vec3(mod(p.x + .8, 1.6) - .8, p.y - 1.7, p.z - 5.72);
	float mull = max(sdBox(mq2, vec3(.035, .86, .1)), abs(p.x) - 8.);
	mull = min(mull, max(sdBox(vec3(p.x, p.y - 1.72, p.z - 5.72), vec3(8., .025, .1)), 0.));
	minH(h, Hit(mull, ID_METAL, p));

	// Back and side walls of the floor.
	minH(h, Hit(sdBox(p - vec3(0., 1.35, -14.), vec3(20., 1.35, .2)), ID_WALL, p));
	minH(h, Hit(sdBox(vec3(abs(p.x) - 19., p.y - 1.35, p.z + 4.2), vec3(.2, 1.35, 10.)), ID_WALL, p));

	// Scaffold outside: platform, rails, cables.
	float scb = sdBox(p - vec3(.5, 1.2, 6.35), vec3(3.4, 1.4, .6));
	if (scb < .6) {
		float plat = sdBox(p - vec3(.5, .55, 6.35), vec3(3.2, .035, .45)) - .01;
		vec3 sq2 = vec3(abs(p.x - .5) - 3.1, p.y, p.z - 6.35);
		plat = min(plat, sdBox(sq2 - vec3(0., .9, 0.), vec3(.025, .55, .025)));
		plat = min(plat, sdBox(p - vec3(.5, 1.42, 6.75), vec3(3.2, .02, .02)));
		plat = min(plat, sdBox(p - vec3(.5, 1.42, 5.98), vec3(3.2, .02, .02)));
		minH(h, Hit(plat, ID_METAL, p));
		minH(h, Hit(min(sdCleanerA(p), sdCleanerB(p)), ID_CLEANER, p));
	} else {
		minH(h, Hit(scb, ID_METAL, p));
	}
	// Cables up past the header.
	vec3 cq = vec3(abs(p.x - .5) - 2.9, p.y, p.z - 6.6);
	minH(h, Hit(max(length(cq.xz) - .015, -(p.y - .55)), ID_METAL, p));

	// City towers, far below-haze.
	float city = sdBox(p - vec3(-14., 6., 42.), vec3(7., 16., 7.));
	city = min(city, sdBox(p - vec3(6., 2., 55.), vec3(8., 14., 8.)));
	city = min(city, sdBox(p - vec3(24., 8., 46.), vec3(6., 18., 6.)));
	city = min(city, sdBox(p - vec3(-2., -2., 78.), vec3(26., 20., 10.)));
	minH(h, Hit(city, ID_CITY, p));

	return h;
}

/* ---------------- lighting & materials ---------------- */

vec3 troffers(vec3 p, vec3 n, vec3 rd, float spec, float gloss) {
	// Fluorescent grid: nearest two ceiling cells (2.6m pitch).
	vec3 acc = vec3(0);
	vec2 k0 = clamp(floor(p.xz / 2.6 + .5), vec2(-6., -6.), vec2(6., 2.));
	for (int j = 0; j < 2; j++) {
		vec2 k = j == 0 ? k0 : clamp(k0 + vec2(0., sign(p.z - k0.y * 2.6 + .001)), vec2(-6., -6.), vec2(6., 2.));
		if (j == 1 && k == k0) break;
		vec3 ld = vec3(k.x * 2.6, 2.68, k.y * 2.6) - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		float dif = clamp(.12 + .88 * dot(n, ld), 0., 1.);
		float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;
		acc += (dif + sp) * vec3(.95, 1., .9) * 1.7 / (1. + d2 * .2);
	}
	return acc;
}

vec3 skyCol(vec3 rd) {
	return mix(vec3(.5, .55, .52), vec3(.72, .78, .76), clamp(rd.y * 2. + .4, 0., 1.));
}

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	if (h.id == ID_SCREEN) {
		// CRT face: spreadsheet <-> scrolling glyph rain.
		vec3 mq = h.uv;
		vec2 suv = clamp(vec2(mq.x / .27 + .5, .5 - (mq.y - .21) / .24), 0., 1.);
		vec3 day = texture2D(uCrt, vec2(suv.x, suv.y * .5)).rgb;
		vec2 ruv = vec2(suv.x, fract(suv.y * .5 + T * .1) * .5 + .5);
		vec3 saver = texture2D(uCrt, ruv).rgb * 1.6;
		vec3 c = mix(day * .9, saver, uScreen);
		// Scanlines + glass curvature dim.
		c *= .8 + .25 * sin(suv.y * 320.);
		c *= 1. - .5 * pow(length(suv - .5) * 1.35, 2.);
		return c * 1.6;
	}

	vec3 n = calcN(p, d);
	float spec = .2, gloss = 20.;
	vec3 c;

	if (h.id == ID_FLOOR) {
		vec2 tid = floor(p.xz / .5);
		c = vec3(.23, .25, .23) * (.85 + .3 * n21(tid * 5.1));
		c *= .92 + .08 * n31(p * 40.); // carpet nap
		spec = .05;
	} else if (h.id == ID_CEIL) {
		vec2 cf = fract(p.xz / .6);
		c = vec3(.62, .63, .6) * (.94 + .1 * n21(floor(p.xz / .6) * 3.));
		c *= mix(.7, 1., smoothstep(.0, .05, min(min(cf.x, 1. - cf.x), min(cf.y, 1. - cf.y))));
		// Troffer panels read as emissive rectangles.
		vec2 tk = fract(p.xz / 2.6 + .5) - .5;
		float lit = step(abs(tk.x), .23) * step(abs(tk.y), .06);
		if (lit > 0.) return vec3(1., 1., .92) * 2.4;
	} else if (h.id == ID_PART) {
		// Fabric partition + pinned memos on the inner faces.
		c = vec3(.47, .49, .43) * (.9 + .2 * n31(p * vec3(30., 30., 30.)));
		vec2 fuv = abs(n.x) > .5 ? p.zy : p.xy;
		vec2 pin = floor(fuv / vec2(.5, .4));
		float memo = step(.72, n21(pin * 7.7)) * step(.9, p.y) * step(p.y, 1.35);
		vec2 mf = fract(fuv / vec2(.5, .4));
		memo *= step(.25, mf.x) * step(mf.x, .7) * step(.2, mf.y) * step(mf.y, .8);
		c = mix(c, vec3(.78, .78, .72), memo);
		spec = .02;
	} else if (h.id == ID_DESK) {
		c = vec3(.4, .37, .31) * (.92 + .12 * n31(p * vec3(2., 40., 2.)));
		spec = .4;
		gloss = 30.;
	} else if (h.id == ID_CRT || h.id == ID_PLASTIC) {
		c = h.id == ID_CRT ? vec3(.52, .5, .42) : vec3(.2, .2, .19);
		if (h.id == ID_PLASTIC) {
			// Keycap grid.
			vec2 kf = fract(h.uv.xz * vec2(24., 20.));
			c *= mix(.7, 1.15, step(.18, kf.x) * step(.18, kf.y));
		}
		spec = .35;
		gloss = 26.;
	} else if (h.id == ID_PAPER) {
		c = vec3(.6, .6, .55);
		c *= .9 + .1 * sin(p.y * 400.); // stacked sheets
		spec = .05;
	} else if (h.id == ID_MUG) {
		c = vec3(.45, .12, .1);
		spec = .6;
		gloss = 40.;
	} else if (h.id == ID_METAL) {
		c = vec3(.16, .17, .17);
		spec = .5;
		gloss = 30.;
	} else if (h.id == ID_CLEANER) {
		c = vec3(.28, .3, .32); // grey coveralls
		spec = .1;
	} else if (h.id == ID_CITY) {
		c = vec3(.4, .42, .42);
		vec2 wuv = fract(vec2(p.x + p.z, p.y) / vec2(2., 1.4));
		float win = step(.2, wuv.x) * step(wuv.x, .7) * step(.25, wuv.y) * step(wuv.y, .8);
		c = mix(c, vec3(.2, .24, .25), win);
	} else {
		c = vec3(.55, .55, .5); // plaster walls
	}

	float occ = calcAO(p, n);
	vec3 lit = troffers(p, n, rd, spec, gloss);
	// Daylight through the window: soft directional from +z high.
	vec3 wd = normalize(vec3(.15, .5, 1.));
	float day = clamp(dot(n, wd), 0., 1.) * smoothstep(-2., 4., p.z);
	lit += skyCol(reflect(rd, n)) * day * .9;
	// CRT spill onto the desk area.
	vec3 sd = vec3(.32, .97, .88) - p;
	float sd2 = dot(sd, sd);
	lit += mix(vec3(.7, .72, .6), vec3(.3, 1., .55), uScreen) * .25 / (1. + sd2 * 8.) * clamp(dot(n, normalize(sd)), 0., 1.);

	vec3 amb = vec3(.34, .36, .34);
	vec3 col = c * (amb * occ + lit * (.5 + .5 * occ));

	// Outside points get sky light instead of troffers.
	if (p.z > 5.9) col = c * (skyCol(n) * (.55 + .45 * clamp(dot(n, wd), 0., 1.)) * (.4 + .6 * occ));

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

	// City haze.
	c = mix(c, vec3(.6, .65, .63), (1. - exp(-max(d - 8., 0.) * .02)) * .85);

	// Soapy glass composite: analytic plane hit inside the window opening.
	if (rd.z > .001) {
		float tG = (5.72 - ro.z) / rd.z;
		if (tG > 0. && tG < d) {
			vec3 g = ro + rd * tG;
			if (abs(g.x) < 8. && g.y > .85 && g.y < 2.56) {
				float a = suds(g.xy);
				c = mix(c, vec3(.72, .76, .73), a * .85);
				// Faint glass sheen.
				c += skyCol(reflect(rd, vec3(0., 0., -1.))) * .05;
			}
		}
	}

	return c;
}

void main()
{
	T = uTime;

	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	col *= vec3(.96, 1.03, .96); // fluorescent green-grey
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
