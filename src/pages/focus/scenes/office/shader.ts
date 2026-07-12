import { GLSL_PRELUDE } from '../../engine/prelude';

/**
 * MetaCortex - Neo's cubicle, 1999 (round-16 rebuild, staged to match the
 * owner-provided reference set in assets-userprovided/office/, esp. Sample.jpg
 * and window_washers.png).
 *
 * Composition: the viewer stands at the cubicle entrance looking IN (-Z) at the
 * empty black task chair, the L-desk against the back partition, the overhead
 * storage cabinet with its wood valance, the grey 3-drawer filing cabinet with
 * stacked green CITY PHONE books, the beige Panasonic CRT + keyboard + mouse,
 * the multiline phone, the clamp desk lamp, papers pinned to the partition.
 * Turn around (+Z) for the curtain wall: two backlit window washers working
 * heavy soap arcs on the glass, a hazy backlit city beyond.
 *
 * Real CC0 photo textures (Poly Haven, see textures.ts / ATTRIBUTION.md) carry
 * the partition weave, the desk wood-edge/valance veneer, and the carpet.
 *
 * Whole frame graded to the film's dim, desaturated teal-green office light
 * (recessed fluorescent troffers are the warm key; everything else is cool
 * fill) - see main().
 */
export const OFFICE_FRAG =
  GLSL_PRELUDE +
  /* glsl */ `
uniform float uScreen;      // 0 spreadsheet .. 1 the glyph-rain screensaver
uniform sampler2D uCrt;     // CRT content atlas (day job / screensaver halves)
uniform sampler2D uFabric;  // partition-panel weave  (poly_wool_herringbone)
uniform sampler2D uDesk;    // wood veneer (edge band / valance) (oak_veneer_01)
uniform sampler2D uCarpet;  // office floor           (dirty_carpet)
uniform sampler2D uCity;    // painted sunrise cityscape backdrop (cityTexture.ts)

#define MIN_DIST   .002
#define MAX_DIST   55.0
#define MAX_STEPS  82.0
#define FL         1.5

#define CEIL_Y     2.62
#define WIN_Z      2.55      // glass plane (curtain wall behind the seat)
#define WIN_Y0     0.80
#define WIN_Y1     2.44
#define WIN_X0     -3.4
#define WIN_X1     3.4
#define BACK_Z     -2.55     // back partition (desk wall)
#define SIDE_X     1.66      // side partitions

#define ID_FLOOR   1
#define ID_CEIL    2
#define ID_PART    3   // fabric partition
#define ID_CAP     4   // partition cap rail / dark trim
#define ID_TOP     5   // desk laminate top (light)
#define ID_WOOD    6   // veneer edge band / valance
#define ID_LGREY   7   // light-grey cabinet doors / desk modesty
#define ID_METAL   8   // grey filing/steel cabinet
#define ID_BEIGE   9   // CRT / keyboard / mouse / phone plastic
#define ID_SCREEN  10  // CRT face
#define ID_BLACK   11  // chair / trays / lamp / dark plastic
#define ID_BOOK    12  // green CITY PHONE books
#define ID_PAPER   13  // pinned papers / documents
#define ID_MULL    14  // window mullion metal
#define ID_SPAN    15  // spandrel / wall / sill
#define ID_CLEAN   16  // window washer
#define ID_SQUEE   17  // squeegee
#define ID_SCAF    18  // gondola scaffold

float T;
float gExt; // 1 = final pixel is exterior (sunrise city / washers), else 0

/* ================= real-texture sampling ================= */
vec3 srgbTex(sampler2D t, vec2 uv) {
	vec3 c = texture2D(t, uv).rgb;
	return c * (c * (c * 0.305306 + 0.682171) + 0.012522);
}
vec2 faceUV(vec3 p, vec3 n, float s) {
	vec3 an = abs(n);
	vec2 uv = an.x > max(an.y, an.z) ? p.zy : (an.z > an.y ? p.xy : p.xz);
	return uv * s;
}

/* rounded box helper */
float rbox(vec3 p, vec3 b, float r) { return sdBox(p, b) - r; }

/* ================= furniture ================= */

/* black office task chair; the seat you're sitting in, just behind the POV */
float chair(vec3 p) {
	vec3 q = p - vec3(0., 0., -0.55);
	float d = 1e5;
	// 5-star base + castors
	for (int i = 0; i < 5; i++) {
		float a = float(i) * 1.2566 + .3;
		vec2 dir = vec2(cos(a), sin(a));
		vec3 s = q - vec3(0., .07, 0.);
		vec3 lp = vec3(dot(s.xz, dir), s.y, dot(s.xz, vec2(-dir.y, dir.x)));
		d = min(d, rbox(lp - vec3(.17, -.01, 0.), vec3(.17, .022, .03), .01));
		d = min(d, length(q - vec3(dir.x * .32, .04, dir.y * .32)) - .045);
	}
	d = min(d, sdCyl(q - vec3(0., .1, 0.), .05, .07));       // hub
	d = min(d, sdCyl(q - vec3(0., .29, 0.), .19, .028));     // gas lift
	d = smin(d, rbox(q - vec3(0., .47, .015), vec3(.22, .04, .215), .035), .02); // seat
	// backrest: tilted, gently curved, faces +Z
	vec3 bq = q - vec3(0., .8, .19);
	bq.yz = rot(-.13) * bq.yz;
	bq.z += .06 * (bq.x * bq.x) / .05;                       // horizontal lumbar curve
	d = smin(d, rbox(bq, vec3(.215, .3, .045), .03), .03);
	return d;
}

/* beige Panasonic-style CRT + stand; screen recessed on the +Z face.
   returns body distance; writes the screen distance to scr and local uv mq */
float crtMonitor(vec3 p, out float scr, out vec3 mq) {
	vec3 mc = vec3(.72, .99, -2.12);
	mq = p - mc;
	mq.xz = rot(-.26) * mq.xz;                               // angled toward the seat
	float body = rbox(mq - vec3(0., 0., -.01), vec3(.185, .155, .15), .025);
	body = smin(body, rbox(mq - vec3(0., -.015, -.17), vec3(.1, .095, .07), .03), .05); // funnel
	float neck = sdCyl(p - vec3(mc.x, .82, mc.z), .025, .09);
	float foot = rbox(p - vec3(mc.x, .77, mc.z), vec3(.13, .022, .12), .015);
	scr = rbox(mq - vec3(0., .01, .142), vec3(.148, .112, .028), .006);
	return min(body, min(neck, foot));
}

/* beige multiline desk phone */
float phone(vec3 p) {
	vec3 pq = p - vec3(-.34, .758, -2.04);
	float body = rbox(pq, vec3(.135, .02, .15), .012);
	// handset resting across the left edge
	vec3 hq = pq - vec3(-.055, .05, .0);
	float hs = rbox(hq, vec3(.052, .022, .14), .014);
	hs = min(hs, rbox(hq - vec3(0., 0., .16), vec3(.05, .028, .03), .02));
	hs = min(hs, rbox(hq - vec3(0., 0., -.16), vec3(.05, .028, .03), .02));
	return min(body, hs);
}

/* clamp desk lamp on the right partition, head over the desk */
float deskLamp(vec3 p) {
	vec3 b = vec3(SIDE_X - .03, 1.42, -1.62);
	float d = rbox(p - b, vec3(.03, .06, .05), .01);         // clamp block
	vec3 j1 = b + vec3(-.04, .02, 0.);
	vec3 j2 = j1 + vec3(-.22, .26, .02);
	d = min(d, sdSeg(p, j1, j2, .013));
	vec3 j3 = j2 + vec3(-.30, -.14, .03);
	d = min(d, sdSeg(p, j2, j3, .013));
	d = min(d, length(p - j2) - .022);                       // elbow knuckle
	d = min(d, sdCyl(p - j3 - vec3(0., -.03, 0.), .05, .055)); // shade/head
	return d;
}

/* ================= window washers ================= */

/* Squeegee stroke, 7s cycle: pull the blade top->bottom leaving a clean band,
   lift, shift one lane over (drives the arm pose + the wiped soap band). */
void squeegeeState(out float xc, out float yBlade, out float press) {
	float cyc = floor(T / 7.);
	float ph = fract(T / 7.);
	float lane0 = mod(cyc, 3.) - 1.;
	float lane1 = mod(cyc + 1., 3.) - 1.;
	float shift = smoothstep(.42, .64, ph);
	xc = mix(lane0, lane1, shift) * .7;                      // lateral centre (world x)
	float down = smoothstep(.05, .40, ph);
	float up = smoothstep(.46, .64, ph);
	yBlade = mix(1.78, 1.0, down) + (1.78 - 1.0) * up;
	press = smoothstep(.0, .05, ph) * (1. - smoothstep(.40, .46, ph));
}

/* standing figure (correct proportions, ~1.78m), a ball-cap on the head,
   facing -Z toward the glass; the working hand handW is world-space. */
float figure(vec3 p, vec3 base, vec3 handW, vec3 restW) {
	vec3 q = p - base;
	float d = sdSeg(q, vec3(.02, .04, .12), vec3(.03, .47, .11), .085);
	d = min(d, sdSeg(q, vec3(.03, .47, .11), vec3(.02, .92, .10), .095));
	d = min(d, sdSeg(q, vec3(-.02, .04, -.12), vec3(-.03, .47, -.11), .085));
	d = min(d, sdSeg(q, vec3(-.03, .47, -.11), vec3(-.02, .92, -.10), .095));
	d = smin(d, sdSeg(q, vec3(0., .90, 0.), vec3(-.02, 1.20, 0.), .135), .07);
	d = smin(d, sdSeg(q, vec3(-.02, 1.20, 0.), vec3(-.03, 1.44, 0.), .125), .06);
	d = smin(d, sdSeg(q, vec3(-.03, 1.44, -.17), vec3(-.03, 1.44, .17), .07), .05);
	d = smin(d, sdSeg(q, vec3(-.02, 1.44, 0.), vec3(0., 1.54, 0.), .05), .03);
	d = smin(d, length(q - vec3(.01, 1.66, 0.)) - .105, .035);
	// ball cap: crown + peak toward the glass (-Z)
	d = smin(d, length((q - vec3(.01, 1.72, -.01)) * vec3(1., 1.2, 1.)) - .11, .02);
	d = min(d, rbox(q - vec3(.01, 1.68, -.13), vec3(.09, .012, .06), .01));
	// working arm: shoulder -> elbow -> hand
	vec3 h = handW - base;
	vec3 sh = vec3(-.03, 1.42, -.17);
	vec3 el = mix(sh, h, .48) + vec3(.03, -.05, -.12);
	d = smin(d, sdSeg(q, sh, el, .058), .035);
	d = min(d, sdSeg(q, el, h, .05));
	// resting arm
	vec3 r = restW - base;
	vec3 sh2 = vec3(-.03, 1.42, .17);
	vec3 el2 = mix(sh2, r, .5) + vec3(.02, -.05, .1);
	d = smin(d, sdSeg(q, sh2, el2, .058), .035);
	d = min(d, sdSeg(q, el2, r, .05));
	return d;
}

float squeegeeTool(vec3 p, vec3 at, float tilt) {
	vec3 g = p - at;
	g.xy = rot(tilt) * g.xy;
	float d = rbox(g, vec3(.17, .022, .02), .004);           // channel bar
	d = min(d, rbox(g - vec3(0., -.035, 0.), vec3(.175, .02, .008), .002)); // rubber lip
	d = min(d, sdSeg(g, vec3(0., .02, 0.), vec3(.0, .07, .16), .017));      // handle
	return d;
}

float washers(vec3 p) {
	float xc, yB, press;
	squeegeeState(xc, yB, press);
	float d = 1e5;
	// each washer sub-bounded (figure() is ~30 ops); rays near one skip the other.
	if (length(p - vec3(0., .9, WIN_Z + .4)) < 1.05) {
		d = figure(p, vec3(0., -.02, WIN_Z + .55), vec3(xc, yB, WIN_Z + .16), vec3(-.30, .96, WIN_Z + .44));
		d = min(d, squeegeeTool(p, vec3(xc, yB, WIN_Z + .015), -.18));
	}
	if (length(p - vec3(-1.55, .9, WIN_Z + .4)) < 1.05) {
		vec2 circ = vec2(cos(T * .8), sin(T * .8)) * .2;
		vec3 handB = vec3(-1.55 + circ.x, 1.15 + circ.y, WIN_Z + .14);
		float b = figure(p, vec3(-1.55, -.02, WIN_Z + .5), handB, vec3(-1.25, .5, WIN_Z + .5));
		b = min(b, length(p - handB - vec3(0., 0., -.03)) - .07);  // sponge
		d = min(d, b);
	}
	return d;
}

/* smooth 2-octave value noise for foam (n21 is already interpolated) */
float fbm2(vec2 g) { return n21(g) * .65 + n21(g * 2.3 + 11.) * .35; }

/* thin, translucent squeegee film on the pane: gentle diagonal wipe streaks
   that let the sunrise city read through, a fresh wet band at the blade, and a
   wiped-clean column above it. Deliberately SUBTLE (not blotchy foam). */
float suds(vec2 g) { // g = (x, y) on the glass
	float xc, yB, press;
	squeegeeState(xc, yB, press);
	// sweeping diagonal wipe marks + faint film.
	float streak = sin((g.y + g.x * .45) * 6.5 + fbm2(g * 1.2) * 3.5) * .5 + .5;
	streak = smoothstep(.35, .95, streak);
	float film = smoothstep(.45, .85, fbm2(g * 1.1));
	float a = (film * .55 + streak * .45) * .3;   // subtle overall
	// fresh stroke: clean column above the blade + a wet line right at it.
	float inCol = smoothstep(.26, .17, abs(g.x - xc));
	a *= mix(1., .05, inCol * smoothstep(yB - .05, yB + .04, g.y) * press);
	a += inCol * smoothstep(.05, .0, abs(g.y - yB + .02)) * press * .35;
	return clamp(a, 0., 1.);
}

/* ================= the office ================= */

/* neighbouring partition tops receding down the aisle behind the seat */
float aisleField(vec3 p) {
	vec3 a = p; a.z = mod(p.z - .8, 2.4) - 1.2;
	float wa = sdBox(vec3(abs(p.x) - 3.2, a.y - .74, a.z), vec3(1.4, .74, .03)) - .01;
	return max(wa, WIN_Z - .3 - p.z);   // only in the aisle, short of the window
}

Hit map(vec3 p) {
	// floor + ceiling, clipped to the interior (not past the glass).
	Hit h = Hit(max(p.y, p.z - (WIN_Z + .02)), ID_FLOOR, p);
	minH(h, Hit(max(CEIL_Y - p.y, p.z - (WIN_Z + .02)), ID_CEIL, p));

	// partitions: a continuous back wall (all cubicles back onto it), Neo's two
	// side walls, and the neighbours' far dividers (a row of cubicles).
	float back = sdBox(p - vec3(0., 1.05, BACK_Z), vec3(6.6, 1.05, .04)) - .012;
	float sideL = sdBox(p - vec3(-SIDE_X, .74, -.98), vec3(.04, .74, 1.62)) - .012;
	float sideR = sdBox(p - vec3(SIDE_X, .74, -1.35), vec3(.04, .74, 1.25)) - .012; // shorter -> gap
	float divs = sdBox(vec3(abs(p.x) - 4.06, p.y - .74, p.z + 1.05), vec3(.04, .74, 1.55)) - .012;
	float part = min(min(back, min(sideL, sideR)), divs);
	part = min(part, aisleField(p));
	minH(h, Hit(part, ID_PART, p));
	float cap = sdBox(p - vec3(-SIDE_X, 1.5, -.98), vec3(.05, .022, 1.63));
	cap = min(cap, sdBox(p - vec3(SIDE_X, 1.5, -1.35), vec3(.05, .022, 1.26)));
	cap = min(cap, sdBox(vec3(abs(p.x) - 4.06, p.y - 1.5, p.z + 1.05), vec3(.05, .022, 1.56)));
	minH(h, Hit(cap, ID_CAP, p));

	// ---- neighbour cubicles (mirror by |x|, centred on +-2.86): overhead
	// cabinet peeks over Neo's side wall, plus a desk + CRT. Populates the row. ----
	vec3 np = vec3(abs(p.x) - 2.86, p.y, p.z);
	float nB = sdBox(vec3(np.x, np.y - 1.15, np.z + 2.0), vec3(1.1, 1.05, .95));
	if (nB < .3) {
		minH(h, Hit(rbox(vec3(np.x - .18, np.y - 1.73, np.z + 2.3), vec3(.78, .26, .24), .012), ID_LGREY, np));
		minH(h, Hit(sdBox(vec3(np.x, np.y - .715, np.z + 2.16), vec3(1.0, .02, .4)) - .006, ID_TOP, np));
		float nmon = rbox(vec3(np.x + .28, np.y - .98, np.z + 2.08), vec3(.16, .14, .14), .02);
		nmon = min(nmon, sdBox(vec3(np.x + .28, np.y - .8, np.z + 2.08), vec3(.13, .02, .11)) - .01);
		minH(h, Hit(nmon, ID_BEIGE, np));
	} else {
		minH(h, Hit(nB, ID_LGREY, np));
	}

	// pinned papers on the back partition.
	float pin = sdBox(p - vec3(-1.15, 1.2, BACK_Z + .05), vec3(.11, .15, .006));
	pin = min(pin, sdBox(p - vec3(-.75, 1.32, BACK_Z + .05), vec3(.1, .13, .006)));
	minH(h, Hit(pin, ID_PAPER, p));

	// ---- desk + desktop props (bounded) ----
	// desk surfaces (cheap boxes) under a tight box bound; props sub-bounded.
	float deskB = sdBox(p - vec3(0., .42, -1.75), vec3(1.65, .36, .95));
	if (deskB < .2) {
		float top = sdBox(p - vec3(-.15, .715, -2.16), vec3(1.42, .019, .40)) - .006;
		top = min(top, sdBox(p - vec3(1.02, .715, -1.5), vec3(.42, .019, .66)) - .006);
		minH(h, Hit(top, ID_TOP, p));
		float edge = sdBox(p - vec3(-.15, .70, -1.77), vec3(1.42, .028, .015));
		edge = min(edge, sdBox(p - vec3(1.4, .70, -1.5), vec3(.015, .028, .66)));
		minH(h, Hit(edge, ID_WOOD, p));
		float mod0 = sdBox(p - vec3(-.15, .38, -2.5), vec3(1.4, .33, .02));
		mod0 = min(mod0, sdBox(p - vec3(1.42, .36, -1.5), vec3(.02, .35, .62)));
		mod0 = min(mod0, sdBox(p - vec3(-.15, .36, -1.78), vec3(1.4, .35, .02)));
		minH(h, Hit(mod0, ID_LGREY, p));
		// keyboard + mouse.
		if (length(p - vec3(.62, .74, -1.8)) < .4) {
			vec3 kq = p - vec3(.5, .734, -1.82); kq.xz *= rot(.04);
			minH(h, Hit(rbox(kq, vec3(.22, .012, .085), .006), ID_BEIGE, kq));
			minH(h, Hit(rbox(p - vec3(.9, .742, -1.74), vec3(.035, .012, .055), .02), ID_BEIGE, p));
		}
		if (length(p - vec3(-.34, .78, -2.04)) < .34)
			minH(h, Hit(phone(p), ID_BEIGE, p - vec3(-.34, .758, -2.04)));
		if (length(p - vec3(-.92, .79, -2.02)) < .32) {
			float trays = 1e5;
			for (int i = 0; i < 3; i++)
				trays = min(trays, sdBox(p - vec3(-.92, .747 + float(i) * .03, -2.02), vec3(.13, .006, .16)));
			minH(h, Hit(trays, ID_BLACK, p));
		}
	} else {
		minH(h, Hit(deskB, ID_TOP, p));
	}
	// CRT monitor — its own tight bound (the priciest desktop prop).
	float monB = length(p - vec3(.72, .99, -2.1)) - .4;
	if (monB < .16) {
		float scr; vec3 mq;
		float crt = crtMonitor(p, scr, mq);
		minH(h, Hit(crt, ID_BEIGE, p));
		minH(h, Hit(scr, ID_SCREEN, mq));
	} else {
		minH(h, Hit(monB, ID_BEIGE, p));
	}

	// ---- chair (bounded) — the seat just behind the POV ----
	float chairB = length(p - vec3(0., .52, -0.48)) - .74;
	if (chairB < .18) minH(h, Hit(chair(p), ID_BLACK, p));
	else minH(h, Hit(chairB, ID_BLACK, p));

	// ---- left storage: filing cabinet + CITY PHONE books + tall cabinet ----
	float leftB = length(p - vec3(-1.28, .72, -2.12)) - .85;
	if (leftB < .2) {
		float fc = rbox(p - vec3(-1.15, .52, -2.02), vec3(.22, .52, .3), .008);
		minH(h, Hit(fc, ID_METAL, p));
		// two green phone books + a leaning binder on top.
		float bk = sdBox(p - vec3(-1.14, 1.08, -2.0), vec3(.19, .028, .13));
		bk = min(bk, sdBox(p - vec3(-1.16, 1.135, -2.01), vec3(.185, .026, .125)));
		minH(h, Hit(bk, ID_BOOK, p));
		vec3 bnq = p - vec3(-1.02, 1.2, -2.15); bnq.xy *= rot(.2);
		minH(h, Hit(sdBox(bnq, vec3(.03, .13, .1)), ID_BLACK, p));
		// tall 2-door cabinet against the left partition, behind.
		float cab = rbox(p - vec3(-1.5, .72, -2.32), vec3(.13, .72, .26), .008);
		minH(h, Hit(cab, ID_LGREY, p));
	} else {
		minH(h, Hit(leftB, ID_METAL, p));
	}

	// ---- overhead cabinet + valance (cheap boxes, box-bounded) ----
	float upB = sdBox(p - vec3(.55, 1.68, -2.28), vec3(.98, .34, .28));
	if (upB < .18) {
		float cab = rbox(p - vec3(.55, 1.73, -2.3), vec3(.95, .27, .25), .012);
		minH(h, Hit(cab, ID_LGREY, p));
		float val = sdBox(p - vec3(.55, 1.44, -2.04), vec3(.95, .022, .03));
		minH(h, Hit(val, ID_WOOD, p));
	} else {
		minH(h, Hit(upB, ID_LGREY, p));
	}
	// ---- clamp desk lamp (tight bound, its own ~6-op SDF) ----
	float lampB = length(p - vec3(1.34, 1.24, -1.6)) - .5;
	if (lampB < .15) minH(h, Hit(deskLamp(p), ID_BLACK, p));
	else minH(h, Hit(lampB, ID_BLACK, p));

	// ---- window (curtain) wall behind the entrance (+Z) ----
	float wallSlab = sdBox(vec3(p.x, p.y - 1.3, p.z - WIN_Z), vec3(26., 1.3, .1));
	float open = sdBox(vec3(p.x, p.y - (WIN_Y0 + WIN_Y1) * .5, p.z - WIN_Z),
		vec3((WIN_X1 - WIN_X0) * .5, (WIN_Y1 - WIN_Y0) * .5, .4));
	minH(h, Hit(max(wallSlab, -open), ID_SPAN, p));
	// sill ledge (papers laid on it in the film; kept simple as a ledge).
	minH(h, Hit(sdBox(vec3(p.x, p.y - WIN_Y0, p.z - (WIN_Z - .12)), vec3(24., .04, .13)), ID_SPAN, p));
	// mullions: a clean pane grid (verticals every 1.9m + one transom), like
	// the reference. Thin dark frames.
	vec3 vm = vec3(mod(p.x + .95, 1.9) - .95, p.y - 1.62, p.z - WIN_Z);
	float mull = max(sdBox(vm, vec3(.035, .84, .035)), abs(p.x) - (WIN_X1 - .03));
	float tran = sdBox(vec3(p.x, p.y - 1.62, p.z - WIN_Z), vec3(WIN_X1 - .03, .028, .035));
	// window frame perimeter (head + jambs) for a finished opening.
	float frame = sdBox(vec3(p.x, p.y - WIN_Y1, p.z - WIN_Z), vec3(WIN_X1, .05, .05));
	frame = min(frame, sdBox(vec3(abs(p.x) - WIN_X1, p.y - 1.62, p.z - WIN_Z), vec3(.05, .84, .05)));
	minH(h, Hit(min(min(mull, tran), frame), ID_MULL, p));

	// ---- gondola + washers, outside the glass (bounded, z > WIN_Z) ----
	// Clean: just a low platform (the washers stand on it, mostly below the
	// sill) + two thin suspension cables rising out of frame.
	float obB = sdBox(vec3(p.x + .7, p.y - 1., p.z - (WIN_Z + .5)), vec3(2.4, 1.9, .55));
	if (obB < .3) {
		float plat = rbox(p - vec3(-.75, -.04, WIN_Z + .42), vec3(2., .04, .42), .01);
		minH(h, Hit(plat, ID_SCAF, p));
		minH(h, Hit(washers(p), ID_CLEAN, p));
	} else {
		minH(h, Hit(obB, ID_SCAF, p));
	}
	vec3 cq = vec3(abs(p.x + .75) - 1.9, p.y, p.z - (WIN_Z + .78));
	minH(h, Hit(max(length(cq.xz) - .012, -(p.y - .7)), ID_SCAF, p));

	return h;
}

/* ================= lighting & materials ================= */

vec3 troffers(vec3 p, vec3 n, vec3 rd, float spec, float gloss) {
	vec3 acc = vec3(0);
	// grid on a 1.6 x 1.8 pitch; nearest two cells in z.
	vec2 k0 = clamp(floor(vec2(p.x / 1.6, p.z / 1.8) + .5), vec2(-8.), vec2(8.));
	for (int j = 0; j < 2; j++) {
		vec2 k = j == 0 ? k0 : k0 + vec2(0., sign(p.z - k0.y * 1.8 + .001));
		if (j == 1 && k == k0) break;
		vec3 ld = vec3(k.x * 1.6, CEIL_Y + .02, k.y * 1.8) - p;
		float d2 = dot(ld, ld);
		ld *= inversesqrt(d2);
		float dif = clamp(.08 + .92 * dot(n, ld), 0., 1.);
		float sp = pow(max(dot(n, normalize(ld - rd)), 0.), gloss) * spec;
		acc += (dif + sp) * vec3(1., .98, .86) * 1.5 / (1. + d2 * .3);
	}
	return acc;
}

vec3 skyCol(vec3 rd) {
	// warm hazy dawn (matches the city backdrop's upper sky / horizon glow).
	float el = clamp(rd.y, -.3, 1.);
	return mix(vec3(.95, .86, .68), vec3(.5, .6, .68), smoothstep(-.02, .55, el));
}

/* painted sunrise cityscape, sampled as an infinitely-distant backdrop by ray
   azimuth (around the +Z window normal) and elevation, with a warm distance
   haze layered on top. */
vec3 cityBackdrop(vec3 rd) {
	float az = atan(rd.x, max(rd.z, 1e-3));       // 0 straight out the window
	float u = az / 1.7 + .5;                       // ~+-0.85rad fills the panorama
	float v = clamp(.66 - rd.y * .82, 0., 1.);     // horizon at v=0.66
	vec3 city = texture2D(uCity, vec2(u, v)).rgb;
	city = city * city * 1.28;                     // approx sRGB->linear + morning lift
	// warm dawn haze thickening toward the horizon.
	float hz = smoothstep(.4, -.05, rd.y);
	city = mix(city, vec3(1.0, .9, .74) * 1.05, hz * .4);
	return city;
}

vec3 shade(vec3 p, vec3 rd, float d, Hit h) {
	if (h.id == ID_SCREEN) {
		vec3 mq = h.uv;
		vec2 suv = clamp(vec2(mq.x / .30 + .5, .5 - mq.y / .232), 0., 1.);
		vec2 cc = suv - .5;
		suv += cc * dot(cc, cc) * .16;
		if (suv.x < 0. || suv.x > 1. || suv.y < 0. || suv.y > 1.)
			return vec3(.012, .017, .015);
		vec3 day = texture2D(uCrt, vec2(suv.x, suv.y * .5)).rgb;
		vec2 ruv = vec2(suv.x, fract(suv.y * .5 + T * .09) * .5 + .5);
		vec3 saver = texture2D(uCrt, ruv).rgb * 1.7;
		vec3 c = mix(day * .82, saver, uScreen);
		c *= .8 + .2 * cos(suv.x * 900.);           // aperture grille
		c *= .82 + .18 * sin(suv.y * 232. + T * 2.); // scanlines
		c += c * .3;                                  // phosphor lift
		c *= 1. - .5 * pow(length(cc) * 1.35, 2.5);
		return c * 1.5;
	}

	vec3 n = calcN(p, d);
	float spec = .16, gloss = 20.;
	vec3 c;
	bool outside = p.z > WIN_Z + .01;

	if (h.id == ID_FLOOR) {
		c = srgbTex(uCarpet, p.xz * 2.) * vec3(.7, .82, .8);
		c *= .9 + .12 * n21(floor(p.xz / .5) * 5.1);
		spec = .03; gloss = 6.;
	} else if (h.id == ID_CEIL) {
		vec2 cf = fract(p.xz / .6);
		c = vec3(.6, .62, .6) * (.95 + .08 * n21(floor(p.xz / .6) * 3.));
		c *= mix(.72, 1., smoothstep(.0, .05, min(min(cf.x, 1. - cf.x), min(cf.y, 1. - cf.y))));
		vec2 tk = fract(vec2(p.x / 1.6, p.z / 1.8) + .5) - .5;
		if (step(abs(tk.x), .3) * step(abs(tk.y), .085) > 0.)
			return vec3(1., .97, .85) * 2.7;
	} else if (h.id == ID_PART) {
		vec2 uv = faceUV(p, n, 1.6);
		float dark = p.z < BACK_Z + .2 ? .62 : .78;   // back panel darker
		c = srgbTex(uFabric, uv) * vec3(.6, .74, .74) * dark;
		spec = .012; gloss = 5.;
	} else if (h.id == ID_CAP) {
		c = vec3(.08, .095, .1); spec = .28; gloss = 22.;
	} else if (h.id == ID_TOP) {
		c = vec3(.5, .52, .51); spec = .22; gloss = 30.;   // light laminate
	} else if (h.id == ID_WOOD) {
		vec3 dt = srgbTex(uDesk, faceUV(p, n, 1.4));
		c = mix(vec3(dot(dt, vec3(.33))), dt, .6) * vec3(.72, .68, .58);
		spec = .2; gloss = 26.;
	} else if (h.id == ID_LGREY) {
		c = vec3(.44, .47, .46); spec = .16; gloss = 18.;
	} else if (h.id == ID_METAL) {
		c = vec3(.4, .43, .43);
		// drawer seams on the filing cabinet front (+Z face).
		if (abs(n.z) > .5) c *= .7 + .3 * smoothstep(.02, .05, abs(fract(p.y * 2.9) - .5));
		spec = .3; gloss = 26.;
	} else if (h.id == ID_BEIGE) {
		c = vec3(.56, .54, .46);
		spec = .28; gloss = 24.;
	} else if (h.id == ID_BLACK) {
		c = vec3(.05, .055, .06); spec = .12; gloss = 14.;
	} else if (h.id == ID_BOOK) {
		c = vec3(.16, .4, .2); spec = .1; gloss = 10.;   // green CITY PHONE
	} else if (h.id == ID_PAPER) {
		// stacked-sheet edge lines only on desk (horizontal) papers, not the
		// wall-pinned (vertical, +Z-facing) documents.
		float sheets = abs(n.z) > .5 ? 1. : (.94 + .06 * sin(p.y * 320.));
		c = vec3(.66, .67, .62) * sheets;
		spec = .04;
	} else if (h.id == ID_MULL) {
		c = vec3(.06, .07, .07); spec = .4; gloss = 34.;
	} else if (h.id == ID_SPAN) {
		c = vec3(.32, .34, .33); spec = .1; gloss = 12.;
	} else if (h.id == ID_CLEAN) {
		c = vec3(.13, .15, .16); spec = .05; gloss = 5.;  // backlit silhouette
	} else if (h.id == ID_SCAF) {
		c = vec3(.22, .23, .23); spec = .3; gloss = 20.;
	} else {
		c = vec3(.4, .42, .4);
	}

	float occ = calcAO(p, n);
	if (outside) {
		// backlit by the dawn: soft sky fill + a warm rim on the silhouette edge.
		vec3 sun = normalize(vec3(.4, .28, 1.));
		float sky = .32 + .68 * clamp(dot(n, sun), 0., 1.);
		vec3 col = c * skyCol(reflect(rd, n)) * sky * (.5 + .4 * occ);
		float rim = pow(1. - abs(dot(n, rd)), 3.) * clamp(dot(-rd, sun) + .35, 0., 1.);
		col += vec3(1., .88, .68) * rim * .55;
		return col;
	}

	vec3 lit = troffers(p, n, rd, spec, gloss);
	// dim daylight bleeding from the window side (+Z).
	vec3 wd = normalize(vec3(0., .3, 1.));
	lit += skyCol(reflect(rd, n)) * clamp(dot(n, wd), 0., 1.) * smoothstep(-1., 4., p.z) * .4;
	// warm under-cabinet task light pool + lamp head.
	vec3 t1 = vec3(.55, 1.4, -2.0) - p;
	lit += vec3(1., .9, .68) * .3 / (1. + dot(t1, t1) * 6.) * clamp(dot(n, normalize(t1)), 0., 1.);
	vec3 t2 = vec3(1.25, 1.05, -1.7) - p;
	lit += vec3(1., .92, .72) * .28 / (1. + dot(t2, t2) * 9.) * clamp(dot(n, normalize(t2)), 0., 1.);
	// CRT spill (green when the screensaver is up).
	vec3 sc = vec3(.72, .99, -1.95) - p;
	lit += mix(vec3(.5, .58, .5), vec3(.25, 1., .5), uScreen) * .18
		/ (1. + dot(sc, sc) * 10.) * clamp(dot(n, normalize(sc)), 0., 1.);

	vec3 amb = vec3(.17, .21, .21);
	return c * (amb * occ + lit * (.5 + .5 * occ));
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

	bool interior;
	vec3 c;
	if (d < MAX_DIST) {
		c = shade(p, rd, d, h);
		interior = p.z < WIN_Z + .01;
	} else {
		c = rd.z > 0. ? cityBackdrop(rd) : vec3(.42, .47, .46);
		interior = rd.z <= 0.;
	}

	gExt = interior ? 0. : 1.;
	if (interior)
		c = mix(c, vec3(.32, .4, .4), (1. - exp(-max(d - 5., 0.) * .05)) * .7);

	// soap-streak glass composite: analytic pane hit inside the opening. Thin
	// translucent warm-white film (dawn-lit); no interior reflection.
	if (rd.z > .001) {
		float tG = (WIN_Z - ro.z) / rd.z;
		if (tG > 0. && tG < d) {
			vec3 g = ro + rd * tG;
			if (g.x > WIN_X0 && g.x < WIN_X1 && g.y > WIN_Y0 && g.y < WIN_Y1) {
				float a = suds(vec2(g.x, g.y));
				c = mix(c, vec3(.9, .88, .82), a * .6);
			}
		}
	}

	return c;
}

void main() {
	T = uTime;
	vec2 uv = (gl_FragCoord.xy - .5 * uRes.xy) / uRes.y;
	vec3 rd = normalize(uCamBasis * vec3(uv, -FL));
	vec3 col = march(uCamPos, rd);

	col = pow(col, vec3(.4545));
	float l = dot(col, vec3(.299, .587, .114));
	if (gExt < .5) {
		// --- film grade: dim, desaturated teal-green office (Sample.jpg) ---
		col *= .92;                                   // slight underexposure
		col = mix(vec3(l), col, .74);                 // pull saturation down
		col *= vec3(.86, 1.02, .96);                  // teal-green cast
		col += (vec3(.0, .022, .018) - col * .05) * (1. - smoothstep(0., .5, l)); // crush shadows
	} else {
		// exterior (sunrise city + washers): keep the warmth, gentle lift.
		col = mix(vec3(l), col, .92);
		col *= vec3(1.04, 1.0, .96);
	}
	col = clamp(col, 0., 1.);
	gl_FragColor = vec4(vignette(col, gl_FragCoord.xy), 1.0);
}
`;
