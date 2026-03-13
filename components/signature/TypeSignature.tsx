'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TypeSignatureProps {
  onCapture: (name: string) => void
}

export default function TypeSignature({ onCapture }: TypeSignatureProps) {
  const [name, setName] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <Input
          placeholder="Type your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-base"
        />
      </div>

      {name && (
        <div className="border border-neutral-200 rounded-xl p-6 bg-white min-h-[100px] flex items-center justify-center">
          <span className="font-signature text-4xl text-neutral-800">{name}</span>
        </div>
      )}

      <p className="text-xs text-neutral-400 text-center">
        Your typed name will appear as your signature
      </p>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => onCapture(name)}
          disabled={!name.trim()}
        >
          Use this signature
        </Button>
      </div>
    </div>
  )
}
