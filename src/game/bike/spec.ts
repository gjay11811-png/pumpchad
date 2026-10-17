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
  /** radius of gyration² about the rear contact patch (how reluctantly it pitches) */
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
  /** wheelie */
  pullTorque: number // rad/s² of nose-up torque from the rider heaving back (a clutch-up / pull), at full lean-back
  shift: number // how far the rider can move the balance point by leaning back / forward (m of COM travel)
  rearBrakeTorque: number // rad/s² of nose-down torque from the rear brake at full application
  pitchDamp: number // 1/s damping on pitch rate
  /** how much a rider's wheelie assist can do for this bike (the player's setting scales it): extra damping of the pitch rate around the balance point, and a softer runaway past it. It never pulls toward a target, so a wheelie is never held for you. */
  assistGain: number
  maxPitch: number // the bike flips over backwards beyond this (rad)
  /** the lean (rad) at which a footpeg touches the road */
  pegLean: number
  /** suspension (visual travel, m): fork and rear shock */
  forkTravel: number
  shockTravel: number
  /** rider's attachment points in the bike frame (x forward, y up, z left), for the visual's own use: kept here so handling and fit stay together */
  mass: number
}

export const SURRON: BikeSpec = {
  id: 'surron',
  name: 'Talaria MX4',
  wheelbase: 1.268, // the MX4 scan: 1.27 m between axles
  wheelR: 0.305,
  comD: 0.6,
  comH: 0.64,
  gyr2: 1.7,
  maxSpeed: 22,
  accel: 6.4,
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
  pullTorque: 3.9,
  shift: 0.14,
  rearBrakeTorque: 8.5,
  pitchDamp: 2.6,
  assistGain: 1,
  maxPitch: 1.28,
  pegLean: 0.7,
  forkTravel: 0.2,
  shockTravel: 0.16,
  mass: 55,
}

/** the street bike: heavier, longer, faster, a lower centre of mass and a lazier front end — a wheelie needs real power and a proper heave */
export const STREET: BikeSpec = {
  id: 'street',
  name: 'Street bike',
  wheelbase: 1.42,
  wheelR: 0.33,
  comD: 0.7,
  comH: 0.6,
  gyr2: 1.9,
  maxSpeed: 40,
  accel: 8.6,
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
  pullTorque: 3.6,
  shift: 0.1,
  rearBrakeTorque: 9.5,
  pitchDamp: 2.6,
  assistGain: 0.9,
  maxPitch: 1.25,
  pegLean: 0.66,
  forkTravel: 0.12,
  shockTravel: 0.09,
  mass: 190,
}
