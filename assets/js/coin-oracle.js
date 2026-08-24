/* coin-oracle.js
   Layout: two square coin cells stacked on the left, one 2x square oracle on the right.
   Overall dimensions: 3*UNIT wide, 2*UNIT tall.
   Change UNIT to resize everything.
*/

const CoinOracle = (() => {

  const MAX_UNIT = 190;

  const VERT = `attribute vec2 p; void main(){ gl_Position=vec4(p,0,1); }`;

  const FRAG_COIN = `
precision highp float;
uniform vec2 res;
uniform float t;
uniform float mode;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  float jitter = hash(uv + floor(t*24.0)*0.01);
  float axis = mode < 0.5 ? uv.x : uv.y;
  float perp  = mode < 0.5 ? uv.y : uv.x;
  float v = 0.0;
  for(int i=1; i<=6; i++){
    float fi = float(i);
    float phase = sin(perp*fi*1.7 + t*0.08*fi)*0.4;
    float s = sin(axis*12.0*fi + t*(0.5+fi*0.15) + phase + jitter*0.8);
    v += (s*0.5+0.5)/fi;
  }
  v /= 2.45;
  float noise = hash(uv*680.0 + floor(t*30.0)*vec2(1.0,1.7))*0.28;
  v = clamp(v*0.72 + noise + 0.08, 0.0, 1.0);
  gl_FragColor = vec4(vec3(v), 1.0);
}`;

  const FRAG_ORACLE = `
precision highp float;
uniform vec2 res;
uniform float t;
uniform float c1mode;
uniform float c2mode;
uniform float reveal;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float sig(vec2 uv, float mode, float off){
  float axis = mode < 0.5 ? uv.x : uv.y;
  float perp  = mode < 0.5 ? uv.y : uv.x;
  float jitter = hash(uv + floor((t+off)*24.0)*0.01);
  float v = 0.0;
  for(int i=1; i<=6; i++){
    float fi = float(i);
    float phase = sin(perp*fi*1.7+(t+off)*0.08*fi)*0.4;
    float s = sin(axis*12.0*fi+(t+off)*(0.5+fi*0.15)+phase+jitter*0.8);
    v += (s*0.5+0.5)/fi;
  }
  return v/2.45;
}
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  float noise = hash(uv*680.0+floor(t*30.0)*vec2(1.0,1.7))*0.28;
  float v;
  if(reveal < 0.5){
    v = noise*0.45 + 0.05;
  } else {
    float s1 = sig(uv, c1mode, 0.0);
    float s2 = sig(uv, c2mode, 13.7);
    if(abs(c1mode - c2mode) < 0.1){
      v = s1*s2*1.7 + noise*0.1;
    } else {
      v = (s1+s2)*0.58 + noise*0.14;
    }
    v = clamp(v*1.1+0.06, 0.0, 1.0);
  }
  gl_FragColor = vec4(vec3(v), 1.0);
}`;

  function mkGL(canvas, frag) {
    const gl = canvas.getContext('webgl');
    if (!gl) return null;
    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return { gl, prog };
  }

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const UNIT = Math.min(MAX_UNIT, Math.max(72, Math.floor(container.clientWidth / 3)));

    container.innerHTML = '';
    container.style.display = 'inline-flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-start';
    container.style.gap = '6px';

    // --- flip button on top ---
    const btn = document.createElement('button');
    btn.textContent = 'click to flip coins';
    btn.style.cssText = [
      'background:none', 'border:none', 'padding:0',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif',
      'font-size:0.85em', 'color:#aa701e', 'cursor:pointer',
      'letter-spacing:0.04em', 'opacity:0.8'
    ].join(';');
    btn.onmouseenter = () => btn.style.opacity = '1';
    btn.onmouseleave = () => btn.style.opacity = '0.8';
    container.appendChild(btn);

    // --- outer wrap: exactly 3*UNIT wide, 2*UNIT tall ---
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:relative',
      `width:${3 * UNIT}px`,
      `height:${2 * UNIT}px`,
      'border-radius:4px',
      'overflow:hidden',
      'border:0.5px solid rgba(0,0,0,0.15)'
    ].join(';');
    container.appendChild(wrap);

    // cell definitions: [left, top, width, height] all in UNIT multiples
    const cells = [
      { x: 0,    y: 0,    w: 1, h: 1, label: 'coin 1' },
      { x: 0,    y: 1,    w: 1, h: 1, label: 'coin 2' },
      { x: 1,    y: 0,    w: 2, h: 2, label: 'oracle'  },
    ];

    const canvases = [];

    cells.forEach((c, i) => {
      const cell = document.createElement('div');
      cell.style.cssText = [
        'position:absolute',
        `left:${c.x * UNIT}px`,
        `top:${c.y * UNIT}px`,
        `width:${c.w * UNIT}px`,
        `height:${c.h * UNIT}px`,
        'overflow:hidden'
      ].join(';');

      // borders between cells
      if (i === 0) cell.style.borderBottom = '0.5px solid rgba(0,0,0,0.1)';
      if (i === 0 || i === 1) cell.style.borderRight = '0.5px solid rgba(0,0,0,0.1)';

      const cv = document.createElement('canvas');
      cv.width  = c.w * UNIT;
      cv.height = c.h * UNIT;
      cv.style.cssText = 'width:100%; height:100%; display:block; filter:brightness(0.52);';
      cell.appendChild(cv);
      canvases.push(cv);

      const tag = document.createElement('div');
      tag.style.cssText = [
        'position:absolute', 'bottom:4px', 'left:0', 'right:0',
        'text-align:center',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif',
        'font-size:9px', 'letter-spacing:0.1em',
        'color:rgba(224, 211, 193, 0.61)', 'pointer-events:none'
      ].join(';');
      tag.textContent = c.label;
      cell.appendChild(tag);

      wrap.appendChild(cell);
    });

    // --- compile shaders ---
    const ctxs = [
      mkGL(canvases[0], FRAG_COIN),
      mkGL(canvases[1], FRAG_COIN),
      mkGL(canvases[2], FRAG_ORACLE)
    ];

    // --- state ---
    const S = { coins: [0, 0], reveal: 0, phase: 'idle' };

    function runFlip() {
      S.phase = 'flipping';
      S.reveal = 0;
      S.coins[0] = Math.random() < 0.5 ? 0 : 1;
      setTimeout(() => {
        S.coins[1] = Math.random() < 0.5 ? 0 : 1;
        setTimeout(() => {
          S.reveal = 1;
          S.phase = 'done';
        }, 350);
      }, 350);
    }

    btn.onclick = () => { if (S.phase !== 'flipping') runFlip(); };

    // --- render loop ---
    function draw(ts) {
      requestAnimationFrame(draw);
      const t = ts * 0.001;

      [0, 1].forEach(i => {
        if (!ctxs[i]) return;
        const { gl, prog } = ctxs[i];
        const cv = canvases[i];
        gl.viewport(0, 0, cv.width, cv.height);
        const u = n => gl.getUniformLocation(prog, n);
        gl.uniform2f(u('res'), cv.width, cv.height);
        gl.uniform1f(u('t'), t + i * 13.7);
        gl.uniform1f(u('mode'), S.coins[i]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });

      if (ctxs[2]) {
        const { gl, prog } = ctxs[2];
        const cv = canvases[2];
        gl.viewport(0, 0, cv.width, cv.height);
        const u = n => gl.getUniformLocation(prog, n);
        gl.uniform2f(u('res'), cv.width, cv.height);
        gl.uniform1f(u('t'), t);
        gl.uniform1f(u('c1mode'), S.coins[0]);
        gl.uniform1f(u('c2mode'), S.coins[1]);
        gl.uniform1f(u('reveal'), S.reveal);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    requestAnimationFrame(draw);

    // auto-run on load
    setTimeout(() => runFlip(), 120);
  }

  return { init };
})();