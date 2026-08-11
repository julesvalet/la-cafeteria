/**
 * Everything here is procedural: no texture files to download, no canvas
 * rasterisation on the main thread. A planet's identity is a handful of
 * uniforms, and its cost is a few octaves of value noise per covered pixel.
 *
 * No `precision` directives on purpose — three prepends `highp` by default,
 * and fBm needs it: coordinates are scaled by ~2x per octave, which mediump
 * cannot resolve against a unit noise lattice.
 */

const NOISE = /* glsl */ `
  // Hoskins hash — keeps intermediates small, unlike the classic fract-product.
  float hash13(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y),
      mix(
        mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y),
      f.z);
  }

  float fbm(vec3 p, int octaves) {
    // Rotating between octaves hides the axis-aligned grid of value noise.
    mat3 rot = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
    float amp = 0.5;
    float sum = 0.0;
    float norm = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      sum += amp * vnoise(p);
      norm += amp;
      amp *= 0.5;
      p = rot * p * 2.02;
    }
    return sum / max(norm, 0.0001);
  }
`;

export const planetVertexShader = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    // Local space, so the pattern is welded to the sphere and turns with it.
    vLocal = position;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const planetFragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform vec3 uAccent;
  uniform vec3 uLightDir;
  uniform float uSeed;
  uniform float uNoiseScale;
  uniform float uBands;
  uniform float uLocked;      // 0 = playable, 1 = coming soon
  uniform float uHighlight;   // 0..1 hover
  uniform float uAmbient;     // lifted in the light theme so planets stay readable
  uniform float uRim;
  uniform vec3 uHaze;         // sky colour, for the aerial-perspective wash
  uniform float uHazeAmount;
  uniform int uOctaves;

  varying vec3 vLocal;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  ${NOISE}

  void main() {
    vec3 sphere = normalize(vLocal);
    vec3 p = sphere * uNoiseScale + uSeed;

    float h = fbm(p, uOctaves);

    if (uBands > 0.5) {
      // Latitude bands, warped by the noise so they ripple like a gas giant.
      float band = sin(sphere.y * uBands * 3.14159 + h * 2.4);
      h = mix(h, band * 0.5 + 0.5, 0.6);
    }

    vec3 col = mix(uDeep, uMid, smoothstep(0.28, 0.56, h));
    col = mix(col, uHigh, smoothstep(0.58, 0.84, h));

    // Brighter, hazier poles.
    float polar = smoothstep(0.7, 0.99, abs(sphere.y));
    col = mix(col, uHigh, polar * 0.3);

    vec3 N = normalize(vNormalW);
    vec3 L = normalize(uLightDir);

    // Wrapped diffuse: a soft terminator reads better than a hard one at this
    // scale, and the ambient floor keeps the dark side from going flat.
    float diff = dot(N, L) * 0.5 + 0.5;
    diff = pow(clamp(diff, 0.0, 1.0), 1.35);
    col *= mix(uAmbient, 1.12, diff);

    float fres = pow(1.0 - clamp(dot(N, normalize(vViewDir)), 0.0, 1.0), 3.0);
    col += uAccent * fres * uRim * (0.5 + uHighlight * 1.1);

    /*
     * Coming soon. Desaturate only moderately — push further and every locked
     * planet becomes the same grey ball — then wash towards the sky colour.
     * That aerial-perspective mix is what carries the effect in both themes:
     * it dims against black and fades against cream, where merely darkening
     * would have made the locked planets the *most* contrasty things on screen.
     * The reduced octave count driven from JS does the "out of focus" half.
     */
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(lum), uLocked * 0.5);
    col = mix(col, uHaze, uLocked * uHazeAmount);

    gl_FragColor = vec4(col, 1.0);

    #include <colorspace_fragment>
  }
`;

/** Backside fresnel shell — the atmosphere halo around each planet. */
export const glowVertexShader = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const glowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uInner;   // planet limb as a fraction of the shell radius

  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    /*
     * Back-face shell, so the only fragments that survive the depth test are
     * the annulus between the planet's limb and the shell's silhouette.
     *
     * A plain fresnel is wrong here: it peaks at the shell silhouette, which
     * puts the brightest pixels on the outer cutoff and draws a hard ring.
     * Work in normalised screen radius instead and fall off outwards.
     */
    float ndv = abs(dot(normalize(vNormalW), normalize(vViewDir)));
    float radius = sqrt(max(1.0 - ndv * ndv, 0.0));
    float t = clamp((radius - uInner) / max(1.0 - uInner, 0.0001), 0.0, 1.0);

    float a = pow(1.0 - t, uPower);
    gl_FragColor = vec4(uColor, a * uIntensity);
    #include <colorspace_fragment>
  }
`;

export const ringVertexShader = /* glsl */ `
  varying vec3 vLocal;

  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ringFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uInner;
  uniform float uOuter;
  uniform float uLocked;

  varying vec3 vLocal;

  ${NOISE}

  void main() {
    float r = length(vLocal.xy);
    float t = clamp((r - uInner) / max(uOuter - uInner, 0.0001), 0.0, 1.0);

    // Fade both edges, then carve Cassini-style gaps out of the middle.
    float edge = smoothstep(0.0, 0.16, t) * (1.0 - smoothstep(0.72, 1.0, t));
    float gaps = 0.55 + 0.45 * vnoise(vec3(t * 26.0, 0.0, 0.0));

    float alpha = edge * gaps * uOpacity * mix(1.0, 0.75, uLocked);
    // Keep most of the ring's colour: desaturated to grey it disappears
    // entirely against the light theme's cream sky.
    vec3 col = mix(uColor, vec3(dot(uColor, vec3(0.299, 0.587, 0.114))), uLocked * 0.3);

    gl_FragColor = vec4(col, alpha);

    #include <colorspace_fragment>
  }
`;

export const starVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;

  varying float vTwinkle;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vTwinkle = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 6.2831));
    gl_PointSize = aSize * uPixelRatio * (260.0 / max(-mv.z, 0.001));
    gl_Position = projectionMatrix * mv;
  }
`;

export const starFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(uColor, a * vTwinkle * uOpacity);
    #include <colorspace_fragment>
  }
`;
