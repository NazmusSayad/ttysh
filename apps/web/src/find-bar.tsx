import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { closeFind, find, isFindShortcut, onFindResults } from '@/session'

export function FindBar(props: { id: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [results, setResults] = useState({ resultIndex: -1, resultCount: 0 })

  useEffect(() => onFindResults(props.id, setResults), [props.id])

  useEffect(() => input.current?.focus(), [])

  function search(next: string, backwards: boolean, incremental: boolean) {
    setText(next)
    find(props.id, next, backwards, incremental)
  }

  return (
    <div className="bg-card absolute top-2 right-4 z-10 flex items-center gap-1 rounded-lg border p-1 shadow-lg">
      <Input
        ref={input}
        data-find
        className="h-7 w-52"
        placeholder="Find"
        value={text}
        onChange={(event) => search(event.target.value, false, true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            closeFind(props.id)
            return
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            search(text, event.shiftKey, false)
            return
          }
          if (isFindShortcut(event.nativeEvent)) {
            event.preventDefault()
            event.currentTarget.select()
          }
        }}
      />
      <span className="text-muted-foreground w-16 text-center text-xs tabular-nums">
        {text === ''
          ? ''
          : results.resultCount === 0
            ? 'No results'
            : `${results.resultIndex + 1} of ${results.resultCount}`}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous match"
        onClick={() => search(text, true, false)}
      >
        <HugeiconsIcon icon={ArrowUp01Icon} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next match"
        onClick={() => search(text, false, false)}
      >
        <HugeiconsIcon icon={ArrowDown01Icon} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Close find"
        onClick={() => closeFind(props.id)}
      >
        <HugeiconsIcon icon={Cancel01Icon} />
      </Button>
    </div>
  )
}
