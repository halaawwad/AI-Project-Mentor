// One shared "studio" for every 3D view (catalog thumbnails, catalog previews and showcase,
// 3D Lab): palette read from the design tokens, environment reflections, a soft key/fill/rim
// light rig, a breadboard-style grid and cheap contact shadows. Visual only: nothing here
// knows about pins, wiring or placement.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface SceneTokens {
  /** Page surface (breadboard plastic). Used for the lab background and ground. */
  board: THREE.Color;
  /** Datasheet ink, used (mixed into the board) for grid lines and contact shadows. */
  ink: THREE.Color;
  /** Solder-mask green: selection. */
  accent: THREE.Color;
  /** Power-rail red: flagged parts. */
  danger: THREE.Color;
  /** True when the surrounding UI uses a dark surface. */
  dark: boolean;
}

const FALLBACK = { board: "#eceeea", ink: "#16213a", accent: "#0b6e4f", danger: "#d0342c" };

function parseColor(value: string | undefined, fallback: string) {
  const v = value?.trim();
  // Custom properties resolve var() in computed style; accept plain colour syntaxes only.
  if (v && /^(#|rgb|hsl)/i.test(v)) {
    try {
      return new THREE.Color().setStyle(v.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]*\)/i, "rgb($1,$2,$3)"));
    } catch {
      /* fall through */
    }
  }
  return new THREE.Color(fallback);
}

/** Reads the design tokens from the nearest styled element (falls back to the light palette). */
export function readSceneTokens(el?: Element | null): SceneTokens {
  const css = el && typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
  const get = (name: string) => css?.getPropertyValue(name);
  const board = parseColor(get("--board") || get("--background"), FALLBACK.board);
  const ink = parseColor(get("--ink") || get("--foreground"), FALLBACK.ink);
  const hsl = { h: 0, s: 0, l: 0 };
  board.getHSL(hsl);
  return {
    board,
    ink,
    accent: parseColor(get("--solder") || get("--primary"), FALLBACK.accent),
    danger: parseColor(get("--rail-red") || get("--destructive"), FALLBACK.danger),
    dark: hsl.l < 0.4,
  };
}

/** PMREM environment from Three's procedural room: reflections for metal pins and glossy boards. */
export function createEnvironment(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  return target;
}

export function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
}

/**
 * Soft three-point rig. The key light alone casts shadows (one shadow map). Sky and ground
 * colours of the hemisphere light follow the tokens so parts pick up the page's bounce light.
 */
export function createLightRig(
  tokens: SceneTokens,
  { shadows = false, span = 25, mapSize = 2048 }: { shadows?: boolean; span?: number; mapSize?: number } = {},
) {
  const rig = new THREE.Group();
  rig.name = "studio-lights";
  const bounce = tokens.board.clone().lerp(new THREE.Color("#ffffff"), tokens.dark ? 0 : 0.2);
  rig.add(new THREE.HemisphereLight(tokens.dark ? "#cfd8ea" : "#f6f8ff", bounce, tokens.dark ? 0.7 : 0.95));
  const key = new THREE.DirectionalLight("#fff4e6", 2.3);
  key.position.set(7, 16, 9);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(mapSize, mapSize);
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.015;
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -span;
    cam.right = cam.top = span;
    cam.near = 1;
    cam.far = 60;
  }
  const fill = new THREE.DirectionalLight("#dde8ff", 0.65);
  fill.position.set(-10, 7, 5);
  const rim = new THREE.DirectionalLight("#ffffff", 1.25);
  rim.position.set(-3, 8, -11);
  rig.add(key, fill, rim);
  return rig;
}

/** A soft, rounded-rectangle shadow texture (white alpha mask, tinted by the material). */
export function createContactShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Stacked rounded rectangles give a soft falloff without canvas filters (Safari safe).
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      const inset = 4 + i * 2.2;
      const s = size - inset * 2;
      ctx.fillStyle = `rgba(255,255,255,${0.055})`;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") ctx.roundRect(inset, inset, s, s, Math.max(4, s * 0.28));
      else ctx.rect(inset, inset, s, s);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Flat shadow card under a footprint: grounds parts cheaply where no shadow map is used. */
export function createContactShadow(
  texture: THREE.Texture,
  width: number,
  depth: number,
  tokens: SceneTokens,
  opacity = 0.32,
) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: texture,
      color: tokens.dark ? "#000000" : tokens.ink,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.004;
  mesh.renderOrder = -1;
  mesh.name = "contact-shadow";
  mesh.raycast = () => {};
  return mesh;
}

/**
 * Breadboard grid: fine lines every 0.5 units (twice the 0.25 snap step) and stronger lines
 * every 2.5 units, echoing the five-hole blocks of a breadboard and of the UI background.
 */
export function createGrid(tokens: SceneTokens, size = 80) {
  const group = new THREE.Group();
  group.name = "studio-grid";
  const minorColor = tokens.board.clone().lerp(tokens.ink, tokens.dark ? 0.16 : 0.1);
  const majorColor = tokens.board.clone().lerp(tokens.ink, tokens.dark ? 0.3 : 0.2);
  const minor = new THREE.GridHelper(size, size * 2, minorColor, minorColor);
  const major = new THREE.GridHelper(size, size / 2.5, majorColor, majorColor);
  for (const [grid, y] of [
    [minor, 0.002],
    [major, 0.003],
  ] as const) {
    const material = grid.material as THREE.LineBasicMaterial;
    material.transparent = true;
    material.depthWrite = false;
    material.toneMapped = false;
    grid.position.y = y;
    grid.raycast = () => {};
    group.add(grid);
  }
  return group;
}
