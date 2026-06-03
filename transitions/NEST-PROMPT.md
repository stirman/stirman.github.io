# Agent prompt — image-to-image transition effects for before/after video export

Paste everything below to your coding agent.

---

## What I want to build

I have a working set of **11 image-to-image transition effects** (WebGL shaders + a GPU
particle system + one 2D-canvas physics effect). I want to integrate them into my web app
prototype so that, when a user finishes editing an image, they can **export a short
before→after video** and **pick which transition effect** plays between the original and
the edited image.

Reference implementation (a standalone gallery of all 11 running live):
**https://stirman.net/transitions/** — view source there to see every effect in context.

Below is everything you need: the mental model, the exact shader/JS code for each
transition, the shared helpers, and — critically — how to turn these *real-time* effects
into a *deterministic video export*.

---

## Core mental model (read this first)

Every transition is a **pure function of `progress` ∈ [0,1]** that blends two images,
`before` (the original) and `after` (the edit):

- `progress = 0` → renders exactly the `before` image (pixel-identity).
- `progress = 1` → renders exactly the `after` image (pixel-identity).
- In between → the effect.

This is the key property that makes video export clean: **you drive `progress` by frame
index**, not by wall-clock time. For a `D`-second clip at `F` fps:

```
totalFrames = round(D * F)
for frame in 0..totalFrames:
    p_linear = frame / totalFrames
    p = ease(p_linear)          // per-transition easing curve, see table
    renderFrame(p)              // draw one frame to the canvas
    encodeFrame(canvas)         // hand the canvas to the video encoder
```

There is **no `requestAnimationFrame` and no GSAP in the export path** — those are only for
the live preview. The original gallery uses GSAP purely as a tweening clock; for export you
replace it with the loop above plus the easing functions provided below.

### Two families of effects

1. **Shader transitions (9 of them):** a full-screen WebGL quad whose fragment shader
   samples both images (`uBefore`, `uAfter`) and outputs an **opaque** blended frame. These
   are fully self-contained — one canvas, one draw call, nothing layered behind. Ideal for
   export. Each just needs `uProgress` plus a few per-run uniforms (a random seed, a
   direction, etc.).

2. **Two special effects** that, in the gallery, render a *transparent* overlay and reveal a
   DOM `<img>` of the `after` image sitting behind them:
   - **Shatter** — 2D `<canvas>` + a tiny physics loop (shards fly off, revealing behind).
   - **Particle dust** — WebGL `gl.POINTS` (image dissolves into ~50k particles).
   **For video export you must composite the `after` image into the same canvas as a
   backdrop first**, then draw the effect on top (instructions in their sections). You can't
   rely on a separate DOM layer when capturing a single canvas to video.

### `uReverse`
The gallery supports playing each effect both directions (it toggles) via a `uReverse`
uniform. **For before→after export you always go one direction, so set `uReverse = 0`.**
Keep the uniform in the shaders (harmless) or strip it — your call.

---

## Transition catalog

| id | Name | Family | Duration (s) | Easing | Per-run uniforms | Notes |
|----|------|--------|-------------|--------|------------------|-------|
| `cloth` | Cloth | shader | 1.2 | easeInQuad | `uSeed` | image falls away like a blanket |
| `shatter` | Shatter | 2D canvas + physics | ~2.6 | (physics, no ease) | (rng) | needs `after` backdrop |
| `gradient` | Gradient wipe | shader | 1.3 | easeInOutCubic | `uDir`, `uSeed` | wavy soft wipe |
| `glow` | Glow bloom | shader | 1.3 | easeInOutCubic | `uOrigin` | light blooms to white |
| `pixelBurn` | Pixel burn | shader | 1.8 | easeInOutQuad | `uSpots[3]`, `uSeed` | RGB pixel disintegration |
| `glitch` | Glitch | shader | 0.9 | easeInOutQuad | `uSeed` | datamosh / RGB split |
| `ripple` | Ripple | shader | 1.4 | easeInOutQuad | `uCenter` | water-drop wave |
| `laser` | Laser curve | shader | 1.4 | easeInOutCubic | `uSeed` | glowing cyan→blue ribbon |
| `shimmer` | Shimmer blur | shader | 1.5 | easeInOutCubic | `uSeed` | dreamy blur crossfade |
| `overlay` | Overlay morph | shader | 1.5 | easeInOutCubic | `uSeed` | liquid flow morph |
| `particle` | Particle dust | WebGL points | 1.6 | easeInQuad | (rng) | ~50k particles, needs `after` backdrop |
| `vortex` | Vortex twist | shader | 1.3 | easeInOutCubic | `uSeed` | spiral swirl |

