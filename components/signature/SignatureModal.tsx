'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DrawSignature from './DrawSignature'
import TypeSignature from './TypeSignature'

interface SignatureModalProps {
  open: boolean
  onClose: () => void
  onSign: (signerName: string, signatureData: string) => void
  clientName: string
}

export default function SignatureModal({ open, onClose, onSign, clientName }: SignatureModalProps) {
  const [signerName, setSignerName] = useState(clientName)

  function handleDrawCapture(dataUrl: string) {
    if (!signerName.trim()) return
    onSign(signerName, dataUrl)
  }

  function handleTypeCapture(name: string) {
    onSign(name, name)
    setSignerName(name)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sign proposal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="signerName">Your full name</Label>
            <Input
              id="signerName"
              placeholder="Jane Smith"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>

          <Tabs defaultValue="draw">
            <TabsList className="w-full">
              <TabsTrigger value="draw" className="flex-1">Draw</TabsTrigger>
              <TabsTrigger value="type" className="flex-1">Type</TabsTrigger>
            </TabsList>

            <TabsContent value="draw" className="mt-4">
              <DrawSignature onCapture={handleDrawCapture} />
            </TabsContent>

            <TabsContent value="type" className="mt-4">
              <TypeSignature onCapture={handleTypeCapture} />
            </TabsContent>
          </Tabs>

          <p className="text-xs text-neutral-400">
            By signing, you agree to the terms outlined in this proposal.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
