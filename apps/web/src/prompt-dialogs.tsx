import { useState } from 'react'
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

export function FolderDialog(props: {
  groupId: number
  directory: string | null
  onDone: () => void
}) {
  const [directory, setDirectory] = useState(props.directory ?? '')

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
            send({
              type: 'setDirectory',
              id: props.groupId,
              directory: directory.trim(),
            })
            props.onDone()
          }}
        >
          <DialogHeader>
            <DialogTitle>Group folder</DialogTitle>
            <DialogDescription>
              The first tab in this group starts here. Leave empty to use the
              shell setting.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Folder"
            className="font-mono"
            placeholder="~/projects/app"
            value={directory}
            onChange={(event) => setDirectory(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onDone}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
