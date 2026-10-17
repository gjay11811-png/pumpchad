import { BikeSim, FIXED_DT } from '../src/game/bike/sim.ts'
import { SURRON, STREET } from '../src/game/bike/spec.ts'
for (const [name, spec] of [['mx4', SURRON], ['street', STREET]]) for (const v0 of [3, 8, 14]) for (const gas of [0, 1]) {
  const s = new BikeSim(spec); s.reset(0, 0, 0); s.v = v0
  let rev = 0, tl = null, tc = null, tp = 0
  for (let i = 0; i < 600; i++) {
    const t = i / 120
    rev += (1 - rev) * (1 - Math.exp(-FIXED_DT / 0.22))
    const thr = Math.max(gas, rev * 0.9)
    s.advance(FIXED_DT, { throttle: thr, brake: 0, rear: 0, steer: 0, lean: rev }, { yRear: 0, yFront: 0 })
    if (tl === null && s.pitch > 0.3) tl = t
    tp = Math.max(tp, s.pitch)
    if (s.crashed && tc === null) { tc = t; break }
  }
  console.log(name, 'v0', v0, 'gas', gas, 'lift(0.3rad) at', tl?.toFixed(2), 's  loop-out at', tc?.toFixed(2), 'peak', tp.toFixed(2))
}
