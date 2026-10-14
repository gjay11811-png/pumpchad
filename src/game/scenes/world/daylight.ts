import * as THREE from 'three'
import type { Quality } from '../../save'

/**
 * Afternoon over CHAD CITY: a gradient sky dome with soft procedural clouds and a warm sun glow, a warm low
 * sun (the one shadow caster, following the player so a small shadow map stays sharp over a big map), a cool sky
 * fill from above and warm bounce from the ground. Optional sunset preset shares everything (only colours change).
 */
export type SkyPreset = 'night' | 'afternoon' | 'sunset'
const PRESETS: Record<SkyPreset, { zenith: string; horizon: string; haze: string; sun: string; sunI: number; hemiSky: string; hemiGround: string; hemiI: number; elev: number; fog: string }> = {
  // cinematic dark fantasy: midnight-blue zenith, violet horizon glow, a cool moon key light, a lilac sky fill
  night: { zenith: '#060a26', horizon: '#2a2556', haze: '#5b3a82', sun: '#a9b8ff', sunI: 1.5, hemiSky: '#5d6cc4', hemiGround: '#3a2a3e', hemiI: 1.25, elev: 0.78, fog: '#1e1a3a' },
  afternoon: { zenith: '#2f74d8', horizon: '#cfe4f7', haze: '#f6e7cf', sun: '#ffe6c2', sunI: 2.9, hemiSky: '#cfe2ff', hemiGround: '#b08a62', hemiI: 1.15, elev: 0.62, fog: '#c9dcee' },
  sunset: { zenith: '#3a4f9a', horizon: '#ffb98a', haze: '#ff8f5a', sun: '#ffb070', sunI: 2.4, hemiSky: '#b9b7e6', hemiGround: '#a06a48', hemiI: 0.95, elev: 0.26, fog: '#e2b49c' },
}
/** the sun comes from the south-west (behind the arriving player), so the gateway and the city facing it are lit */
const SUN_AZ = Math.PI * 0.82

