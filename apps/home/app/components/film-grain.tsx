"use client";

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}`;
const FRAG = `
precision mediump float;
uniform float t;
uniform vec2 r;
float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  float n=rand(uv+t)*0.12;
  gl_FragColor=vec4(vec3(n),1.0);
}`;

export function FilmGrain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const gl = c.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const aLoc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

    const tLoc = gl.getUniformLocation(prog, "t");
    const rLoc = gl.getUniformLocation(prog, "r");

    let raf: number;
    let lastFrame = 0;

    function resize() {
      const dpr = Math.min(devicePixelRatio, 1);
      c!.width = c!.clientWidth * dpr;
      c!.height = c!.clientHeight * dpr;
      gl!.viewport(0, 0, c!.width, c!.height);
    }

    function frame(now: number) {
      if (now - lastFrame < 50) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastFrame = now;
      gl!.uniform1f(tLoc, now * 0.001);
      gl!.uniform2f(rLoc, c!.width, c!.height);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 150,
        mixBlendMode: "overlay",
        opacity: 0.045,
      }}
    />
  );
}