Easing maps to GSAP names: `power1.in`=easeInQuad, `power1.inOut`=easeInOutQuad,
`power2.inOut`=easeInOutCubic. JS implementations below (no GSAP needed).

---

## Shared building blocks

### Easing (replaces GSAP)

```js
const Ease = {
  linear:        t => t,
  easeInQuad:    t => t * t,                                   // power1.in
  easeInOutQuad: t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2,   // power1.inOut
  easeInOutCubic:t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2, // power2.inOut
};
```

### WebGL quad scene (powers all 9 shader transitions)

Each shader transition is the same boilerplate (a full-screen triangle-strip quad with two
textures) plus a different fragment shader. This factory builds it and returns `render(p)`.

```js
// images: { before: HTMLImageElement|ImageBitmap|Canvas, after: same }
// fragSrc: the transition's fragment shader (see each transition below)
function createShaderTransition(canvas, fragSrc, images) {
  const gl = canvas.getContext('webgl', {
    premultipliedAlpha: false, alpha: true, preserveDrawingBuffer: true
  });
  const VERT = `attribute vec2 aPos; varying vec2 vUv;
    void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fragSrc));
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  ['uBefore','uAfter'].forEach((name, unit) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);  // texture v=0 at bottom; matches vUv
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
                  unit === 0 ? images.before : images.after);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0,0,0,0);
  const uProgress = gl.getUniformLocation(prog, 'uProgress');
  const uReverse  = gl.getUniformLocation(prog, 'uReverse');
  if (uReverse) gl.uniform1f(uReverse, 0.0);   // export is always before→after

  return {
    gl,
    loc: n => gl.getUniformLocation(prog, n),   // for per-run uniforms (uSeed, uDir, …)
    render(p) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uProgress, p);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}
```

**Per-run uniforms** (seed/direction/etc.) should be set **once** before the export loop so
the effect is consistent across all frames of a single export. Example for `gradient`:

```js
const ang = Math.random() * Math.PI * 2;
scene.gl.uniform2f(scene.loc('uDir'), Math.cos(ang), Math.sin(ang));
scene.gl.uniform1f(scene.loc('uSeed'), Math.random() * 50.0);
```
The exact `setup` for each transition is listed in its section.

---

## The 9 shader transitions (fragment shaders)

All use `precision mediump float;`, sample `uBefore`/`uAfter`, read `uProgress` (and
`uReverse`, kept 0). Drop each `frag` string into `createShaderTransition`. The `setup`
block shows the per-run uniforms to set once before exporting.

### cloth — duration 1.2, easeInQuad
setup: `uSeed = Math.random()*100`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(float x){
  return noise(vec2(x*1.5+uSeed,0.0))*0.6 + noise(vec2(x*4.0+uSeed*1.7,3.1))*0.3 + noise(vec2(x*9.0+uSeed*2.3,7.7))*0.1;
}
void main(){
  float p=uProgress;
  float delay = vUv.x*0.28 + (noise(vec2(vUv.x*4.0+uSeed,1.3))-0.5)*0.36;
  delay = max(delay,0.0);
  float cp = clamp((p-delay)/0.40,0.0,1.0); cp=cp*cp;
  float field=fbm(vUv.x);
  float sway=(sin(vUv.y*7.0-p*5.0+uSeed*6.2831)*0.035 + (noise(vec2(vUv.x*5.0+uSeed,vUv.y*4.0-p*2.0))-0.5)*0.05)*cp;
  float sy=vUv.y + cp*(1.15+1.0*field);
  vec2 fromUv=vec2(vUv.x+sway, sy);
  vec3 fromCol=mix(texture2D(uBefore,fromUv).rgb, texture2D(uAfter,fromUv).rgb, uReverse);
  vec3 toCol  =mix(texture2D(uAfter,vUv).rgb,     texture2D(uBefore,vUv).rgb,   uReverse);
  gl_FragColor=vec4(sy>1.0?toCol:fromCol, 1.0);
}
```

