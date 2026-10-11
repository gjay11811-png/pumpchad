import type { Species } from './types'

/**
 * GLB model slots — drop a rigged, animated .glb in /public/chadverse/models and fill in its entry.
 * Until a `url` is set, the species uses the procedural stand-in from build.ts.
 *
 * Model requirements (see docs/CHARACTER_ASSETS.md):
 *  - glTF 2.0 binary (.glb), Y-up, metres, facing +Z, feet at origin, ~1.9–2.1 m tall
 *  - one skinned mesh on a humanoid skeleton, ≤ 25k triangles, ≤ 2 materials, textures ≤ 2048² (KTX2 ideal)
 *  - animation clips: idle, walk, run, flex, press (overhead press, bar at shoulders→locked out), wave
 *  - materials named for tinting: e.g. "Skin", "Outfit", "Glow" (glow = emissive)
 *  - bones for attachments: head, left hand, right hand
 */
export type ModelSpec = {
  url: string
  /** uniform scale applied after load */
  scale?: number
  /** clip name in the file for each game pose (missing clips fall back to idle) */
  clips: Partial<Record<'idle' | 'walk' | 'run' | 'flex' | 'press' | 'wave', string>>
  /** material names in the file that take the player's chosen colours */
  tint?: { skin?: string[]; outfit?: string[]; glow?: string[] }
  /** bone names used for the camera target / held props */
  bones?: { head?: string; handL?: string; handR?: string }
  /** normalised walk-cycle times (0–1) at which a foot lands, for footstep sounds */
  footfalls?: number[]
}

export const MODELS: Partial<Record<Species, ModelSpec>> = {
  // pumpkin: { url: 'chadverse/models/pumpkin.glb', clips: { idle: 'Idle', walk: 'Walk', run: 'Run', flex: 'Flex', press: 'Press', wave: 'Wave' }, tint: { skin: ['Skin'], outfit: ['Outfit'], glow: ['Glow'] }, bones: { head: 'Head', handL: 'LeftHand', handR: 'RightHand' } },
  // skeleton: { ... },
  // demon: { ... },
}

/**
 * Test fixture: CC0 "RobotExpressive" by Tomás Laulhé (Quaternius). Used ONLY by the
 * automated pipeline test (?model=robot). It is not shipped as a playable character.
 */
export const TEST_MODEL: ModelSpec = {
  url: 'test-fixtures/RobotExpressive.glb',
  scale: 0.42,
  clips: { idle: 'Idle', walk: 'Walking', run: 'Running', flex: 'ThumbsUp', press: 'Punch', wave: 'Wave' },
  tint: { skin: ['Main'], outfit: ['Grey'], glow: ['Black'] },
  bones: { head: 'Head', handL: 'HandL', handR: 'HandR' },
  footfalls: [0.25, 0.75],
}
