import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

/**
 * Tilts an element in 3D toward the pointer.
 *
 * CSS transforms rather than a WebGL library: the CSP forbids scripts from other
 * origins, and these are marketing surfaces that should not carry hundreds of
 * kilobytes for an effect the compositor does on its own. Children with
 * `translateZ` sit at their own depths inside the same `preserve-3d` scene, so
 * this reads as real perspective and not a flat rotation.
 *
 * Note: a `filter` or `backdrop-filter` anywhere on the tilted element forces
 * `transform-style` back to `flat` and collapses that depth.
 *
 * Does nothing without a fine pointer (so, nothing on touch) or when the visitor
 * asks for reduced motion.
 */
export function useTilt(max = 9) {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setEnabled(fine && !still)
  }, [])

  const onMove = (e: MouseEvent) => {
    const el = ref.current
    if (!el || !enabled) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`
  }

  const onLeave = () => {
    const el = ref.current
    if (el) el.style.transform = 'rotateX(0deg) rotateY(0deg)'
  }

  return { ref, onMove, onLeave, enabled }
}