### gradient — duration 1.3, easeInOutCubic
setup: random `uDir` (unit vec2), `uSeed = Math.random()*50`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
uniform vec2 uDir;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){
  vec2 q=vUv-0.5;
  float proj=dot(q,uDir)+0.5;
  float t=dot(q,vec2(-uDir.y,uDir.x));
  float wave=sin(t*6.0+uSeed*6.2831)*0.05 + (noise(vec2(t*3.0+uSeed,uSeed))-0.5)*0.14;
  float edge=uProgress*2.2-0.6;
  float vis=smoothstep(edge-0.13, edge+0.13, proj+wave);
  vec3 fromCol=mix(texture2D(uBefore,vUv).rgb, texture2D(uAfter,vUv).rgb, uReverse);
  vec3 toCol  =mix(texture2D(uAfter,vUv).rgb,  texture2D(uBefore,vUv).rgb, uReverse);
  gl_FragColor=vec4(mix(toCol,fromCol,vis),1.0);
}
```

### glow — duration 1.3, easeInOutCubic
setup: `uOrigin = (0.25+rand*0.5, 0.25+rand*0.5)`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse;
uniform vec2 uOrigin;
void main(){
  float t=uProgress;
  vec3 fromCol=mix(texture2D(uBefore,vUv).rgb, texture2D(uAfter,vUv).rgb, uReverse);
  vec3 toCol  =mix(texture2D(uAfter,vUv).rgb,  texture2D(uBefore,vUv).rgb, uReverse);
  vec3 base=mix(fromCol,toCol, smoothstep(0.40,0.62,t));
  float g=pow(max(sin(t*3.14159265),0.0),1.25);          // max() avoids NaN at the ends
  float radial=smoothstep(0.95,0.0, distance(vUv,uOrigin));
  vec3 col=base + vec3(0.70,0.92,1.0)*g*(0.35+1.1*radial)*1.5;
  col=mix(col, vec3(1.0), g*radial*0.55);
  gl_FragColor=vec4(col,1.0);
}
```

