"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * "Knowledge network" background: drifting nodes that link up when close.
 * - Raw three.js (no r3f) to keep the dependency surface small.
 * - Theme-aware (watches the `dark` class on <html>).
 * - Pauses off-screen / hidden tab; renders one static frame for prefers-reduced-motion.
 * - Fully disposes GPU resources on unmount. Silently renders nothing if WebGL is unavailable.
 */

const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#7C3AED";
const CYAN = "#06B6D4";
const LINK_DISTANCE = 2.6;
const CAM_Z = 9;

export default function ThreeBG({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: the page background simply shows through
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = host.clientWidth < 640 ? 55 : 110;
    const MAX_SEGMENTS = N * 6;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 50);
    camera.position.z = CAM_Z;
    const group = new THREE.Group();
    scene.add(group);

    // --- node state: normalised coords in [-1,1] so resizing never reshuffles the layout
    const norm = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const pos = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const violet = new THREE.Color(VIOLET);
    const cyan = new THREE.Color(CYAN);
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < 3; k++) {
        norm[i * 3 + k] = Math.random() * 2 - 1;
        vel[i * 3 + k] = (Math.random() - 0.5) * 0.0016;
      }
      (Math.random() < 0.18 ? cyan : violet).toArray(colors, i * 3);
    }

    // --- points
    const dot = document.createElement("canvas");
    dot.width = dot.height = 64;
    const dctx = dot.getContext("2d")!;
    const grad = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    dctx.fillStyle = grad;
    dctx.fillRect(0, 0, 64, 64);
    const dotTex = new THREE.CanvasTexture(dot);
    dotTex.colorSpace = THREE.SRGBColorSpace;

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    pointsGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pointsMat = new THREE.PointsMaterial({
      size: 0.16,
      map: dotTex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });
    group.add(new THREE.Points(pointsGeo, pointsMat));

    // --- links (per-vertex alpha via a tiny shader)
    const linePos = new Float32Array(MAX_SEGMENTS * 6);
    const lineAlpha = new Float32Array(MAX_SEGMENTS * 2);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeo.setAttribute("alpha", new THREE.BufferAttribute(lineAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    const lineMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(VIOLET) }, uOpacity: { value: 0.4 } },
      vertexShader: `attribute float alpha; varying float vA;
        void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ gl_FragColor = vec4(uColor, vA * uOpacity);
        #include <colorspace_fragment>
        }`,
    });
    group.add(new THREE.LineSegments(lineGeo, lineMat));

    // --- theme
    const applyTheme = () => {
      const dark = document.documentElement.classList.contains("dark");
      lineMat.uniforms.uColor.value.set(dark ? VIOLET : VIOLET_DEEP);
      lineMat.uniforms.uOpacity.value = dark ? 0.4 : 0.3;
      pointsMat.opacity = dark ? 0.9 : 0.75;
    };
    applyTheme();
    const themeObserver = new MutationObserver(() => {
      applyTheme();
      if (!running) render();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // --- sizing
    let bx = 8, by = 5, bz = 3;
    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const visH = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      bx = (visH * camera.aspect) / 2 + 0.6;
      by = visH / 2 + 0.6;
      bz = 3;
      if (!running) render();
    };

    // --- simulation
    const step = () => {
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 3; k++) {
          const j = i * 3 + k;
          norm[j] += vel[j];
          if (norm[j] > 1 || norm[j] < -1) vel[j] *= -1;
        }
        pos[i * 3] = norm[i * 3] * bx;
        pos[i * 3 + 1] = norm[i * 3 + 1] * by;
        pos[i * 3 + 2] = norm[i * 3 + 2] * bz;
      }
      let seg = 0;
      for (let i = 0; i < N && seg < MAX_SEGMENTS; i++) {
        for (let j = i + 1; j < N && seg < MAX_SEGMENTS; j++) {
          const dx = pos[i * 3] - pos[j * 3];
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < LINK_DISTANCE) {
            const a = 1 - d / LINK_DISTANCE;
            linePos.set(pos.subarray(i * 3, i * 3 + 3), seg * 6);
            linePos.set(pos.subarray(j * 3, j * 3 + 3), seg * 6 + 3);
            lineAlpha[seg * 2] = lineAlpha[seg * 2 + 1] = a;
            seg++;
          }
        }
      }
      lineGeo.setDrawRange(0, seg * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.alpha.needsUpdate = true;
      pointsGeo.attributes.position.needsUpdate = true;
    };

    const target = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };

    const render = () => renderer.render(scene, camera);

    let running = false;
    let raf = 0;
    let inView = true;
    const loop = () => {
      if (!running) return;
      step();
      group.rotation.y += (target.x * 0.12 - group.rotation.y) * 0.03;
      group.rotation.x += (-target.y * 0.08 - group.rotation.x) * 0.03;
      render();
      raf = requestAnimationFrame(loop);
    };
    const syncRunning = () => {
      const should = !reduceMotion && inView && !document.hidden;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(loop);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    resize();
    step();
    render(); // first frame (also the only frame under reduced motion)

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncRunning();
    });
    io.observe(host);
    document.addEventListener("visibilitychange", syncRunning);
    if (!reduceMotion) window.addEventListener("pointermove", onPointer, { passive: true });
    syncRunning();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", syncRunning);
      window.removeEventListener("pointermove", onPointer);
      pointsGeo.dispose();
      pointsMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      dotTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className={className} />;
}