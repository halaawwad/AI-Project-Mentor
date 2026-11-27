import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CATALOG_MAP } from "@/lib/lab/catalog";
import type { PartDef } from "@/lib/lab/catalog";
import { buildModel } from "@/lib/lab/models";
import { createCatalogDemo } from "@/lib/lab/catalogDemo";
import {
  configureRenderer,
  createContactShadow,
  createContactShadowTexture,
  createEnvironment,
  createLightRig,
  readSceneTokens,
} from "@/lib/lab/studio";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export function ComponentPreview({
  model,
  showcase = false,
  demoCategory,
  definition,
}: {
  model: string;
  showcase?: boolean;
  demoCategory?: number;
  definition?: PartDef;
}) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<{ zoom: (factor: number) => void; reset: () => void } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    const def = definition ?? CATALOG_MAP[model];
    if (!element || !def) return;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let part: THREE.Group | undefined;
    let observer: ResizeObserver | undefined;
    let visibilityObserver: IntersectionObserver | undefined;
    let inView = true;
    let frame = 0;
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    let environment: THREE.WebGLRenderTarget | undefined;
    let shadow: THREE.Mesh | undefined;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, showcase ? 2.5 : 2));
      configureRenderer(renderer);
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive component: drag to rotate, scroll to zoom",
      );
      element.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      // Same studio as the 3D Lab: token palette, room reflections, key/fill/rim lights.
      const tokens = readSceneTokens(element);
      environment = createEnvironment(renderer);
      scene.environment = environment.texture;
      scene.environmentIntensity = 0.55;
      scene.add(createLightRig(tokens));
      part = buildModel(def);
      scene.add(part);
      const bounds = new THREE.Box3().setFromObject(part);
      const footprint = bounds.getSize(new THREE.Vector3());
      shadow = createContactShadow(
        createContactShadowTexture(),
        footprint.x * 1.18 + 0.2,
        footprint.z * 1.18 + 0.2,
        tokens,
        0.3,
      );
      shadow.position.set((bounds.min.x + bounds.max.x) / 2, bounds.min.y + 0.002, (bounds.min.z + bounds.max.z) / 2);
      scene.add(shadow);
      const center = bounds.getCenter(new THREE.Vector3());
      const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.1);
      const demo =
        showcase && demoCategory !== undefined ? createCatalogDemo(part, def, demoCategory) : null;
      const camera = new THREE.PerspectiveCamera(40, 1, radius / 100, radius * 100);
      camera.position
        .copy(center)
        .add(
          new THREE.Vector3(2, 3, 4).normalize().multiplyScalar(radius * (showcase ? 3.05 : 3.6)),
        );
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(center);
      controls.minDistance = radius * 1.2;
      controls.maxDistance = radius * 9;
      controls.enablePan = true;
      if (showcase) {
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.enableDamping = true;
        controls.autoRotateSpeed = 0.65;
      }
      controls.update();
      controls.saveState();
      const draw = () => renderer?.render(scene, camera);
      controls.addEventListener("change", draw);
      if (showcase) {
        if (window.IntersectionObserver) {
          visibilityObserver = new IntersectionObserver((entries) => {
            inView = entries[0]?.isIntersecting ?? true;
          });
          visibilityObserver.observe(element);
        }
        const started = performance.now();
        let previous = started;
        const animate = (now: number) => {
          if (!inView || document.hidden) {
            previous = now;
            frame = requestAnimationFrame(animate);
            return;
          }
          const reduced =
            matchMedia("(prefers-reduced-motion: reduce)").matches ||
            document.documentElement.dataset["workspaceMotion"] === "off";
          const elapsed = Math.max(0, (now - started) / 1000);
          const t = reduced ? 1 : Math.min(1, elapsed / 0.85),
            ease = 1 - Math.pow(1 - t, 3);
          if (part) {
            part.scale.setScalar(0.72 + 0.28 * ease);
            part.position.y = (1 - ease) * radius * 0.3;
          }
          demo?.(reduced ? 1.8 : elapsed);
          controls!.autoRotate = !reduced;
          controls!.update(Math.max(0, Math.min((now - previous) / 1000, 0.05)));
          previous = now;
          draw();
          frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      }
      actions.current = {
        zoom: (factor) => {
          const offset = camera.position.clone().sub(controls!.target);
          offset.setLength(
            THREE.MathUtils.clamp(offset.length() * factor, radius * 1.2, radius * 9),
          );
          camera.position.copy(controls!.target).add(offset);
          controls!.update();
          draw();
        },
        reset: () => {
          controls!.reset();
          draw();
        },
      };
      observer = new ResizeObserver(() => {
        const width = element.clientWidth,
          height = element.clientHeight;
        if (!width || !height) return;
        renderer!.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        draw();
      });
      observer.observe(element);
    } catch {
      setFailed(true);
    }
    return () => {
      actions.current = null;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      visibilityObserver?.disconnect();
      controls?.dispose();
      part?.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
          (Array.isArray(object.material) ? object.material : [object.material]).forEach(
            (material) => materials.add(material),
          );
        }
      });
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      if (shadow) {
        shadow.geometry.dispose();
        const material = shadow.material as THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
      }
      environment?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, [model, showcase, demoCategory, definition]);
  return (
    <div className={`component-preview ${showcase ? "component-preview-showcase" : ""}`}>
      <div ref={host} className="component-preview-canvas" />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center text-xs">
          3D preview is unavailable in this browser.
        </p>
      )}
      <div className="component-preview-controls">
        <button type="button" aria-label="Zoom in" onClick={() => actions.current?.zoom(0.8)}>
          <ZoomIn size={14} />
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => actions.current?.zoom(1.25)}>
          <ZoomOut size={14} />
        </button>
        <button type="button" aria-label="Reset view" onClick={() => actions.current?.reset()}>
          <RotateCcw size={14} />
        </button>
      </div>
      <span className="component-preview-hint">Drag to rotate · Scroll to zoom</span>
    </div>
  );
}