### pixelBurn — duration 1.8, easeInOutQuad
setup: `uSpots` = Float32Array of 3 vec3 (xy in 0.2..0.8, z=rand*0.18); 2–3 active, rest parked at (9,9,0). `uSeed=rand*50`.
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
uniform vec3 uSpots[3];
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
const float CELLS=200.0;
void main(){
  vec2 cell=floor(vUv*CELLS);
  float cr=hash(cell+uSeed);
  float field=9.0; vec2 nearest=vec2(0.5);
  for(int i=0;i<3;i++){ float dd=distance(vUv,uSpots[i].xy)-uSpots[i].z; if(dd<field){field=dd;nearest=uSpots[i].xy;} }
  field += (noise(vUv*4.0+uSeed)-0.5)*0.18 + cr*0.05;
  float t=uProgress*1.8-0.45;
  float d=field-t;
  float band=0.14;
  float burning=1.0-smoothstep(0.0,band,abs(d));
  vec2 cellUv=(cell+0.5)/CELLS;
  vec2 outward=normalize(vUv-nearest+0.0001);
  vec2 disp=(outward*0.05 + vec2(cr-0.5,hash(cell+7.0)-0.5)*0.05)*burning;
  vec2 fromUv=mix(vUv,cellUv,burning)+disp;
  vec3 fromCol=mix(texture2D(uBefore,fromUv).rgb, texture2D(uAfter,fromUv).rgb, uReverse);
  vec3 toCol  =mix(texture2D(uAfter,vUv).rgb,     texture2D(uBefore,vUv).rgb,   uReverse);
  float a=smoothstep(-band,band*0.4,d);
  a *= 1.0 - step(cr,burning*0.9)*burning;
  vec3 col=mix(toCol,fromCol,a);
  float glow=pow(burning,2.0);
  float pick=hash(cell+uSeed*3.0);
  vec3 ember=vec3(0.92)+(hash(cell+1.3)-0.5)*0.12;
  ember=mix(ember, vec3(1.0,0.20,0.20), step(0.88,pick));
  ember=mix(ember, vec3(0.25,0.5,1.0),  step(0.76,pick)*step(pick,0.88));
  ember=mix(ember, vec3(1.0,0.90,0.20), step(0.64,pick)*step(pick,0.76));
  col += ember*glow*1.5;
  gl_FragColor=vec4(col,1.0);
}
```

### glitch — duration 0.9, easeInOutQuad
setup: `uSeed=rand*50`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453123); }
vec3 splitFrom(vec2 uv,float ca){
  vec3 b=vec3(texture2D(uBefore,uv+vec2(ca,0.)).r, texture2D(uBefore,uv).g, texture2D(uBefore,uv-vec2(ca,0.)).b);
  vec3 a=vec3(texture2D(uAfter, uv+vec2(ca,0.)).r, texture2D(uAfter, uv).g, texture2D(uAfter, uv-vec2(ca,0.)).b);
  return mix(b,a,uReverse);
}
vec3 splitTo(vec2 uv,float ca){
  vec3 b=vec3(texture2D(uBefore,uv+vec2(ca,0.)).r, texture2D(uBefore,uv).g, texture2D(uBefore,uv-vec2(ca,0.)).b);
  vec3 a=vec3(texture2D(uAfter, uv+vec2(ca,0.)).r, texture2D(uAfter, uv).g, texture2D(uAfter, uv-vec2(ca,0.)).b);
  return mix(a,b,uReverse);
}
void main(){
  float p=uProgress;
  float gi=pow(max(sin(p*3.14159265),0.0),0.7);    // max() avoids NaN
  float rows=22.0;
  float row=floor(vUv.y*rows);
  float tBlk=floor(p*14.0);
  float rr=hash(vec2(row,tBlk));
  float shift=(rr-0.5)*step(0.55,rr)*0.3*gi + (hash(vec2(row+3.0,tBlk))-0.5)*step(0.90,rr)*0.5*gi;
  vec2 uv=vec2(vUv.x+shift, vUv.y);
  float ca=0.02*gi*(0.5+rr);
  float sel=step(rr, smoothstep(0.35,0.65,p));
  sel=mix(smoothstep(0.4,0.6,p), sel, gi);
  vec3 col=mix(splitFrom(uv,ca), splitTo(uv,ca), sel);
  float blk=hash(vec2(floor(vUv.x*30.0)+tBlk*3.0, row));
  col += step(0.96,blk)*gi*0.8*vec3(hash(vec2(row,1.)),hash(vec2(row,2.)),hash(vec2(row,3.)));
  gl_FragColor=vec4(col,1.0);
}
```

### ripple — duration 1.4, easeInOutQuad
setup: `uCenter=(0.3+rand*0.4, 0.3+rand*0.4)`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse;
uniform vec2 uCenter;
void main(){
  float p=uProgress;
  vec2 d=vUv-uCenter; float dist=length(d);
  float radius=p*1.6; float w=dist-radius;
  float envelope=sin(p*3.14159265);
  float amp=0.045*sin(w*38.0)*exp(-abs(w)*7.0)*envelope;
  vec2 uv=vUv + (d/max(dist,0.001))*amp;
  float sel=smoothstep(0.08,-0.08,w);
  vec3 fromCol=mix(texture2D(uBefore,uv).rgb, texture2D(uAfter,uv).rgb, uReverse);
  vec3 toCol  =mix(texture2D(uAfter,uv).rgb,  texture2D(uBefore,uv).rgb, uReverse);
  gl_FragColor=vec4(mix(fromCol,toCol,sel),1.0);
}
```

### laser — duration 1.4, easeInOutCubic
setup: `uSeed=rand*6.28`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
void main(){
  float p=uProgress;
  float env=max(sin(p*3.14159265),0.0);
  float band=vUv.y*0.7 + vUv.x*0.3 + 0.22*sin(vUv.x*3.0+uSeed);
  float dd=band - mix(-0.5,1.5,p);
  float sel=smoothstep(0.02,-0.02,dd);
  vec3 fromCol=mix(texture2D(uBefore,vUv).rgb, texture2D(uAfter,vUv).rgb, uReverse);
  vec3 toCol  =mix(texture2D(uAfter,vUv).rgb,  texture2D(uBefore,vUv).rgb, uReverse);
  vec3 base=mix(fromCol,toCol,sel);
  float beam=exp(-abs(dd)*22.0);
  float glow=exp(-abs(dd)*6.0)*0.5;
  vec3 laserCol=mix(vec3(0.15,1.0,0.85), vec3(0.25,0.45,1.0), clamp(vUv.x,0.0,1.0));
  gl_FragColor=vec4(base + laserCol*(beam+glow)*env*1.6, 1.0);
}
```

