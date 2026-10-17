/**
 * BIKE HANDLING — numbers only. The riding system (`sim.ts`) reads one of these and knows nothing about meshes, so a better downloaded bike can replace
 * the current model by providing a visual with the same attachment points (see `visual.ts`) and, if it wants different handling, its own spec.
 * Units: metres, seconds, radians. The bike faces +x in its own frame (wheels along z), like the models.
 */
export type BikeSpec = {
  id: 'surron' | 'street'
  name: string
  /** wheel base (axle to axle) and wheel radius */
  wheelbase: number
  wheelR: number
  /** centre of mass: forward of the rear contact patch (d) and above the ground (h), rider included, at the neutral rider position */
  comD: number
  comH: number
  /** pitch inertia per unit mass about the rear contact patch: gyr2 = kGyr² + comD² + comH² (m²) */
  gyr2: number
  /** performance */
  maxSpeed: number // m/s on the flat
  accel: number // m/s² at standstill, full throttle (falls off toward maxSpeed)
  brakeFront: number // m/s² deceleration, front brake alone
  brakeRear: number // m/s² deceleration, rear brake alone
  reverse: number // max reverse speed (m/s)
  drag: number // 1/s: air drag
  rollRes: number // m/s²: rolling resistance (constant while rolling)
  /** how sharply motor torque falls with speed: 1 = steady taper (engine), larger = flat torque then a cliff (electric) */
  powerPow: number
  /** gears (0 = a single-speed electric drive): the acceleration dips a little at each shift, and the engine note follows */
  gears: number
  /** steering */
  steerMax: number // max steering angle at low speed (rad)
  steerFade: number // speed (m/s) at which the available angle has dropped to ~40 %
  steerRate: number // how fast the bars move (rad/s)
  /** grip: the tyres' limit on lateral acceleration (m/s²); beyond it the bike runs wide (understeers) rather than sliding out */
  gripLat: number
  /** the bike leans into a turn by atan(lateral accel / g) × this (visual and rider) */
  leanGain: number
  pitchDamp: number // 1/s damping on pitch rate
  /** how much a rider's wheelie assist can do for this bike (the player's setting scales it): extra damping of the pitch rate around the balance point, and a softer runaway past it. It never pulls toward a target, so a wheelie is never held for you. */
  assistGain: number
  maxPitch: number // the bike goes over backwards beyond this (rad; about 85° = near vertical)
  /** the lean (rad) at which a footpeg touches the road */
  pegLean: number
  /** suspension (visual travel, m): fork and rear shock */
  forkTravel: number
  shockTravel: number
  /** rider's attachment points in the bike frame (x forward, y up, z left), for the visual's own use: kept here so handling and fit stay together */
  mass: number
  /** ── the physical set-up (SI: m, kg, s, rad). `est` = ESTIMATED: a downloaded model gives geometry only, never mass or motor output ── */
  massBike: number
  massRider: number
  /** radius of gyration of bike + rider about the combined centre of mass (m) */
  kGyr: number
  /** peak thrust at the rear contact patch at low speed (N) */
  thrustMax: number
  /** how far the rider's weight can move the combined centre of mass (m): back on a REV, forward under braking and while hanging off the bars in a wheelie */
  revShift: number
  hangShift: number
  brakeShift: number
  /** the rider crouches forward a little on a plain launch (m), so ordinary full-throttle riding stays planted */
  launchShift: number
  /** the rider's weight comes forward by this much (m) once the gas has been held longer than a tap: plain pulling away, not a wheelie */
  holdShift: number
  /** extra thrust fraction at full REV (a throttle snap) */
  revBoost: number
  /** values that are estimates, not measurements */
  est: string[]
}


/**
 * SET-UP TABLE. One row per bike; every handling number below is derived from it.
 *  wheelbase, wheel radius : MEASURED from the in-game visual at its in-game scale (the MX4 scan: 1.27 m axle to axle; the street bike's procedural model).
 *  masses, centre of mass, k, thrust, grip, brakes : ESTIMATES. A model's looks do not tell its weight or motor output. MX4: a published weight of about 60-65 kg and a peak road
 *  thrust giving about 5.6 m/s² from rest; street bike: a middleweight roadster, about 190 kg, about 8.6 m/s² from rest. Rider 80 kg seated. COM: roughly 44-50 % of the wheelbase
 *  ahead of the rear contact, 0.66-0.80 m up (rider and bike combined, seated).
 */
