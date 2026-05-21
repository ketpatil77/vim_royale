/* eslint-disable @typescript-eslint/no-explicit-any */
import howler from 'howler'
import type { Howl } from 'howler'

type SoundType = 'win' | 'lose' | 'clock'

const soundMap: Record<SoundType, Howl> = {
  win: new (howler as any).Howl({ src: ['/assets/win.wav'], preload: true }),
  lose: new (howler as any).Howl({ src: ['/assets/lose.wav'], preload: true }),
  clock: new (howler as any).Howl({ src: ['/assets/clock.mp3'], preload: true })
}

export const sounds: Record<SoundType, { play: () => void }> = soundMap