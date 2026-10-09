import {
  ArrowUp01Icon,
  Cancel01Icon,
  Folder01Icon,
  Home01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
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
  const [search, setSearch] = useState('')
  const start = props.directory ?? '~'
  const directories = listing?.directories.filter((directory) =>
    directory.name.toLowerCase().includes(search.toLowerCase())
  )

  function open(path: string) {
    listDirectories(path).then(
      (next) => {
        setListing(next)
        setSearch('')
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
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Group folder</DialogTitle>
        <div className="flex items-center gap-1 border-b p-1">
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
            className="min-w-0 flex-1 truncate px-1.5 text-left font-mono text-xs [direction:rtl]"
            title={listing?.path}
          >
            <bdi>{listing?.path}</bdi>
          </p>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <HugeiconsIcon icon={Cancel01Icon} />
            </Button>
          </DialogClose>
        </div>
        <label className="flex h-9 items-center gap-2.5 border-b px-3">
          <HugeiconsIcon
            icon={Search01Icon}
            className="text-muted-foreground size-4 flex-none"
          />
          <input
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search this folder"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="h-72 overflow-y-auto p-1">
          {directories?.map((directory) => (
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
          {directories?.length === 0 && (
            <p className="text-muted-foreground grid h-full place-items-center text-sm">
              {search === '' ? 'No folders here' : 'No matching folders'}
            </p>
          )}
        </div>
        {error && (
          <p className="text-destructive border-t px-3 py-2 text-sm break-all">
            {error}
          </p>
        )}
        <DialogFooter className="border-t p-3">
          {props.directory !== null && (
            <Button
              variant="ghost"
              className="sm:mr-auto"
              onClick={() => choose('')}
            >
              Clear
            </Button>
          )}
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