### shimmer — duration 1.5, easeInOutCubic
setup: `uSeed=rand*50`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
vec3 blurTex(sampler2D tex, vec2 uv, float r){
  vec3 c=texture2D(tex,uv).rgb;
  c+=texture2D(tex,uv+vec2(r,0.)).rgb; c+=texture2D(tex,uv+vec2(-r,0.)).rgb;
  c+=texture2D(tex,uv+vec2(0.,r)).rgb; c+=texture2D(tex,uv+vec2(0.,-r)).rgb;
  c+=texture2D(tex,uv+vec2(r,r)*0.7).rgb;  c+=texture2D(tex,uv+vec2(-r,r)*0.7).rgb;
  c+=texture2D(tex,uv+vec2(r,-r)*0.7).rgb; c+=texture2D(tex,uv+vec2(-r,-r)*0.7).rgb;
  return c/9.0;
}
void main(){
  float p=uProgress;
  float env=max(sin(p*3.14159265),0.0);
  vec2 warp=vec2(sin(vUv.y*18.0+uSeed+p*6.0), cos(vUv.x*16.0+uSeed*1.3+p*5.0))*0.012*env;
  vec2 uv=vUv+warp;
  float r=env*0.05;
  vec3 B=blurTex(uBefore,uv,r), A=blurTex(uAfter,uv,r);
  vec3 fromCol=mix(B,A,uReverse), toCol=mix(A,B,uReverse);
  vec3 col=mix(fromCol,toCol, smoothstep(0.30,0.70,p));
  float sweep=sin((vUv.x+vUv.y)*3.0 - p*8.0);
  col += env*(0.06 + 0.10*smoothstep(0.7,1.0,sweep));
  gl_FragColor=vec4(col,1.0);
}
```

### overlay — duration 1.5, easeInOutCubic
setup: `uSeed=rand*50`
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
vec3 smear(sampler2D tex, vec2 uv, vec2 dir){
  vec3 c=vec3(0.0);
  for(int k=0;k<5;k++){ c+=texture2D(tex, uv+dir*(float(k)/4.0-0.5)).rgb; }
  return c/5.0;
}
void main(){
  float p=uProgress;
  float env=sin(p*3.14159265);
  vec2 flow=vec2(noise(vUv*3.0+vec2(uSeed,p*1.6)), noise(vUv*3.0+vec2(uSeed+5.2,1.3+p*1.6)))-0.5;
  flow*=0.28*env;
  vec2 uv=vUv+flow*0.5; vec2 dir=flow*1.3;
  vec3 B=smear(uBefore,uv,dir), A=smear(uAfter,uv,dir);
  vec3 fromCol=mix(B,A,uReverse), toCol=mix(A,B,uReverse);
  gl_FragColor=vec4(mix(fromCol,toCol, smoothstep(0.30,0.70,p)), 1.0);
}
```

### vortex — duration 1.3, easeInOutCubic
setup: `uSeed=Math.random()` (used only as a 0/1 spin-direction switch)
```glsl
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBefore, uAfter;
uniform float uProgress, uReverse, uSeed;
void main(){
  float p=uProgress;
  float env=sin(p*3.14159265);
  vec2 c=vUv-0.5; float r=length(c); float ang=atan(c.y,c.x);
  float dir=uSeed>0.5?1.0:-1.0;
  ang += dir*env*7.0*(0.6-r);
  vec2 uv=vec2(0.5)+vec2(cos(ang),sin(ang))*r*(1.0-0.25*env);
  vec3 fromCol=mix(texture2D(uBefore,uv).rgb, texture2D(uAfter,uv).rgb, uReverse);
  vec3 toCol  =mix(texture2D(uAfter,uv).rgb,  texture2D(uBefore,uv).rgb, uReverse);
  vec3 col=mix(fromCol,toCol, smoothstep(0.4,0.6,p));
  col += exp(-pow((r-0.5*env)*8.0,2.0))*env*0.15;
  gl_FragColor=vec4(col,1.0);
}
```

