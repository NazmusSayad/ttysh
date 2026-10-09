import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'

import type { Platform } from '@/config'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

const logos = {
  zsh: 'M11.415 5.038a.58.58 0 0 0-.543.197L.135 18.021a.58.58 0 0 0 .071.814.58.58 0 0 0 .815-.07L11.757 5.979a.58.58 0 0 0-.07-.815.6.6 0 0 0-.272-.126m-8.113.317a3.133 3.133 0 0 0-3.12 3.12 3.13 3.13 0 0 0 3.12 3.119A3.133 3.133 0 0 0 6.42 8.475a3.13 3.13 0 0 0-3.119-3.119m0 1.806a1.3 1.3 0 0 1 1.314 1.313 1.3 1.3 0 0 1-1.314 1.312A1.3 1.3 0 0 1 1.99 8.475a1.3 1.3 0 0 1 1.312-1.314m5.253 5.253a3.13 3.13 0 0 0-3.119 3.119 3.13 3.13 0 0 0 3.12 3.118 3.133 3.133 0 0 0 3.118-3.12 3.133 3.133 0 0 0-3.119-3.118m0 1.805a1.3 1.3 0 0 1 1.313 1.314c0 .735-.577 1.312-1.312 1.312a1.3 1.3 0 0 1-1.314-1.312 1.3 1.3 0 0 1 1.313-1.314m7.201 3.276a.58.58 0 0 0-.578.578.58.58 0 0 0 .578.578h7.666a.58.58 0 0 0 .579-.578.58.58 0 0 0-.579-.578Z',
  bash: 'M21.038,4.9l-7.577-4.498C13.009,0.134,12.505,0,12,0c-0.505,0-1.009,0.134-1.462,0.403L2.961,4.9 C2.057,5.437,1.5,6.429,1.5,7.503v8.995c0,1.073,0.557,2.066,1.462,2.603l7.577,4.497C10.991,23.866,11.495,24,12,24 c0.505,0,1.009-0.134,1.461-0.402l7.577-4.497c0.904-0.537,1.462-1.529,1.462-2.603V7.503C22.5,6.429,21.943,5.437,21.038,4.9z M15.17,18.946l0.013,0.646c0.001,0.078-0.05,0.167-0.111,0.198l-0.383,0.22c-0.061,0.031-0.111-0.007-0.112-0.085L14.57,19.29 c-0.328,0.136-0.66,0.169-0.872,0.084c-0.04-0.016-0.057-0.075-0.041-0.142l0.139-0.584c0.011-0.046,0.036-0.092,0.069-0.121 c0.012-0.011,0.024-0.02,0.036-0.026c0.022-0.011,0.043-0.014,0.062-0.006c0.229,0.077,0.521,0.041,0.802-0.101 c0.357-0.181,0.596-0.545,0.592-0.907c-0.003-0.328-0.181-0.465-0.613-0.468c-0.55,0.001-1.064-0.107-1.072-0.917 c-0.007-0.667,0.34-1.361,0.889-1.8l-0.007-0.652c-0.001-0.08,0.048-0.168,0.111-0.2l0.37-0.236 c0.061-0.031,0.111,0.007,0.112,0.087l0.006,0.653c0.273-0.109,0.511-0.138,0.726-0.088c0.047,0.012,0.067,0.076,0.048,0.151 l-0.144,0.578c-0.011,0.044-0.036,0.088-0.065,0.116c-0.012,0.012-0.025,0.021-0.038,0.028c-0.019,0.01-0.038,0.013-0.057,0.009 c-0.098-0.022-0.332-0.073-0.699,0.113c-0.385,0.195-0.52,0.53-0.517,0.778c0.003,0.297,0.155,0.387,0.681,0.396 c0.7,0.012,1.003,0.318,1.01,1.023C16.105,17.747,15.736,18.491,15.17,18.946z M19.143,17.859c0,0.06-0.008,0.116-0.058,0.145 l-1.916,1.164c-0.05,0.029-0.09,0.004-0.09-0.056v-0.494c0-0.06,0.037-0.093,0.087-0.122l1.887-1.129 c0.05-0.029,0.09-0.004,0.09,0.056V17.859z M20.459,6.797l-7.168,4.427c-0.894,0.523-1.553,1.109-1.553,2.187v8.833 c0,0.645,0.26,1.063,0.66,1.184c-0.131,0.023-0.264,0.039-0.398,0.039c-0.42,0-0.833-0.114-1.197-0.33L3.226,18.64 c-0.741-0.44-1.201-1.261-1.201-2.142V7.503c0-0.881,0.46-1.702,1.201-2.142l7.577-4.498c0.363-0.216,0.777-0.33,1.197-0.33 c0.419,0,0.833,0.114,1.197,0.33l7.577,4.498c0.624,0.371,1.046,1.013,1.164,1.732C21.686,6.557,21.12,6.411,20.459,6.797z',
  fish: 'm19.164 9.228-3.016 2.688v.527l3.016 2.688v-1.228l-1.936-1.723 1.936-1.724V9.228m-6.658.046v1.208l1.905 1.696-1.905 1.695v1.209l2.968-2.645v-.518l-2.968-2.645M9.781 7.847a6.519 6.519 0 0 0-2.038-.335c-.672 0-1.349.112-2.03.335a9.23 9.23 0 0 0-2.088 1.017v.723c.69-.4 1.377-.7 2.06-.897a7.388 7.388 0 0 1 2.058-.296c.684 0 1.368.098 2.052.296a9.452 9.452 0 0 1 2.075.897v-.723a9.229 9.229 0 0 0-2.09-1.017m.014 7.78a7.371 7.371 0 0 1-2.052.296 7.388 7.388 0 0 1-2.057-.296 9.18 9.18 0 0 1-2.061-.897v.723a9.228 9.228 0 0 0 2.088 1.017 6.492 6.492 0 0 0 2.03.335c.678 0 1.357-.112 2.038-.335a9.227 9.227 0 0 0 2.089-1.017v-.723c-.7.4-1.391.7-2.075.897m.602-11.23h-.51L7.28 6.92h1.19l1.672-1.62 1.671 1.62h1.191l-2.607-2.525m-2.965 13.68v-.824H6.427v.825l.786 1.527h.614l-.395-1.527M4.127 10.95v1.216H5.13V10.95H4.127m-1.16-1.695L0 11.901v.518l2.967 2.645v-1.208L1.063 12.16l1.904-1.695V9.256m20.68 3.28c-.235-.3-.574-.509-1.017-.626.395-.103.696-.278.902-.525.206-.247.31-.556.31-.926 0-.546-.197-.984-.59-1.314-.393-.33-.919-.495-1.575-.495-.22 0-.473.025-.758.073-.284.048-.61.12-.974.217v.84c.314-.12.613-.21.9-.27a4.05 4.05 0 0 1 .832-.091c.403 0 .714.093.933.278.218.185.328.451.328.798 0 .328-.118.584-.353.768-.235.184-.562.276-.98.276h-.697v.75h.696c.458 0 .821.116 1.09.346.268.23.402.542.402.934 0 .425-.134.75-.402.976-.269.226-.653.339-1.153.339a3.55 3.55 0 0 1-.89-.117 4.395 4.395 0 0 1-.91-.358v.909a6.1 6.1 0 0 0 .95.249c.323.057.639.085.95.085.738 0 1.315-.177 1.733-.53.417-.355.626-.842.626-1.463 0-.449-.118-.823-.353-1.123',
  powershell:
    'M23.181 2.974c.568 0 .923.463.792 1.035l-3.659 15.982c-.13.572-.697 1.035-1.265 1.035H.819c-.568 0-.923-.463-.792-1.035L3.686 4.009c.13-.572.697-1.035 1.265-1.035zm-8.375 9.346c.251-.394.227-.905-.09-1.243L9.122 5.125c-.38-.404-1.037-.407-1.466-.003-.429.402-.468 1.056-.088 1.46l4.662 4.96v.11l-7.42 5.374c-.45.327-.533.977-.187 1.453.346.476.991.597 1.44.27l8.229-5.91c.28-.196.438-.365.514-.52zm-2.796 4.399a.928.928 0 00-.934.923c0 .51.418.923.934.923h4.433a.928.928 0 00.934-.923.928.928 0 00-.934-.923z',
  cmd: 'M8.165 6V3h7.665v3H8.165zm-.5-3H1c-.55 0-1 .45-1 1v2h7.665V3zM23 3h-6.67v3H24V4c0-.55-.45-1-1-1zM0 6.5h24V20c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V6.5zM11.5 18c0 .3.2.5.5.5h8c.3 0 .5-.2.5-.5v-1.5c0-.3-.2-.5-.5-.5h-8c-.3 0-.5.2-.5.5V18zm-5.2-4.55l-3.1 3.1c-.25.25-.25.6 0 .8l.9.9c.25.25.6.25.8 0l4.4-4.4a.52.52 0 0 0 0-.8l-4.4-4.4c-.2-.2-.6-.2-.8 0l-.9.9c-.25.2-.25.55 0 .8l3.1 3.1z',
}

