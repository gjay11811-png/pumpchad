export type DialogueOption = { label: string; action: 'close' | 'gym' | 'wardrobe' | 'welltoss' }
export type Dialogue = { speaker: string; role: string; lines: string[]; options?: DialogueOption[] }

export const DIALOGUE: Record<string, Dialogue> = {
  coach: {
    speaker: 'Coach Gourdon',
    role: 'Chad Gym · Head Coach',
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
      'They also say the castle walls hide a strange rune. Press it and… well. You’ll see.',
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
    role: 'Village Guide · Market Row',
    lines: [
      'Welcome to Chad Kingdom! First time? Here’s the lay of the land.',
      'East of the fountain: CHAD GYM. Lift, punch the bag, hit the treadmill — every rep builds strength or stamina.',
      'The pumpkin cart by the fountain runs PUMPKIN RUSH: forty-five seconds, grab every glowing pumpkin you can.',
      'Head south through the gate arch to the LOOKOUT. Sit on a bench and watch CHAD CITY glow across the valley. The road is closed… for now.',
      'North is the castle. The King is busy doing his sets — it opens in a future update. Oh, and some pumpkins round here talk. Don’t tell them I told you.',
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
    speaker: 'The Lookout',
    role: 'South terrace',
    lines: [
      'The kingdom ends in a cliff. Below: forest, a winding lamp-lit road, the valley floor.',
      'Beyond it all, CHAD CITY — towers, a gold-crowned casino, searchlights sweeping the clouds.',
      'One day the gate lifts and the road opens. Until then, the benches are free.',
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
    speaker: 'Castle Gate',
    role: 'Sealed',
    lines: ['You knock. Silence.', 'A muffled voice: “The King is busy. He is doing his sets.”', 'The castle opens in a future update. Probably after leg day.'],
  },
  citygate: {
    speaker: 'Road to Chad City',
    role: 'Closed — coming soon',
    lines: [
      'The road winds down the cliff and across the valley to the lights of CHAD CITY.',
      'Towers, a casino with a gold crown, streets you can’t walk yet. The portcullis stays down for now.',
      'Stick around. When the gate lifts, you’ll want to be first through it.',
    ],
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
    role: 'Royal Guard',
    lines: [
      'The King is not receiving visitors. He is mid-set.',
      'My guards patrol day and night. Mostly night. We don’t sleep. We’re skeletons.',
      'Some say the old house up the track isn’t empty. I say nothing. Loudly.',
    ],
  },
  board: {
    speaker: 'Notice Board',
    role: 'Chad Square',
    lines: ['WANTED: Paper Hands. Reward: one protein shake.', 'LOST: one (1) bear. Last seen: buried.', 'PUMP ARCADE — opening soon. Probably.'],
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
    role: 'Not open yet',
    lines: ['Cabinets hum behind the boarded doors. The neon buzzes: OPENING SOON.', 'This building isn’t open yet — new games are on the way.'],
  },
} satisfies Record<string, Dialogue>)

export const PUMPKIN_LINES = [
  'The pumpkin wobbles. It does not appreciate that.',
  '“Stop poking me. I’m in a bear market.”',
  '“Fine. FINE. You win. Happy now?”',
  'It is pretending to be a normal pumpkin. It is not fooling anyone.',
]
