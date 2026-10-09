import { PlayIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import { clientId, send } from '@/session'

export function StatusOverlay(props: { status: 'connecting' | 'paused' }) {
  return (
    <div className="bg-background/85 fixed inset-0 z-50 grid place-items-center backdrop-blur-xs">
      {props.status === 'paused' && (
        <Button
          variant="ghost"
          className="text-muted-foreground h-auto flex-col gap-3 rounded-2xl px-7 py-5 text-lg font-normal"
          onClick={() => send({ type: 'resume', clientId })}
        >
          <HugeiconsIcon icon={PlayIcon} className="size-16" />
          Continue
        </Button>
      )}
      {props.status === 'connecting' && (
        <p className="text-muted-foreground">Connecting…</p>
      )}
    </div>
  )
}
