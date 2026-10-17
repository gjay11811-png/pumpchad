import * as THREE from 'three'

/**
 * The bike practice route: a short, clear, optional strip down the main avenue inside the launch area (nothing new is built outside the open village).
 * Everything is soft scenery — cones, painted strips and low distance posts. None of it collides, so it can never trap or crash a rider; it only gives
 * the lessons somewhere to happen:   start line → slalom → braking box → straight with distance posts (run-up for front-wheel lifts).
 */
export const PRACTICE = {
  x: 0,
  start: 14,
  slalom: [22, 26, 30, 34, 38] as number[],
  slalomX: 1.7,
  brakeFrom: 46,
  brakeTo: 54,
  runFrom: 56,
  end: 72,
}

export function buildPracticeRoute(scene: THREE.Scene, ground: (x: number, z: number) => number): { dispose: () => void } {
  const g = new THREE.Group()
  g.name = 'bike-practice-route'
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const texs: THREE.Texture[] = []
  const mat = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o })
    mats.push(m)
    return m
  }
  const geo = <T extends THREE.BufferGeometry>(x: T) => {
    geos.push(x)
    return x
  }
  const white = mat(0xf1ece0)
  const orange = mat(0xff7a1a, { emissive: 0x3a1500 })
  const yellow = mat(0xf2c230)
  const red = mat(0xc9302c)
  const stripGeo = geo(new THREE.PlaneGeometry(1, 1))
  const strip = (x: number, z: number, w: number, d: number, m: THREE.Material) => {
    const s = new THREE.Mesh(stripGeo, m)
    s.rotation.x = -Math.PI / 2
    s.scale.set(w, d, 1)
    s.position.set(x, ground(x, z) + 0.03, z)
    s.renderOrder = 2
    g.add(s)
  }
  const coneGeo = geo(new THREE.ConeGeometry(0.2, 0.55, 10))
  const baseGeo = geo(new THREE.BoxGeometry(0.46, 0.04, 0.46))
  const cone = (x: number, z: number) => {
    const c = new THREE.Mesh(coneGeo, orange)
    c.position.set(x, ground(x, z) + 0.3, z)
    const b = new THREE.Mesh(baseGeo, orange)
    b.position.set(x, ground(x, z) + 0.03, z)
    const band = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.13, 0.09, 10)), white)
    band.position.set(x, ground(x, z) + 0.3, z)
    g.add(c, b, band)
  }
  const post = (x: number, z: number, m: THREE.Material) => {
    const p = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 8)), m)
    p.position.set(x, ground(x, z) + 0.35, z)
    const cap = new THREE.Mesh(geo(new THREE.SphereGeometry(0.09, 8, 6)), white)
    cap.position.set(x, ground(x, z) + 0.74, z)
    g.add(p, cap)
  }
  const { x: X } = PRACTICE
  // start line: a chequered strip
  strip(X, PRACTICE.start, 7, 0.5, white)
  for (let i = 0; i < 7; i++) strip(X - 3 + i + 0.5 - 0.5, PRACTICE.start, 0.5, 0.25, i % 2 ? white : mat(0x1a1a1a))
  // slalom
  PRACTICE.slalom.forEach((z, i) => cone(X + (i % 2 ? -1 : 1) * PRACTICE.slalomX, z))
  // braking box: yellow edges, a red stop line
  strip(X, (PRACTICE.brakeFrom + PRACTICE.brakeTo) / 2, 5.2, PRACTICE.brakeTo - PRACTICE.brakeFrom, mat(0x2b2b2b, { transparent: true, opacity: 0.55 }))
  strip(X - 2.6, (PRACTICE.brakeFrom + PRACTICE.brakeTo) / 2, 0.12, PRACTICE.brakeTo - PRACTICE.brakeFrom, yellow)
  strip(X + 2.6, (PRACTICE.brakeFrom + PRACTICE.brakeTo) / 2, 0.12, PRACTICE.brakeTo - PRACTICE.brakeFrom, yellow)
  strip(X, PRACTICE.brakeFrom, 5.2, 0.25, yellow)
  strip(X, PRACTICE.brakeTo, 5.2, 0.35, red)
  cone(X - 2.6, PRACTICE.brakeFrom)
  cone(X + 2.6, PRACTICE.brakeFrom)
  cone(X - 2.6, PRACTICE.brakeTo)
  cone(X + 2.6, PRACTICE.brakeTo)
  // run-up straight with a post every 8 m on the right (so a wheelie's distance can be judged by eye)
  for (let z = PRACTICE.runFrom; z <= PRACTICE.end; z += 8) post(X + 3.2, z, z % 16 === 0 ? orange : white)
  // start-to-end distance posts on the left, every 10 m
  for (let z = PRACTICE.start + 10; z < PRACTICE.brakeFrom - 2; z += 10) post(X - 3.2, z, white)
  // ── the wheelie yard marks (see practiceJudge.ts): LIFT ZONE (blue box), BALANCE band (green posts), CONES, SCRAPE SECTION (yellow chevrons) ──
  const blue = mat(0x2f7ff0, { emissive: 0x0a2a60 })
  const green = mat(0x2fb36a)
  const edge = (x: number, z0: number, z1: number, m: THREE.Material) => strip(x, (z0 + z1) / 2, 0.14, z1 - z0, m)
  edge(X - 2.7, 57, 65, blue)
  edge(X + 2.7, 57, 65, blue)
  strip(X, 57, 5.4, 0.16, blue)
  strip(X, 65, 5.4, 0.16, blue)
  for (let z = 65; z <= 72; z += 3.5) {
    post(X - 2.7, z, green)
    post(X + 2.7, z, green)
  }
  for (let z = 22; z <= 38; z += 4) for (const sx of [-1, 1]) strip(X + sx * 3.6, z, 0.9, 0.18, yellow)
  const sign = (text: string, sub: string, x: number, z: number, ry: number) => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const k = c.getContext('2d')
    if (!k) return
    k.fillStyle = '#16181f'
    k.fillRect(0, 0, 256, 96)
    k.strokeStyle = '#f2c230'
    k.lineWidth = 4
    k.strokeRect(4, 4, 248, 88)
    k.fillStyle = '#f2c230'
    k.font = 'bold 34px sans-serif'
    k.textAlign = 'center'
    k.fillText(text, 128, 44)
    k.fillStyle = '#e9e2d0'
    k.font = '20px sans-serif'
    k.fillText(sub, 128, 76)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    texs.push(tex)
    const m = new THREE.MeshBasicMaterial({ map: tex })
    mats.push(m)
    const sg = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.5, 0.56)), m)
    sg.position.set(x, ground(x, z) + 1.0, z)
    sg.rotation.y = ry
    const pole = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6)), mat(0x2b2b2b))
    pole.position.set(x, ground(x, z) + 0.5, z)
    g.add(sg, pole)
  }
  sign('LIFT ZONE', 'gas in the box', X - 3.5, 57, Math.PI)
  sign('BALANCE', '15° – 35°', X + 3.5, 65, Math.PI)
  sign('CONES', 'weave all five', X - 3.5, 20, Math.PI)
  sign('SCRAPE', 'lean hard here', X + 4.4, 30, Math.PI)
  scene.add(g)
  return {
    dispose() {
      scene.remove(g)
      geos.forEach((x) => x.dispose())
      mats.forEach((x) => x.dispose())
      texs.forEach((x) => x.dispose())
    },
  }
}
