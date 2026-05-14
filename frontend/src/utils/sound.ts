/* eslint-disable @typescript-eslint/no-explicit-any */
import howler from 'howler'
import type { Howl } from 'howler'

type SoundType = 'win' | 'lose'

const soundMap: Record<SoundType, Howl> = {
  win: new (howler as any).Howl({ src: ['/assets/win.mp3'] }),
  lose: new (howler as any).Howl({ src: ['/assets/lose.mp3'] }),
}

export const sounds: Record<SoundType, { play: () => void }> = soundMap