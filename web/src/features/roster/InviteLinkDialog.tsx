import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/format'

export function InviteLinkDialog({
  open,
  onOpenChange,
  inviteToken,
  expiresAt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  inviteToken: string
  expiresAt: string
}) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/accept-invite?token=${encodeURIComponent(inviteToken)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can fail (permissions, insecure context) - the link
      // is still selectable/copyable by hand from the input below.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setCopied(false)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this invite link</DialogTitle>
          <DialogDescription>
            There's no email sent automatically yet - share this link with them yourself (WhatsApp,
            SMS, however you'd normally reach them). It expires on {formatDate(expiresAt)}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          <Button type="button" variant="outline" size="icon" onClick={() => void copyLink()}>
            {copied ? <Check className="h-4 w-4 text-green" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
