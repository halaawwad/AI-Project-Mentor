import { useEffect, useState } from "react";
import * as THREE from "three";
import { CATALOG } from "./catalog";
import { buildModel } from "./models";
import {
  configureRenderer,
  createContactShadow,
  createContactShadowTexture,
  createEnvironment,
  createLightRig,
  readSceneTokens,
} from "./studio";

let cachedPreviews: Record<string, string> | undefined;

/** Render the actual workspace models once, using one temporary WebGL context. */
export function usePartPreviews() {
  const [previews, setPreviews] = useState<Record<string, string>>(cachedPreviews ?? {});

  useEffect(() => {
    if (cachedPreviews) return;
    let cancelled = false;
    let renderer: THREE.WebGLRenderer | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let shadowTexture: THREE.Texture | undefined;
    void (async () => {
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(192, 144);
        renderer.setClearColor(0x000000, 0);
        configureRenderer(renderer);
        const scene = new THREE.Scene();
        // Same studio as the catalog previews and the 3D Lab.
        const tokens = readSceneTokens(document.documentElement);
        environment = createEnvironment(renderer);
        scene.environment = environment.texture;
        scene.environmentIntensity = 0.55;
        scene.add(createLightRig(tokens));
        shadowTexture = createContactShadowTexture();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
        const images: Record<string, string> = {};
        for (const def of CATALOG) {
          if (cancelled) break;
          const model = buildModel(def);
          scene.add(model);
          const footprint = new THREE.Box3().setFromObject(model);
          const size = footprint.getSize(new THREE.Vector3());
          const shadow = createContactShadow(shadowTexture, size.x * 1.15 + 0.2, size.z * 1.15 + 0.2, tokens, 0.3);
          shadow.position.set(
            (footprint.min.x + footprint.max.x) / 2,
            footprint.min.y + 0.002,
            (footprint.min.z + footprint.max.z) / 2,
          );
          model.add(shadow);
          try {
            const bounds = footprint;
            const center = bounds.getCenter(new THREE.Vector3());
            const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
            const halfHeight = Math.max(radius * 1.15, 0.3);
            camera.left = (-halfHeight * 4) / 3;
            camera.right = (halfHeight * 4) / 3;
            camera.top = halfHeight;
            camera.bottom = -halfHeight;
            camera.position
              .copy(center)
              .add(new THREE.Vector3(2, 3, 4).normalize().multiplyScalar(10));
            camera.lookAt(center);
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
            images[def.id] = renderer.domElement.toDataURL("image/png");
          } finally {
            scene.remove(model);
            const materials = new Set<THREE.Material>();
            model.traverse((object) => {
              if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                const list = Array.isArray(object.material) ? object.material : [object.material];
                list.forEach((material) => materials.add(material));
              }
            });
            const textures = new Set<THREE.Texture>();
            materials.forEach((material) => {
              const map = (material as THREE.MeshBasicMaterial).map;
              if (map) textures.add(map);
              material.dispose();
            });
            textures.forEach((texture) => {
              if (texture !== shadowTexture) texture.dispose();
            });
          }
          if (!cancelled) setPreviews({ ...images });
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        if (!cancelled) {
          cachedPreviews = images;
          setPreviews(images);
        }
      } catch (error) {
        console.warn("Component previews could not be rendered", error);
      } finally {
        environment?.dispose();
        shadowTexture?.dispose();
        renderer?.dispose();
        renderer?.forceContextLoss();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return previews;
}