type Shell = { name: string; path: string | null }

const logoNames: Record<string, keyof typeof logos> = {
  zsh: 'zsh',
  bash: 'bash',
  fish: 'fish',
  pwsh: 'powershell',
  powershell: 'powershell',
  cmd: 'cmd',
}

const knownShells: Record<Platform, string[]> = {
  macos: ['zsh', 'bash', 'fish', 'pwsh'],
  linux: ['bash', 'zsh', 'fish', 'pwsh'],
  windows: ['pwsh', 'powershell', 'cmd'],
}

function logoFor(command: string) {
  const name = command
    .trim()
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase()
    .replace(/\.exe$/, '')
  return name === undefined ? undefined : logoNames[name]
}

function folderOf(path: string) {
  return path.replace(/[\\/][^\\/]*$/, '')
}

async function loadShells() {
  const response = await fetch('/api/shells')
  if (!response.ok) throw new Error(await response.text())
  return (await response.json()) as { name: string; path: string }[]
}

function ShellLogo(props: { logo: keyof typeof logos }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 flex-none" fill="currentColor">
      <path d={logos[props.logo]} />
    </svg>
  )
}

export function ShellInput(props: {
  platform: Platform
  device: Platform
  value: string | null
  onCommit: (command: string | null) => void
}) {
  const [text, setText] = useState(props.value ?? '')
  const [installed, setInstalled] = useState<Shell[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const logo = logoFor(text)
  const isDevice = props.platform === props.device
  const shells: Shell[] | null = isDevice
    ? installed
    : knownShells[props.platform].map((name) => ({ name, path: null }))

  useEffect(() => {
    if (!isDevice) return
    loadShells().then(setInstalled, (failure: unknown) =>
      setError(failure instanceof Error ? failure.message : String(failure))
    )
  }, [isDevice])

  function commit(next: string) {
    setText(next)
    if (next === (props.value ?? '')) return
    props.onCommit(next === '' ? null : next)
  }

  return (
    <div className="relative w-56">
      {logo && (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
          <ShellLogo logo={logo} />
        </span>
      )}
      <Input
        className={logo ? 'pr-9 pl-8' : 'pr-9'}
        placeholder="System default"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Known shells"
            className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {error && (
            <p className="text-destructive px-2 py-1.5 text-xs">{error}</p>
          )}
          {shells?.length === 0 && (
            <p className="text-muted-foreground px-2 py-1.5 text-xs">
              No known shells found
            </p>
          )}
          {shells?.map((shell) => (
            <DropdownMenuItem
              key={shell.path ?? shell.name}
              onSelect={() => commit(shell.path ?? shell.name)}
            >
              <ShellLogo logo={logoNames[shell.name]} />
              {shell.name}
              {shell.path !== null && (
                <span
                  className="text-muted-foreground ml-auto min-w-0 truncate pl-3 text-xs [direction:rtl]"
                  title={shell.path}
                >
                  <bdi>{folderOf(shell.path)}</bdi>
                </span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => commit('')}>
            System default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
