'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface DrawSignatureProps {
  onCapture: (dataUrl: string) => void
}

export default function DrawSignature({ onCapture }: DrawSignatureProps) {
  const sigRef = useRef<any>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [SigCanvas, setSigCanvas] = useState<any>(null)

  useEffect(() => {
    import('react-signature-canvas').then((mod) => {
      setSigCanvas(() => mod.default)
      setMounted(true)
    })
  }, [])

  function handleClear() {
    sigRef.current?.clear()
    setIsEmpty(true)
  }

  function handleConfirm() {
    if (!sigRef.current || sigRef.current.isEmpty()) return
    const dataUrl = sigRef.current.toDataURL('image/png')
    onCapture(dataUrl)
  }

  return (
    <div className="space-y-3">
      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white min-h-[160px]">
        {mounted && SigCanvas && (
          <SigCanvas
            ref={sigRef}
            penColor="#1a1a1a"
            canvasProps={{
              width: 480,
              height: 160,
              className: 'w-full',
            }}
            onBegin={() => setIsEmpty(false)}
          />
        )}
      </div>
      <p className="text-xs text-neutral-400 text-center">Draw your signature above</p>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={isEmpty}>
          Use this signature
        </Button>
      </div>
    </div>
  )
}
