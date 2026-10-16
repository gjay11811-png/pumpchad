import type { HouseSpec } from '../scenes/interiors/houses'
import { DISTRICT, DISTRICT_ENABLED } from './config'
import { districtMats } from './mats'
import { buildStreet } from './street'
import { buildGym } from './gym'
import { buildBlocks } from './blocks'
import { plantProcedural } from './trees'
import { floor, type Ctx, type TreeSpot } from './kit'

export { DISTRICT, DISTRICT_ENABLED }

/**
 * The district as a place the game can enter: it is described like a house (so the existing enter / leave / pause / HUD / pet / restyle machinery
 * applies), but flagged `outdoor`, which gives it the real sky and sun instead of a room. Nothing here touches the starter map's scene.
 */
export const DISTRICT_SPEC: HouseSpec = {
  id: DISTRICT.id,
  name: DISTRICT.name,
  // where the starter map's side of the entrance is (only used when the district is switched on: it is the spot you come back out at)
  door: { x: DISTRICT.exitAt.x, z: DISTRICT.exitAt.z, face: DISTRICT.exitAt.yaw, half: 0, out: 0.75 },
  room: DISTRICT.room,
  look: { wall: ['plaster', '#d8d2c4', '#c8c2b4'], floor: '#8a8a8a', trim: '#c89a48' },
  mood: 'bright',
  outdoor: { spawn: DISTRICT.spawn, exit: [0, DISTRICT.spawn.z + 22] },
  build(K) {
    const trees: TreeSpot[] = []
    const q = K.quality ?? 'medium'
    const ctx: Ctx = { B: K.B, M: districtMats(K.M.D, q === 'low' ? 4 : 8), scene: K.scene, D: K.M.D, q, block: K.block, trees, bushes: [] }
    // the ground under and beyond everything: no sky-coloured gaps at the district's edges
    floor(ctx, ctx.M.ground, -420, 420, -420, 420, -0.03, 8)
    buildStreet(ctx)
    buildGym(ctx)
    buildBlocks(ctx)
    plantProcedural(K.scene, trees, K.M.D, q, 0.16, ctx.bushes)
  },
}