---

## The two special transitions

### Particle dust (WebGL `gl.POINTS`, ~50k particles)

Image becomes an `N×N` grid (N=224 → ~50,176) of point sprites; each takes the color of the
image at its home position, blasts outward with turbulence, and fades. In the gallery a DOM
`<img>` of the `after` image sits behind. **For export: first draw the `after` image as an
opaque full-screen backdrop into the same canvas, then additively/alpha-blend the fading
particles of the `before` image on top.** Two clean ways to do that in one WebGL canvas:

- **Easiest:** keep a 2D canvas for compositing — draw `after` with `drawImage`, then draw
  the particle WebGL canvas on top with `drawImage`. Capture the 2D canvas.
- **Single GL context:** render a full-screen textured quad of `after` first (reuse the quad
  from `createShaderTransition` with a trivial `gl_FragColor = texture2D(uAfter, vUv)`
  shader), then draw the points pass over it (same framebuffer, blending on).

Particle passes (vertex + fragment). Build two `Float32Array` attribute buffers `aHome`
(cell centers, `(i+0.5)/N`) and `aRand` (two randoms per particle). Texture = the `before`
image, **uploaded with `UNPACK_FLIP_Y_WEBGL = false`** (note: opposite of the shader quad).
`uPx = canvasWidthPx / N`. Drive with `p = ease(frame/total)` (easeInQuad), no rAF.

```glsl
// vertex
attribute vec2 aHome, aRand;
uniform float uProgress, uPx;
varying vec2 vHome; varying float vAlpha;
void main(){
  float p=uProgress;
  float local=clamp((p-aRand.x*0.35)/0.65,0.0,1.0);
  float e=local*local;
  vec2 outward=normalize(aHome-vec2(0.5)+vec2(0.0001));
  vec2 turb=vec2(sin(aRand.x*40.0+aRand.y*13.0), cos(aRand.y*37.0+aRand.x*7.0));
  vec2 pos=aHome + outward*e*0.18 + turb*e*0.33 + vec2(0.0,-e*0.22);
  vHome=aHome; vAlpha=1.0-local;
  gl_PointSize=uPx*(1.0+e*2.5)+1.0;
  gl_Position=vec4(pos.x*2.0-1.0, -(pos.y*2.0-1.0), 0.0, 1.0);
}
```
```glsl
// fragment
precision mediump float;
uniform sampler2D uTex;          // the BEFORE image (flip-Y = false)
varying vec2 vHome; varying float vAlpha;
void main(){
  vec3 c=texture2D(uTex, vHome).rgb;
  float d=length(gl_PointCoord-0.5);
  float round=smoothstep(0.5,0.25,d);
  float mask=mix(1.0, round, clamp((1.0-vAlpha)*1.5,0.0,1.0));
  gl_FragColor=vec4(c, vAlpha*mask);
}
```
Optional polish from the gallery: a crisp full-res `before` image is shown for the first
~10% then cross-faded to the particle grid, so the start is pixel-sharp. For export you can
replicate by compositing the `before` image at `alpha = max(0, 1 - p/0.1)` over the particle
pass for the first few frames.

### Shatter (2D canvas + tiny physics)

Image is split into a jittered grid of triangles (≈288 shards); each blasts outward and
falls under gravity, revealing behind. **For export: draw the `after` image as the backdrop
each frame, then draw the falling shards of the `before` image on top.** This effect is
**time-based, not progress-based** — step it with a **fixed `dt = 1/fps` per frame** so the
export is deterministic and frame-rate independent. Total duration ≈ 2.6 s. Full algorithm
(grid → triangles → per-shard velocity/gravity/spin → per-frame clip+draw) is in the
reference source at https://stirman.net/transitions/ (search `Shatter`); replicate it but
add `ctx.drawImage(afterImage, …cover…)` as the first draw of every frame.

> If you want to ship faster, you can **launch with the 9 shader transitions + particle
> dust** (all clean single-canvas effects) and add Shatter later — it's the only one that
> needs the 2D-canvas physics loop.

---

## Video export pipeline

Render frames deterministically and encode. Two options:

