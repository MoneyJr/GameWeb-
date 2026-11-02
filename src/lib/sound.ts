/**
 * Звук без аудиофайлов: эффекты, эмбиент и спокойная «музыкальная шкатулка» синтезируются WebAudio.
 * Браузеры (особенно iOS) разрешают звук только после первого касания — контекст включается по жесту.
 */
export type SoundName = 'build' | 'demolish' | 'coin' | 'success' | 'error' | 'click'

export interface AudioSettings {
  music: number
  effects: number
  muted: boolean
}

const STORAGE_KEY = 'inkville-audio'
const DEFAULT_SETTINGS: AudioSettings = { music: 0.5, effects: 0.7, muted: false }

let context: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let effectsBus: GainNode | null = null
let settings: AudioSettings = readSettings()
let musicTimer: number | null = null
let ambientNode: AudioBufferSourceNode | null = null
let winterMode = false
const listeners = new Set<(value: AudioSettings) => void>()

function readSettings(): AudioSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AudioSettings> | null
    return { ...DEFAULT_SETTINGS, ...(parsed ?? {}) }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function getAudioSettings(): AudioSettings { return settings }

export function subscribeAudioSettings(listener: (value: AudioSettings) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setAudioSettings(next: Partial<AudioSettings>): void {
  settings = { ...settings, ...next }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* optional */ }
  applyVolumes()
  listeners.forEach((listener) => listener(settings))
}

function applyVolumes() {
  if (!context || !master || !musicBus || !effectsBus) return
  const now = context.currentTime
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.05)
  musicBus.gain.setTargetAtTime(settings.music * 0.35, now, 0.1)
  effectsBus.gain.setTargetAtTime(settings.effects * 0.6, now, 0.05)
}

/** Включает звук после первого жеста пользователя. */
export function unlockAudio(): void {
  if (context) {
    if (context.state === 'suspended') void context.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  context = new Ctor()
  master = context.createGain()
  musicBus = context.createGain()
  effectsBus = context.createGain()
  musicBus.connect(master)
  effectsBus.connect(master)
  master.connect(context.destination)
  applyVolumes()
  startAmbient()
  startMusic()
}

function noiseBuffer(seconds: number): AudioBuffer | null {
  if (!context) return null
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  return buffer
}

function tone(frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine', bus = effectsBus, endFrequency?: number) {
  if (!context || !bus) return
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(bus)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

function noiseBurst(start: number, duration: number, volume: number, frequency: number, bus = effectsBus) {
  if (!context || !bus) return
  const source = context.createBufferSource()
  source.buffer = noiseBuffer(duration)
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency
  const gain = context.createGain()
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(gain).connect(bus)
  source.start(start)
}

export function playSound(name: SoundName): void {
  if (!context || settings.muted || settings.effects <= 0) return
  const t = context.currentTime
  switch (name) {
    case 'build':
      noiseBurst(t, 0.12, 0.5, 900)
      tone(170, t, 0.18, 0.5, 'triangle', effectsBus, 110)
      noiseBurst(t + 0.09, 0.08, 0.3, 1400)
      break
    case 'demolish':
      noiseBurst(t, 0.35, 0.6, 400)
      tone(120, t, 0.3, 0.4, 'sawtooth', effectsBus, 50)
      break
    case 'coin':
      tone(1320, t, 0.12, 0.25, 'square')
      tone(1760, t + 0.07, 0.2, 0.22, 'square')
      break
    case 'success':
      ;[523, 659, 784, 1046].forEach((frequency, index) => tone(frequency, t + index * 0.09, 0.35, 0.28, 'triangle'))
      break
    case 'error':
      tone(220, t, 0.12, 0.3, 'square')
      tone(165, t + 0.12, 0.18, 0.3, 'square')
      break
    case 'click':
      tone(880, t, 0.05, 0.15, 'triangle')
      break
  }
}

/** Тихий ветер на фоне. */
function startAmbient() {
  if (!context || !musicBus) return
  const source = context.createBufferSource()
  source.buffer = noiseBuffer(4)
  source.loop = true
  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 420
  const gain = context.createGain()
  gain.gain.value = 0.05
  source.connect(filter).connect(gain).connect(musicBus)
  source.start()
  ambientNode = source
}

// Пентатоника до мажор — любые сочетания нот звучат мягко.
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99]
const CHORDS = [[130.81, 196.0, 261.63], [110.0, 164.81, 220.0], [146.83, 220.0, 293.66], [98.0, 146.83, 196.0]]
let step = 0

/** Генеративная музыкальная шкатулка: мелодия + мягкие аккорды каждые 4 такта. */
function startMusic() {
  if (musicTimer !== null) return
  musicTimer = window.setInterval(() => {
    if (!context || !musicBus || settings.muted || settings.music <= 0 || context.state !== 'running') { step += 1; return }
    const t = context.currentTime + 0.05
    if (step % 16 === 0) {
      const chord = CHORDS[(step / 16) % CHORDS.length]
      chord.forEach((frequency) => tone(frequency, t, 3.6, 0.07, 'sine', musicBus))
    }
    if (Math.random() < 0.55) {
      const note = SCALE[Math.floor(Math.random() * SCALE.length)] * (winterMode && Math.random() < 0.5 ? 2 : 1)
      tone(note, t, 1.4, 0.09, 'triangle', musicBus)
      if (winterMode && Math.random() < 0.25) noiseBurst(t, 0.25, 0.08, 6500, musicBus)
    }
    step += 1
  }, 420)
}

export function setWinterMusic(enabled: boolean): void { winterMode = enabled }

export function isAudioStarted(): boolean { return context !== null && ambientNode !== null }
