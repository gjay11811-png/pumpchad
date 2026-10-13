import * as THREE from 'three'
import type { Quality } from '../../save'

/**
 * Afternoon over CHAD CITY: a gradient sky dome with soft procedural clouds and a warm sun glow, a warm low
 * sun (the one shadow caster, following the player so a small shadow map stays sharp over a big map), a cool sky
 * fill from above and warm bounce from the ground. Optional sunset preset shares everything (only colours change).
 */
export type SkyPreset = 'afternoon' | 'sunset'
const PRESETS: Record<SkyPreset, { zenith: string; horizon: string; haze: string; sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number; elev: number; fog: string }> = {
  afternoon: { zenith: '#2f74d8', horizon: '#cfe4f7', haze: '#f6e7cf', sun: '#ffe6c2', sunI: 2.9, hemiSky: '#cfe2ff', hemiGround: '#b08a62', hemiI: 1.15, elev: 0.62, fog: '#c9dcee' },
  sunset: { zenith: '#3a4f9a', horizon: '#ffb98a', haze: '#ff8f5a', sun: '#ffb070', sunI: 2.4, hemiSky: '#b9b7e6', hemiGround: '#a06a48', hemiI: 0.95, elev: 0.26, fog: '#e2b49c' },
}
/** the sun comes from the south-west (behind the arriving player), so the gateway and the city facing it are lit */
const SUN_AZ = Math.PI * 0.82

export function skyPresetFromUrl(): SkyPreset {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sky') : null
  return q === 'sunset' ? 'sunset' : 'afternoon'
}

export function buildDaylight(scene: THREE.Scene, q: Quality, D: (THREE.Material | THREE.Texture | THREE.BufferGeometry)[], preset: SkyPreset = 'afternoon', renderer?: THREE.WebGLRenderer) {
  const P = PRESETS[preset]
  const sunDir = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(P.elev), Math.sin(P.elev), Math.cos(SUN_AZ) * Math.cos(P.elev)).normalize()

  // ── sky dome: gradient + sun glow + two layers of slow fbm clouds (one draw call, no textures) ──
  const skyGeo = new THREE.SphereGeometry(900, 48, 24)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(P.zenith) },
      uHorizon: { value: new THREE.Color(P.horizon) },
      uHaze: { value: new THREE.Color(P.haze) },
      uSun: { value: sunDir.clone() },
      uT: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w; // always behind everything
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uHaze, uSun;
      uniform float uT;
      varying vec3 vDir;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(y, 0.55));
        // warm haze band low on the horizon, strongest toward the sun
        float sunDot = max(dot(d, uSun), 0.0);
        col = mix(col, uHaze, (1.0 - smoothstep(0.0, 0.22, y)) * (0.35 + 0.45 * pow(sunDot, 3.0)));
        // sun disc + glow
        col += vec3(1.0, 0.92, 0.75) * (pow(sunDot, 900.0) * 3.0 + pow(sunDot, 24.0) * 0.28);
        // clouds: projected onto a high plane, fading near the horizon, lit on the sun side
        if (d.y > 0.02) {
          vec2 uv = d.xz / (d.y + 0.08) * 1.6 + vec2(uT * 0.006, uT * 0.002);
          float c = fbm(uv * 0.9);
          c = smoothstep(0.52, 0.78, c) * smoothstep(0.02, 0.22, d.y);
          float lit = 0.82 + 0.25 * pow(sunDot, 2.0);
          vec3 cloud = mix(vec3(0.86, 0.9, 0.97), vec3(1.0, 0.97, 0.9), sunDot) * lit;
          col = mix(col, cloud, c * 0.88);
        }
        // below the horizon: the valley haze
        if (d.y < 0.0) col = mix(uHorizon, uHaze * 0.9, min(1.0, -d.y * 4.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const sky = new THREE.Mesh(skyGeo, skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -10
  scene.add(sky)
  D.push(skyGeo, skyMat)
  scene.background = new THREE.Color(P.horizon)
  scene.fog = new THREE.FogExp2(P.fog, q === 'low' ? 0.0055 : 0.0042)

  // ── light: warm sun (shadows), cool sky fill + warm bounce ──
  const hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemiI)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(P.sun, P.sunI)
  sun.castShadow = q !== 'low'
  const size = q === 'high' ? 2048 : 1024
  sun.shadow.mapSize.set(size, size)
  const sc = sun.shadow.camera
  const EXT = q === 'high' ? 34 : 28
  sc.left = sc.bottom = -EXT
  sc.right = sc.top = EXT
  sc.near = 1
  sc.far = 160
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.05
  scene.add(sun, sun.target)
  // a soft cool fill from the opposite side keeps shaded facades readable (no shadows)
  const fill = new THREE.DirectionalLight('#a9c4ff', 0.45)
  fill.position.set(-sunDir.x * 40, 30, -sunDir.z * 40)
  scene.add(fill)

  // outdoor reflections: a small gradient world (sky → warm horizon → grass/stone ground) pre-filtered once,
  // so glass, gold, water and metal reflect the afternoon instead of the engine's indoor studio
  if (renderer) {
    const envScene = new THREE.Scene()
    const eg = new THREE.SphereGeometry(10, 32, 16)
    const em = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uZenith: { value: new THREE.Color(P.zenith) }, uHorizon: { value: new THREE.Color(P.horizon) }, uGround: { value: new THREE.Color('#7f8a5c') }, uSun: { value: sunDir.clone() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uZenith, uHorizon, uGround, uSun; varying vec3 vD;
        void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uHorizon, uZenith, pow(y, 0.6)) : mix(uHorizon * 0.8, uGround, min(1.0, -y * 3.0));
          c += vec3(1.0, 0.9, 0.7) * pow(max(dot(vD, uSun), 0.0), 64.0) * 4.0; gl_FragColor = vec4(c, 1.0); }`,
    })
    envScene.add(new THREE.Mesh(eg, em))
    const pm = new THREE.PMREMGenerator(renderer)
    const env = pm.fromScene(envScene, 0.02).texture
    pm.dispose()
    eg.dispose()
    em.dispose()
    scene.environment = env
    scene.environmentIntensity = 0.85
    D.push(env)
  }

  const texel = (EXT * 2) / size
  const focus = new THREE.Vector3()
  return {
    sunDir,
    preset,
    /** keep the shadow frustum centred on the player (snapped to shadow texels so edges don't crawl) */
    update(dt: number, player: THREE.Vector3) {
      skyMat.uniforms.uT.value += dt
      focus.set(Math.round(player.x / texel) * texel, 0, Math.round(player.z / texel) * texel)
      sun.target.position.copy(focus)
      sun.position.copy(focus).addScaledVector(sunDir, 80)
    },
  }
}
