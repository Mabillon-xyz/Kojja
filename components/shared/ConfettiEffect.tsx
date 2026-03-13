'use client'

import { useEffect } from 'react'

export default function ConfettiEffect() {
  useEffect(() => {
    let cancelled = false

    async function fire() {
      const confetti = (await import('canvas-confetti')).default

      const end = Date.now() + 3000

      const frame = () => {
        if (cancelled || Date.now() > end) return
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#1a1a1a', '#737373', '#d4d4d4'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#1a1a1a', '#737373', '#d4d4d4'],
        })
        requestAnimationFrame(frame)
      }
      frame()
    }

    fire()
    return () => { cancelled = true }
  }, [])

  return null
}