/** night by default (the Chadverse's identity); `?sky=day` / `?sky=sunset` keep the daytime looks for review */
export function skyPresetFromUrl(): SkyPreset {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('sky') : null
  return q === 'sunset' ? 'sunset' : q === 'day' || q === 'afternoon' ? 'afternoon' : 'night'
}
export const isNight = () => skyPresetFromUrl() === 'night'
/** where the moon hangs: high over the citadel, a little east, seen from the arrival forecourt */
const MOON = new THREE.Vector3(0.28, 0.4, -0.87).normalize()

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
      uMoon: { value: MOON.clone() },
      uNight: { value: preset === 'night' ? 1 : 0 },
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
      uniform vec3 uZenith, uHorizon, uHaze, uSun, uMoon;
      uniform float uT, uNight;
      varying vec3 vDir;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      vec3 nightSky(vec3 d) {
        float y = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(y, 0.42));
        col = mix(col, uHaze, (1.0 - smoothstep(0.0, 0.28, y)) * 0.6);
        // stars (twinkling), fading into the horizon glow
        if (d.y > 0.04) {
          vec2 sp = d.xz / (d.y + 0.35) * 210.0;
          vec2 cell = floor(sp);
          float r = h(cell);
          if (r > 0.9968) {
            vec2 f = fract(sp) - 0.5;
            float tw = 0.55 + 0.45 * sin(uT * (0.8 + r * 3.0) + r * 60.0);
            col += vec3(0.86, 0.9, 1.0) * smoothstep(0.16, 0.0, length(f)) * tw * smoothstep(0.04, 0.3, d.y) * 1.6;
          }
        }
        // the moon: a big disc with maria + craters and limb darkening, a soft lilac halo
        float md = dot(d, uMoon);
        vec3 t1 = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(t1, uMoon);
        vec2 mc = vec2(dot(d, t1), dot(d, t2)) / 0.055;
        float rr = dot(mc, mc);
        col += vec3(0.55, 0.58, 0.95) * (pow(max(md, 0.0), 260.0) * 0.55 + pow(max(md, 0.0), 26.0) * 0.16);
        if (md > 0.99 && rr < 1.0) {
          float maria = smoothstep(0.5, 0.72, fbm(mc * 1.7 + 4.0)) * 0.28;
          float crat = fbm(mc * 6.0 + 9.0) * 0.18;
          vec3 moon = vec3(1.0, 0.97, 0.9) * (0.9 - maria - crat * 0.5) * (0.78 + 0.22 * sqrt(1.0 - rr));
          col = mix(col, moon * 2.4, smoothstep(1.0, 0.94, rr));
        }
        // clouds drifting across, dark bodies with moonlit edges (they pass in front of the moon)
        if (d.y > 0.02) {
          vec2 uv = d.xz / (d.y + 0.1) * 1.35 + vec2(uT * 0.011, uT * 0.004);
          float c = fbm(uv * 0.9);
          float cov = smoothstep(0.5, 0.8, c) * smoothstep(0.02, 0.24, d.y);
          float rim = pow(max(md, 0.0), 10.0);
          vec3 cloud = mix(vec3(0.07, 0.07, 0.16), vec3(0.5, 0.52, 0.78), 0.18 + rim * 0.95 + (c - 0.6) * 0.6);
          col = mix(col, cloud, cov * 0.86);
        }
        if (d.y < 0.0) col = mix(uHorizon, uHaze * 0.55, min(1.0, -d.y * 4.0));
        return col;
      }
      void main() {
        vec3 d = normalize(vDir);
        if (uNight > 0.5) {
          gl_FragColor = vec4(nightSky(d), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
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
  scene.fog = new THREE.FogExp2(P.fog, preset === 'night' ? (q === 'low' ? 0.0085 : 0.0072) : q === 'low' ? 0.0055 : 0.0042)

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
  const fill = preset === 'night' ? new THREE.DirectionalLight('#9a6ce0', 0.55) : new THREE.DirectionalLight('#a9c4ff', 0.45)
  fill.position.set(-sunDir.x * 40, 30, -sunDir.z * 40)
  scene.add(fill)

  let envRT: THREE.WebGLRenderTarget | null = null
  // outdoor reflections: a small gradient world (sky → warm horizon → grass/stone ground) pre-filtered once,
  // so glass, gold, water and metal reflect the afternoon instead of the engine's indoor studio
  if (renderer) {
    const envScene = new THREE.Scene()
    const eg = new THREE.SphereGeometry(10, 32, 16)
    const em = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uZenith: { value: new THREE.Color(P.zenith) }, uHorizon: { value: new THREE.Color(P.horizon) }, uGround: { value: new THREE.Color(preset === 'night' ? '#1c1626' : '#7f8a5c') }, uSun: { value: preset === 'night' ? MOON.clone() : sunDir.clone() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uZenith, uHorizon, uGround, uSun; varying vec3 vD;
        void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uHorizon, uZenith, pow(y, 0.6)) : mix(uHorizon * 0.8, uGround, min(1.0, -y * 3.0));
          c += (uGround.r < 0.2 ? vec3(0.6, 0.65, 1.0) * 0.6 : vec3(1.0, 0.9, 0.7)) * pow(max(dot(vD, uSun), 0.0), 64.0) * 4.0; gl_FragColor = vec4(c, 1.0); }`,
    })
    envScene.add(new THREE.Mesh(eg, em))
    const pm = new THREE.PMREMGenerator(renderer)
    envRT = pm.fromScene(envScene, 0.02)
    pm.dispose()
    eg.dispose()
    em.dispose()
    scene.environment = envRT.texture
    scene.environmentIntensity = preset === 'night' ? 0.6 : 0.85
  }

  const texel = (EXT * 2) / size
  const focus = new THREE.Vector3()
  return {
    sunDir,
    preset,
    /** free the reflection map's render target (disposing only its texture would leak the target) */
    dispose() {
      envRT?.dispose()
      envRT = null
    },
    /** keep the shadow frustum centred on the player (snapped to shadow texels so edges don't crawl) */
    update(dt: number, player: THREE.Vector3) {
      skyMat.uniforms.uT.value += dt
      focus.set(Math.round(player.x / texel) * texel, 0, Math.round(player.z / texel) * texel)
      sun.target.position.copy(focus)
      sun.position.copy(focus).addScaledVector(sunDir, 80)
    },
  }
}
