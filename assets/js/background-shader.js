/* background-shader.js
 * Drop-in WebGL fBm domain-warp background for .welcome-section.
 * Usage in index.html:
 *   <script src="/assets/js/background-shader.js"></script>
 *   <script>BackgroundShader.init('welcome-section');</script>
 *
 * ── Tunable initial parameters ────────────────────────────────────────────
 */
const SHADER_CONFIG = {
  speed:    0.055,  // travel speed through noise field  (0 = frozen, 0.2 = fast)
  octaves:  5,      // fBm octaves  (1–8),  more = finer cloud detail
  warp:     1.4,    // domain warp strength  (0 = plain fBm,  2+ = very twisted)
  zoom:     1.3,    // zoom  (larger = more zoomed-out / bigger blobs)
  parallax: 0.30,   // scroll parallax strength  (0 = none,  0.3 = strong)

  // Colour palette — four stops mapped 0→1 over the noise value
  c1: [0.01, 0.04, 0.10],   // near-black / deep navy
  c2: [0.03, 0.22, 0.32],   // dark teal
  c3: [0.55, 0.32, 0.06],   // amber-brown
  c4: [0.88, 0.82, 0.70],   // warm off-white highlight
};
/* ─────────────────────────────────────────────────────────────────────────*/

const BackgroundShader = (() => {

  const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_speed;
uniform int   u_octaves;
uniform float u_warp;
uniform float u_zoom;
uniform float u_scroll;
uniform vec3  u_c1, u_c2, u_c3, u_c4;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i+vec2(0,0)), f-vec2(0,0)), dot(hash2(i+vec2(1,0)), f-vec2(1,0)), u.x),
    mix(dot(hash2(i+vec2(0,1)), f-vec2(0,1)), dot(hash2(i+vec2(1,1)), f-vec2(1,1)), u.x),
    u.y);
}

float fbm(vec2 p, int oct) {
  float v = 0.0, a = 0.5, f = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    v += a * gnoise(p * f);
    f *= 2.0; a *= 0.5;
  }
  return v;
}

float warpedFbm(vec2 p, int oct, float w) {
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0), oct),
                fbm(p + vec2(5.2, 1.3), oct));
  vec2 r = vec2(fbm(p + w * q + vec2(1.7, 9.2), oct),
                fbm(p + w * q + vec2(8.3, 2.8), oct));
  return fbm(p + w * r, oct);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  uv *= u_zoom;

  // Infinite travel: linear drift at an irrational angle so it never visibly repeats
  float t = u_time * u_speed;
  vec2 p = uv + vec2(t * 0.13, t * 0.07);

  // Parallax: offset by scroll position
  p.y += u_scroll;

  float f = warpedFbm(p, u_octaves, u_warp);
  float n = clamp(f * 0.5 + 0.5, 0.0, 1.0);

  vec3 col = mix(u_c1, u_c2, smoothstep(0.00, 0.35, n));
  col      = mix(col,  u_c3, smoothstep(0.35, 0.70, n));
  col      = mix(col,  u_c4, smoothstep(0.70, 1.00, n));

  gl_FragColor = vec4(col, 1.0);
}
`;

  function compileShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('BackgroundShader:', gl.getShaderInfoLog(s));
    return s;
  }

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) { console.warn('BackgroundShader: container not found:', containerId); return; }

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;';
    container.style.position = 'relative';
    container.insertBefore(canvas, container.firstChild);

    // Everything else in the container floats above
    Array.from(container.children).forEach(el => {
      if (el !== canvas && !el.style.zIndex) el.style.zIndex = '1';
    });

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { console.warn('BackgroundShader: WebGL unavailable'); return; }

    const prog = gl.createProgram();
    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER,   VERT));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = n => gl.getUniformLocation(prog, n);
    const uRes    = U('u_res'),   uTime   = U('u_time'),  uSpd    = U('u_speed');
    const uOct    = U('u_octaves'), uWarp = U('u_warp'),  uZoom   = U('u_zoom');
    const uScroll = U('u_scroll');
    const uC1 = U('u_c1'), uC2 = U('u_c2'), uC3 = U('u_c3'), uC4 = U('u_c4');

    const C = SHADER_CONFIG;
    gl.uniform3fv(uC1, C.c1); gl.uniform3fv(uC2, C.c2);
    gl.uniform3fv(uC3, C.c3); gl.uniform3fv(uC4, C.c4);

    // Single warp slider — top-centered, wide
    const ui = document.createElement('div');
    ui.style.cssText = [
      'position:absolute', 'top:1.2em', 'left:50%', 'transform:translateX(-50%)',
      'z-index:2'
    ].join(';');

    const warpSlider = document.createElement('input');
    warpSlider.type = 'range'; warpSlider.min = 0; warpSlider.max = 280;
    warpSlider.value = Math.round(C.warp * 100); warpSlider.title = 'warp';
    warpSlider.style.cssText = 'width:360px;accent-color:rgba(255,255,255,0.35);opacity:0.45;cursor:pointer;';

    ui.appendChild(warpSlider);
    container.appendChild(ui);

    // Parallax via scroll
    let scrollOffset = 0;
    function updateScroll() {
      const rect = container.getBoundingClientRect();
      const frac = -rect.top / (rect.height + window.innerHeight);
      scrollOffset = frac * C.parallax * 4.0;
    }
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();

    // Render loop
    const timeOffset = Math.random() * 10000; // random start position
    let start = null;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = (canvas.clientWidth  * dpr) | 0;
      const h = (canvas.clientHeight * dpr) | 0;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    function render(ts) {
      if (!start) start = ts;
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes,    canvas.width, canvas.height);
      gl.uniform1f(uTime,   (ts - start) / 1000 + timeOffset);
      gl.uniform1f(uSpd,    C.speed);
      gl.uniform1i(uOct,    C.octaves);
      gl.uniform1f(uWarp,   warpSlider.value  / 100);
      gl.uniform1f(uZoom,   C.zoom);
      gl.uniform1f(uScroll, scrollOffset);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  return { init };
})();