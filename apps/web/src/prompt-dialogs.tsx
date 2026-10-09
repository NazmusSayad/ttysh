import {
  ArrowUp01Icon,
  Folder01Icon,
  Home01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { send } from '@/session'

export function RenameDialog(props: {
  target: 'tab' | 'group'
  id: number
  name: string
  onDone: () => void
}) {
  const [name, setName] = useState(props.name)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onDone()
      }}
    >
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = name.trim()
            if (props.target === 'tab' || trimmed)
              send({ type: 'rename', id: props.id, name: trimmed })
            props.onDone()
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename {props.target}</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Name"
            placeholder={
              props.target === 'tab' ? 'Use terminal title' : undefined
            }
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onDone}>
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Listing = {
  path: string
  parent: string | null
  directories: { name: string; path: string }[]
}

async function listDirectories(path: string) {
  const response = await fetch(
    `/api/directories?path=${encodeURIComponent(path)}`
  )
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as Listing
}

export function FolderDialog(props: {
  groupId: number
  directory: string | null
  onDone: () => void
}) {
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const start = props.directory ?? '~'

  function open(path: string) {
    listDirectories(path).then(
      (next) => {
        setListing(next)
        setError(null)
      },
      (failure: unknown) =>
        setError(failure instanceof Error ? failure.message : String(failure))
    )
  }

  useEffect(() => {
    listDirectories(start).then(setListing, (failure: unknown) =>
      setError(failure instanceof Error ? failure.message : String(failure))
    )
  }, [start])

  function choose(directory: string) {
    send({ type: 'setDirectory', id: props.groupId, directory })
    props.onDone()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onDone()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Group folder</DialogTitle>
          <DialogDescription>
            The first tab in this group starts here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Parent folder"
              disabled={!listing?.parent}
              onClick={() => {
                if (listing?.parent) open(listing.parent)
              }}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Home folder"
              onClick={() => open('~')}
            >
              <HugeiconsIcon icon={Home01Icon} />
            </Button>
            <p
              className="bg-muted text-muted-foreground ml-1 h-7 min-w-0 flex-1 truncate rounded-md px-2.5 font-mono text-xs leading-7 [direction:rtl]"
              title={listing?.path}
            >
              {listing?.path}
            </p>
          </div>
          <div className="h-72 overflow-y-auto rounded-lg border p-1">
            {listing?.directories.map((directory) => (
              <button
                key={directory.path}
                className="hover:bg-muted flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors"
                onClick={() => open(directory.path)}
              >
                <HugeiconsIcon
                  icon={Folder01Icon}
                  className="text-muted-foreground size-4 flex-none"
                />
                <span className="truncate">{directory.name}</span>
              </button>
            ))}
            {listing?.directories.length === 0 && (
              <p className="text-muted-foreground grid h-full place-items-center text-sm">
                No folders here
              </p>
            )}
          </div>
          {error && (
            <p className="text-destructive text-sm break-all">{error}</p>
          )}
        </div>
        <DialogFooter>
          {props.directory !== null && (
            <Button
              variant="ghost"
              className="sm:mr-auto"
              onClick={() => choose('')}
            >
              Clear
            </Button>
          )}
          <Button variant="outline" onClick={props.onDone}>
            Cancel
          </Button>
          <Button
            disabled={!listing}
            onClick={() => {
              if (listing) choose(listing.path)
            }}
          >
            Use this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
