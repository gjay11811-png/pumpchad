export type DialogueOption = { label: string; action: 'close' | 'gym' | 'wardrobe' | 'welltoss' }
export type Dialogue = { speaker: string; role: string; lines: string[]; options?: DialogueOption[] }

export const DIALOGUE: Record<string, Dialogue> = {
  coach: {
    speaker: 'Coach Gourdon',
    role: 'Pump Gym · Head Coach',
    lines: [
      'Name’s Gourdon. Forty years under the iron. Zero years with skin.',
      'You look like you skip leg day. And arm day. And days.',
      'Chad Press. Ten reps. Hit the gold zone, build your combo. Miss, and the bar wobbles — so does your dignity.',
    ],
    options: [
      { label: 'Take me to the gym', action: 'gym' },
      { label: 'Maybe later', action: 'close' },
    ],
  },
  hodl: {
    speaker: 'b4s',
    role: 'Knight of the Diamond Grip',
    lines: [
      'Halt. I am b4s, sworn protector of the King’s statue. I guard it sitting down. Diamond grip, diamond patience.',
      'Legend says the King once held through a candle so red it turned the moon orange.',
      'They also say the old walls by the citadel hide a strange rune. Press it and… well. You’ll see.',
    ],
  },
  statue: {
    speaker: 'Bronze Plaque',
    role: 'Statue of the King',
    lines: [
      'PUMPCHAD — FIRST OF HIS NAME, KING OF CHAD SQUARE.',
      '“Markets dump. Chads pump.”',
      'Below, smaller letters: the fountain was raised on the day the King held through the Great Red Candle. Its water has never stopped running since. Neither has he.',
      'Polished daily. Flexed at hourly.',
    ],
  },
  guide: {
    speaker: 'Pip',
    role: 'City Guide · Market Row',
    lines: [
      'Welcome to CHAD CITY! First time? Here’s the lay of the land.',
      'East of CHAD SQUARE: PUMP GYM — lift, punch the bag, hit the treadmill. Every rep builds strength or stamina. The yard outside is for warming up.',
      'Keep going east down ARCADE STREET to the PUMP ARCADE. It isn’t open yet, but the marquee is worth a look.',
      'The pumpkin cart in the square runs PUMPKIN RUSH: forty-five seconds, grab every glowing pumpkin you can.',
      'West of here: shakes at the Social Corner, then the Pumpkin Garden and CHAD VIEW — best view in the city. North: CHAD CITADEL. Its doors open in a future update.',
      'Oh — six pumpkins are hidden around the city, and a few others talk. Don’t tell them I told you.',
    ],
  },
  wardrobe: {
    speaker: 'Wardrobe Stall',
    role: 'Market Row · new fits coming soon',
    lines: [
      'Mannequins in chains, bolts of cloth, a cracked mirror. The sign says NEW FITS — COMING SOON.',
      'The stall can’t sell anything yet. But the wardrobe itself is open: change your species, skin, outfit, headwear and shades any time.',
    ],
    options: [
      { label: 'Open the wardrobe', action: 'wardrobe' },
      { label: 'Maybe later', action: 'close' },
    ],
  },
  lookout: {
    speaker: 'The Canal Promenade',
    role: 'Chad Square · south side',
    lines: [
      'The Pump Canal slides past below the railing. CHAD BRIDGE carries the avenue over it; two footbridges loop round to the forecourt.',
      'Beyond the water stands the CHAD CITY gateway — and, down the valley, the towers of downtown.',
      'The benches here are free. The ducks are imaginary.',
    ],
  },
  gourd_1: {
    speaker: 'Sage Gourd',
    role: 'A very old pumpkin',
    lines: ['Psst. Down here. Yes, the pumpkin.', 'I have sat on this step for three hundred harvests. Wisdom for you: never sell the bottom. Also never sit on a pumpkin.'],
  },
  gourd_2: {
    speaker: 'Grumpy Gourd',
    role: 'Market Row (dead end)',
    lines: ['What. WHAT. Can’t a gourd sulk in peace?', 'Fine. You found me. Tell the others I’m still mad about the pie incident.'],
  },
  gourd_3: {
    speaker: 'Tiny Gourd',
    role: 'Castle steps',
    lines: ['Oh! Hi! I’m guarding the castle! Officially! Probably!', 'The captain says I’m “decorative.” I say I’m UNDERCOVER.'],
  },
  gate: {
    speaker: 'Citadel Doors',
    role: 'Chad Citadel · closed',
    lines: ['You knock on the oak. It doesn’t move. Iron straps, ring handles, a very serious keyhole.', 'A muffled voice: “The King is busy. He is doing his sets.”', 'The citadel opens to visitors in a future update. Probably after leg day.'],
  },
  citygate: {
    speaker: 'Welcome Board',
    role: 'Chad City · arrival forecourt',
    lines: [
      'WELCOME TO CHAD CITY.',
      'Straight on over CHAD BRIDGE to CHAD SQUARE. PUMP GYM is east of the square; ARCADE STREET runs on east to the PUMP ARCADE.',
      'West: the Market, the Social Corner, the Pumpkin Garden and CHAD VIEW. North: CHAD CITADEL.',
      'Something to do: DISCOVER CHAD CITY — visit the square, the gym, the arcade, the citadel and Chad Rides. And keep an eye out for six hidden pumpkins.',
    ],
  },
  citymap: {
    speaker: 'City Map',
    role: 'You are here',
    lines: ['A painted map of CHAD CITY: the gateway and forecourt in the south, the canal and its three bridges, CHAD SQUARE in the middle, the gym and Arcade Street east, the market and garden west, the citadel north.', 'Someone has drawn a tiny crown over the citadel. Someone else has drawn a pumpkin over the crown.'],
  },
  rides: {
    speaker: 'Chad Rides',
    role: 'Coming soon',
    lines: ['Chad Rides — bikes are coming in a future update.', 'For now they’re parked in the rack, polished and slightly judgemental.'],
  },
  overlook: {
    speaker: 'Chad View',
    role: 'Scenic overlook',
    lines: ['From the terrace you can see it all: the gold crown on the gateway, the canal glinting, the citadel’s towers — and down the valley, the hazy towers of downtown.', 'A good place for a photo. Or a sit. Or both.'],
  },
  lore_citadel: {
    speaker: 'Citadel Plaque',
    role: 'Chad Citadel',
    lines: ['CHAD CITADEL — SEAT OF THE PUMP KING.', 'Built, they say, in a single very long leg day. The towers were added during the rest days.', 'Its gates open to the people in a future update.'],
  },
  champions: {
    speaker: 'Community Champions',
    role: 'Chad Square',
    lines: ['A glass case, three empty pedestals, a little gold crown on top.', 'The plaque reads: reserved for future competition winners. No champions have been crowned yet — this space is waiting for the first.'],
  },
  yard: {
    speaker: 'Outdoor Yard',
    role: 'Pump Gym',
    lines: ['PUMP GYM · OUTDOOR YARD — warm up out here, lift inside.', 'House rule, on a board above the windows: NO CURLING IN THE SQUAT RACK.'],
  },
  rune: {
    speaker: 'Strange Rune',
    role: 'Hidden switch',
    lines: ['The rune hums under your palm. Somewhere nearby, gold clinks.', 'You found the King’s Stash. It’s mostly decorative. Like most stashes.'],
  },
  rune_again: {
    speaker: 'Strange Rune',
    role: 'Hidden switch',
    lines: ['The rune is warm. The stash is still there. The King is still counting it.'],
  },
}

