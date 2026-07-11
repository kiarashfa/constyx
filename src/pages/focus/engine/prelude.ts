/**
 * Shared GLSL toolkit for Focus shader scenes (round 11+): common uniforms,
 * hash/noise, SDF primitives, and the normal/AO helpers — everything that
 * round 10's two scenes each carried a private copy of. Scenes concatenate
 * this in front of their own body:
 *
 *   export const MY_FRAG = GLSL_PRELUDE + `...scene uniforms, map(), march(), main()...`;
 *
 * `map` is forward-declared here so calcN/calcAO can live in the prelude;
 * the scene body must define `Hit map(vec3 p)`. RaymarchQuad injects
 * uTime/uRes/uCamBasis; uCamPos comes from the scene's uniforms.
 */
export const GLSL_PRELUDE = /* glsl */ `
uniform float uTime;
uniform vec2 uRes;
uniform mat3 uCamBasis;
uniform vec3 uCamPos;

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

float smin(float a, float b, float k) {
	float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
	return mix(b, a, h) - k * h * (1. - h);
}

mat2 rot(float a) {
	float c = cos(a), s = sin(a);
	return mat2(c, s, -s, c);
}

void minH(inout Hit a, Hit b) {
	if (b.d < a.d) a = b;
}

float sdBox(vec3 p, vec3 b) {
	vec3 q = abs(p) - b;
	return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.);
}

/* Capsule between two points. */
float sdSeg(vec3 p, vec3 a, vec3 b, float r) {
	vec3 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
	return length(pa - ba * h) - r;
}

/* Vertical cylinder, centered: half-height h, radius r. */
float sdCyl(vec3 p, float h, float r) {
	vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
	return min(max(d.x, d.y), 0.) + length(max(d, 0.));
}

/* Ellipsoid (bound-accurate enough for small props). */
float sdEll(vec3 p, vec3 r) {
	float k0 = length(p / r);
	float k1 = length(p / (r * r));
	return k0 * (k0 - 1.) / k1;
}

Hit map(vec3 p);

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

vec3 vignette(vec3 c, vec2 fc) {
	vec2 q = fc.xy / uRes.xy;
	c *= .5 + .5 * pow(16. * q.x * q.y * (1. - q.x) * (1. - q.y), .4);
	return c;
}
`;
