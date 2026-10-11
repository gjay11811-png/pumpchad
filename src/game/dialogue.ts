export type DialogueOption = { label: string; action: 'close' | 'gym' }
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
    speaker: 'Sir Hodl',
    role: 'Knight of the Diamond Grip',
    lines: [
      'Halt. I am Sir Hodl, sworn protector of the King’s statue.',
      'Legend says the King once held through a candle so red it turned the moon orange.',
      'They also say the castle walls hide a strange rune. Press it and… well. You’ll see.',
    ],
  },
  statue: {
    speaker: 'Bronze Plaque',
    role: 'Statue of the King',
    lines: ['PUMPCHAD — FIRST OF HIS NAME, KING OF CHAD SQUARE.', '“Markets dump. Chads pump.”', 'Polished daily. Flexed at hourly.'],
  },
  gate: {
    speaker: 'Castle Gate',
    role: 'Sealed',
    lines: ['You knock. Silence.', 'A muffled voice: “The King is busy. He is doing his sets.”', 'The castle opens in a future update. Probably after leg day.'],
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

export const PUMPKIN_LINES = [
  'The pumpkin wobbles. It does not appreciate that.',
  '“Stop poking me. I’m in a bear market.”',
  '“Fine. FINE. You win. Happy now?”',
  'It is pretending to be a normal pumpkin. It is not fooling anyone.',
]