Object.assign(DIALOGUE, {
  barkeep: {
    speaker: 'Barley',
    role: 'The Flexing Gourd · Barkeep',
    lines: [
      'Tavern’s shut, friend. Renovations. The last arm-wrestle went to extra time and took a wall with it.',
      'We’ll reopen soon. Till then I serve protein punch out here. Hold the punch.',
      'Word is someone dropped golden seeds all over town. Five of ’em. Check the alleys — and behind things.',
    ],
  },
  smith: {
    speaker: 'Anvilus',
    role: 'Iron Gourd Forge · Smith',
    lines: [
      'I forge plates. Not armour — weight plates. Forty-five pounds of pure intention.',
      'One day I’ll forge gear for every chad in the Chadverse. Your wardrobe is only the beginning.',
      'Mind the sparks. They have opinions.',
    ],
  },
  potion: {
    speaker: 'Madame Marrowpot',
    role: 'Market Row · Potions',
    lines: [
      'Potions! Pre-workout, post-workout, mid-workout. Every flavour is “orange”.',
      'No, they don’t make your bags go up. They make your biceps go up. Different chart.',
      'The old well at the end of the row takes coins. Wishes are free. Results are not guaranteed.',
    ],
  },
  captain: {
    speaker: 'Captain Tibia',
    role: 'Citadel Guard',
    lines: [
      'The King is not receiving visitors. He is mid-set.',
      'My guards patrol day and night. Mostly night. We don’t sleep. We’re skeletons.',
      'Some say the old house up the track isn’t empty. I say nothing. Loudly.',
    ],
  },
  board: {
    speaker: 'Notice Board',
    role: 'Chad Square',
    lines: ['WANTED: Paper Hands. Reward: one protein shake.', 'LOST: one (1) bear. Last seen: buried.', 'PUMP ARCADE — opening soon on Arcade Street. Probably.'],
  },
  well: {
    speaker: 'Wishing Well',
    role: 'Market Row',
    lines: ['You toss a coin. It falls for a suspiciously long time.', 'From somewhere below: “thanks.” Wishes are not financial advice.', 'There’s a little bucket hanging halfway down. Bet you can’t land one in it.'],
    options: [
      { label: 'Try the coin toss', action: 'welltoss' },
      { label: 'Leave', action: 'close' },
    ],
  },
  window: {
    speaker: 'The Hollow House',
    role: 'Abandoned',
    lines: [
      'You peer through the cracked glass. Something purple flickers… then stops.',
      'A whisper drifts out: “…should have held…”',
      'Nobody has lived here since the Great Dump. Nobody admits to remembering it.',
    ],
  },
  arcade: {
    speaker: 'Pump Arcade',
    role: 'Arcade Street · opening soon',
    lines: ['The marquee bulbs chase each other round the PUMP ARCADE sign. Behind the porthole doors: the glow of cabinets being polished.', 'The arcade isn’t open yet — new games are on the way. The posters out front are a preview.'],
  },
  gravedig: {
    speaker: 'Grim',
    role: 'Gravedigger · Haunted Quarter',
    lines: [
      'Evening! Don’t let the name fool you — I’m the cheeriest fellow in the quarter. Somebody has to be.',
      'Seven houses on these lanes and every one has a story. Go in, have a look. Mind the dolls.',
      'And old Mortimer’s crypt there… they say he was the last Keeper of the Golden Pumpkin. Read what’s carved on his tomb, if you’ve the nerve.',
    ],
  },
  greeter: {
    speaker: 'Goldie',
    role: 'Chad City · greeter',
    lines: [
      'Welcome to CHAD CITY! Through the gateway, over the bridge, and you’re in CHAD SQUARE.',
      'Want something to do? Try DISCOVER CHAD CITY: see the square, find PUMP GYM, check out the PUMP ARCADE, reach the CHAD CITADEL forecourt and peek at CHAD RIDES. Your progress shows under the objective.',
      'And if you like a hunt: six pumpkins are hidden around the city. Fair spots, I promise — no climbing.',
    ],
  },
  shakes: {
    speaker: 'Mo',
    role: 'Pump Shakes · Social Corner',
    lines: [
      'Pump Shakes! Vanilla Gains, Banana Bulk, Pumpkin Spice Pump, Choc Crown.',
      'They’re on the house today — the till isn’t built yet. Grab a seat under the lights.',
      'Tip: the garden behind me leads down to CHAD VIEW. Best view in the city.',
    ],
  },
} satisfies Record<string, Dialogue>)

export const PUMPKIN_LINES = [
  'The pumpkin wobbles. It does not appreciate that.',
  '“Stop poking me. I’m in a bear market.”',
  '“Fine. FINE. You win. Happy now?”',
  'It is pretending to be a normal pumpkin. It is not fooling anyone.',
]