### Option A — WebCodecs (recommended: real MP4, frame-exact)

Needs a muxer (`mp4-muxer` for H.264 MP4, or `webm-muxer`). Pseudocode:

```js
async function exportTransition({ before, after, transitionId, width, height, fps = 30 }) {
  const { fragOrSpecial, duration, ease, setup } = REGISTRY[transitionId];
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const scene = createShaderTransition(canvas, fragOrSpecial, { before, after }); // or special builder
  setup?.(scene);

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: console.error,
  });
  encoder.configure({ codec: 'avc1.4D0028', width, height, framerate: fps,
                      bitrate: 8_000_000 });

  const total = Math.round(duration * fps);
  for (let f = 0; f <= total; f++) {
    const p = ease(f / total);
    scene.render(p);                      // draw one frame to canvas
    const frame = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / fps),
                                           duration: Math.round(1e6 / fps) });
    encoder.encode(frame, { keyFrame: f % fps === 0 });
    frame.close();
  }
  await encoder.flush();
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
```

### Option B — MediaRecorder (simpler, WebM, no extra deps)

Use `canvas.captureStream(0)` and push frames manually so timing is deterministic:

```js
const stream = canvas.captureStream(0);
const track = stream.getVideoTracks()[0];
const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8e6 });
const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
rec.start();
for (let f = 0; f <= total; f++) {
  scene.render(ease(f / total));
  track.requestFrame();
  await new Promise(r => setTimeout(r, 1000 / fps)); // pace ~ playback rate
}
rec.stop();
// await 'stop' → new Blob(chunks, { type: 'video/webm' })
```
WebM is widely supported but some sharing targets prefer MP4 — prefer Option A if WebCodecs
is available (Chromium-based browsers).

### Export details that matter
- **Resolution:** export at the edited image's native size (cap the long edge at ~1440–2160
  for file size). Match canvas `width`/`height` to that; the shaders are resolution
  independent.
- **Hold frames (nice to have):** prepend ~0.4 s of pure `before` and append ~0.6 s of pure
  `after` so the video reads as "here's the original… *transition*… here's the edit." Just
  emit extra frames at `p=0` / `p=1` before/after the transition loop.
- **Aspect:** the effects assume `before` and `after` are the **same dimensions** (they are
  for an edit of one image). If not, letterbox/cover both to a common size first.
- **Color:** images are treated as sRGB; no color management needed for parity with the live
  preview.

---

## Suggested integration / UX

1. **Registry:** one object mapping `id → { name, family, frag|builder, duration, ease, setup }`
   (table above). Adding an effect = one entry.
2. **Transition picker:** a row of labeled options (use the Names from the table). For each,
   show a tiny **looping preview** by running the live path (rAF + the easing) on a small
   canvas with the user's actual before/after — gives an instant, accurate thumbnail.
3. **Export button:** runs the pipeline above at full res, shows a progress bar
   (`f / total`), then offers download / share of the resulting `Blob`.
4. **Randomized params:** call each transition's `setup` once per export (and once per
   preview) so seeds/directions are stable within a clip. If you want reproducible exports,
   seed the RNG and store the seed with the export.

## Gotchas
- **`preserveDrawingBuffer: true`** is required on the GL context or captured/last frames can
  come out black.
- **`pow(sin(...), fraction)` → NaN/black** at the exact ends because `sin` can dip slightly
  negative in `mediump`. The shaders already wrap these in `max(…, 0.0)`. Keep that.
- **Texture flip:** the shader quad uploads textures with `UNPACK_FLIP_Y_WEBGL = true`; the
  particle pass uses `false`. Don't "fix" one to match the other.
- **CORS:** load the before/after images same-origin or with `crossOrigin = 'anonymous'`, or
  WebGL/canvas readback (and thus `VideoFrame`/capture) will throw a security error.
- **One GL context per effect.** If you build many simultaneously you can hit the browser's
  ~16-context limit — create the export context lazily and dispose it after each export
  (`gl.getExtension('WEBGL_lose_context').loseContext()`).
- **Mobile/perf:** `shimmer` (9 taps), `overlay` (5 taps ×2), and `particle` (~50k points)
  are the heaviest. Fine for export (offline loop); for live previews on weak devices, lower
  the preview resolution.
