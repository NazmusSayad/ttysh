import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

type Scope = 'server' | 'everything'

async function currentInstance() {
  try {
    const response = await fetch('/api/instance', { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as string
  } catch {
    return null
  }
}

async function restart(scope: Scope) {
  const response = await fetch(`/api/restart/${scope}`, { method: 'POST' })
  if (!response.ok) throw new Error(await response.text())
  const previous = (await response.json()) as string
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const instance = await currentInstance()
    if (instance !== null && instance !== previous) {
      location.reload()
      return
    }
  }
  throw new Error(
    'sshtty did not come back within 30 seconds. Check the terminal where it was started.'
  )
}

export function RestartRows() {
  const [restarting, setRestarting] = useState<Scope | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function run(scope: Scope) {
    setRestarting(scope)
    setError(null)
    restart(scope).catch((failure: unknown) => {
      setRestarting(null)
      setError(failure instanceof Error ? failure.message : String(failure))
    })
  }

  return (
    <>
      <RestartRow
        label="Restart server"
        description="Open terminals keep running"
        busy={restarting === 'server'}
        disabled={restarting !== null}
        onClick={() => run('server')}
      />
      <RestartRow
        label="Restart everything"
        description="Ends all open terminals and starts fresh shells"
        busy={restarting === 'everything'}
        disabled={restarting !== null}
        onClick={() => setConfirming(true)}
      />
      {error && (
        <p className="text-destructive px-4 py-2.5 text-sm break-words">
          {error}
        </p>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart everything?</AlertDialogTitle>
            <AlertDialogDescription>
              Every open terminal and anything running in it will be ended. Your
              groups and tabs stay and open with fresh shells.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run('everything')}
            >
              Restart everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RestartRow(props: {
  label: string
  description: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className="flex min-h-13 items-center justify-between gap-4 px-4 py-2.5">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{props.label}</span>
        <span className="text-muted-foreground text-xs">
          {props.description}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.busy ? 'Restarting…' : 'Restart'}
      </Button>
    </div>
  )
}
