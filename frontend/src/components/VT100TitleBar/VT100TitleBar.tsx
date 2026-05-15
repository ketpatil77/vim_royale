import { useEffect, useState } from 'react'

interface VT100TitleBarProps {
  num: string
}

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

const OFFSETS: Record<string, number> = {
  '01': 4271,
  '02': 11803,
  '03': 892,
  '04': 7345,
}

export function VT100TitleBar({ num }: VT100TitleBarProps) {
  const offset = OFFSETS[num] ?? 0
  const [elapsed, setElapsed] = useState(offset)

  useEffect(() => {
    const id = setInterval(() => setElapsed(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="vt100-bar">
      <span className="vt100-tag vt100-tag--left">[ {num} ]</span>
      <span className="vt100-tag vt100-tag--right">[ {fmt(elapsed)} ]</span>
    </div>
  )
}