type SetUp = {
  id: 'surron' | 'street'
  name: string
  wheelbase: number
  wheelR: number
  massBike: number
  massRider: number
  comX: number
  comH: number
  kGyr: number
  thrustMax: number
}
const MX4: SetUp = { id: 'surron', name: 'Talaria MX4', wheelbase: 1.268, wheelR: 0.305, massBike: 62, massRider: 80, comX: 0.56, comH: 0.8, kGyr: 0.4, thrustMax: 800 }
const ROAD: SetUp = { id: 'street', name: 'Street bike', wheelbase: 1.42, wheelR: 0.33, massBike: 190, massRider: 80, comX: 0.7, comH: 0.66, kGyr: 0.48, thrustMax: 2322 }

const derive = (u: SetUp) => {
  const mass = u.massBike + u.massRider
  return { comD: u.comX, comH: u.comH, gyr2: u.kGyr * u.kGyr + u.comX * u.comX + u.comH * u.comH, accel: u.thrustMax / mass, mass }
}

export const SURRON: BikeSpec = {
  id: 'surron',
  name: MX4.name,
  wheelbase: MX4.wheelbase,
  wheelR: MX4.wheelR,
  ...derive(MX4),
  maxSpeed: 22,
  brakeFront: 8.5,
  brakeRear: 5.5,
  reverse: 2.2,
  drag: 0.04,
  rollRes: 0.18,
  powerPow: 2.2,
  gears: 0,
  steerMax: 0.62,
  steerFade: 9,
  steerRate: 4.2,
  gripLat: 9.5,
  leanGain: 1.0,
  pitchDamp: 2.6,
  assistGain: 1,
  maxPitch: 1.5,
  pegLean: 0.7,
  forkTravel: 0.2,
  shockTravel: 0.16,
  massBike: MX4.massBike,
  massRider: MX4.massRider,
  kGyr: MX4.kGyr,
  thrustMax: MX4.thrustMax,
  revShift: 0.52,
  hangShift: 0.5,
  brakeShift: 0.35,
  launchShift: 0.12,
  holdShift: 0.8,
  revBoost: 0.2,
  est: ['massBike', 'massRider', 'comD', 'comH', 'kGyr', 'thrustMax', 'brakeFront', 'brakeRear', 'gripLat', 'forkTravel', 'shockTravel', 'pitchDamp'],
}

/** the street bike: heavier, longer, faster, a lower centre of mass and a lazier front end — a wheelie needs real power and a proper REV */
export const STREET: BikeSpec = {
  id: 'street',
  name: ROAD.name,
  wheelbase: ROAD.wheelbase,
  wheelR: ROAD.wheelR,
  ...derive(ROAD),
  maxSpeed: 40,
  brakeFront: 11,
  brakeRear: 6.5,
  reverse: 1.6,
  drag: 0.028,
  rollRes: 0.12,
  powerPow: 1.25,
  gears: 5,
  steerMax: 0.5,
  steerFade: 14,
  steerRate: 3.4,
  gripLat: 11,
  leanGain: 1.0,
  pitchDamp: 2.6,
  assistGain: 0.9,
  maxPitch: 1.5,
  pegLean: 0.66,
  forkTravel: 0.12,
  shockTravel: 0.09,
  massBike: ROAD.massBike,
  massRider: ROAD.massRider,
  kGyr: ROAD.kGyr,
  thrustMax: ROAD.thrustMax,
  revShift: 0.7,
  hangShift: 0.55,
  brakeShift: 0.4,
  launchShift: 0.14,
  holdShift: 0.85,
  revBoost: 0.2,
  est: ['massBike', 'massRider', 'comD', 'comH', 'kGyr', 'thrustMax', 'brakeFront', 'brakeRear', 'gripLat', 'forkTravel', 'shockTravel', 'pitchDamp'],
}
