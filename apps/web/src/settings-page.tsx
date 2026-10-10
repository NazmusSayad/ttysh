import { ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { type ReactNode, useRef, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  applyStyle,
  builtinFonts,
  loadDefaults,
  type Config,
  paletteNames,
  type Platform,
  platforms,
  saveConfig,
  type Shell,
  type ThemeColors,
} from '@/config'
import { cn } from '@/lib/utils'
import { RestartRows } from '@/restart'
import { ShellInput } from '@/shell-input'
import { customTheme, getThemes, themeColors } from '@/themes'

const namedColors: {
  key: Exclude<keyof ThemeColors, 'palette'>
  label: string
}[] = [
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'cursor', label: 'Cursor' },
  { key: 'cursorText', label: 'Cursor text' },
  { key: 'selectionBackground', label: 'Selection background' },
  { key: 'selectionForeground', label: 'Selection foreground' },
]

const hexColor = /^#[0-9a-f]{6}$/i

export function SettingsPage(props: { config: Config; platform: Platform }) {
  const [draft, setDraft] = useState(props.config)
  const [customFont, setCustomFont] = useState(
    !builtinFonts.some((font) => font.family === draft.font.family)
  )
  const [error, setError] = useState<string | null>(null)
  const [platform, setPlatform] = useState(props.platform)
  const shell = draft.shell[platform]
  const customColors =
    draft.theme.name === customTheme ? draft.theme.colors : undefined
  const timer = useRef<number | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [revision, setRevision] = useState(0)

  function commit(next: Config) {
    setDraft(next)
    void applyStyle(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveConfig(next).then(
        () => setError(null),
        (failure: unknown) =>
          setError(failure instanceof Error ? failure.message : String(failure))
      )
    }, 300)
  }

  async function restoreDefaults() {
    try {
      const defaults = await loadDefaults()
      setCustomFont(
        !builtinFonts.some((font) => font.family === defaults.font.family)
      )
      setRevision(revision + 1)
      commit(defaults)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }

  function updateColors(value: Partial<ThemeColors>) {
    if (!draft.theme.colors) throw new Error('the custom theme has no colors')
    update('theme', { colors: { ...draft.theme.colors, ...value } })
  }

  function updateShell(value: Partial<Shell>) {
    commit({
      ...draft,
      shell: { ...draft.shell, [platform]: { ...shell, ...value } },
    })
  }

  function update<Key extends Exclude<keyof Config, 'scrollback'>>(
    key: Key,
    value: Partial<Config[Key]>
  ) {
    commit({ ...draft, [key]: { ...draft[key], ...value } })
  }

  return (
    <div className="h-dvh overflow-auto px-6 pt-4 pb-7">
      <div key={revision} className="mx-auto w-full max-w-160 space-y-5">
        <div className="mb-6 flex h-9 min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            aria-label="Back to terminal"
            asChild
          >
            <a href="/">
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </a>
          </Button>
          <h1 className="shrink-0 text-xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="text-muted-foreground min-w-0 truncate text-sm">
            ~/.sshtty/config.json
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground -mr-2.5 ml-auto"
            onClick={() => setConfirming(true)}
          >
            Restore defaults
          </Button>
        </div>
        {error && (
          <p className="text-destructive text-sm whitespace-pre-wrap">
            Not saved: {error}
          </p>
        )}
        <Section title="Shell" note="Applies to new terminals">
          <Row label="Platform">
            <Select
              value={platform}
              onValueChange={(value: Platform) => setPlatform(value)}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                    {item.value === props.platform && (
                      <span className="text-muted-foreground">
                        (this device)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Command">
            <ShellInput
              key={`${platform}-command`}
              platform={platform}
              device={props.platform}
              value={shell.command}
              onCommit={(command) => updateShell({ command })}
            />
          </Row>
          <Row label="Working directory">
            <TextInput
              key={`${platform}-cwd`}
              value={shell.cwd}
              onCommit={(cwd) => updateShell({ cwd })}
            />
          </Row>
        </Section>
        <Section title="Font">
          <Row label="Family">
            <Select
              value={customFont ? 'custom' : draft.font.family}
              onValueChange={(family) => {
                setCustomFont(family === 'custom')
                if (family !== 'custom') update('font', { family })
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {builtinFonts.map((font) => (
                  <SelectItem key={font.family} value={font.family}>
                    {font.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          {customFont && (
            <Row label="Custom family">
              <TextInput
                placeholder="Installed font name"
                value={draft.font.family}
                onCommit={(family) => update('font', { family })}
              />
            </Row>
          )}
          <Row label="Size">
            <NumberInput
              value={draft.font.size}
              step={0.5}
              onCommit={(size) => update('font', { size })}
            />
          </Row>
          <Row label="Line height">
            <NumberInput
              value={draft.font.lineHeight}
              step={0.05}
              onCommit={(lineHeight) => update('font', { lineHeight })}
            />
          </Row>
          <Row label="Ligatures">
            <Switch
              checked={draft.font.ligatures}
              onCheckedChange={(ligatures) => update('font', { ligatures })}
            />
          </Row>
        </Section>
        <Section title="Cursor">
          <Row label="Style">
            <Select
              value={draft.cursor.style}
              onValueChange={(style: Config['cursor']['style']) =>
                update('cursor', { style })
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="underline">Underline</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Blink">
            <Switch
              checked={draft.cursor.blink}
              onCheckedChange={(blink) => update('cursor', { blink })}
            />
          </Row>
        </Section>
        <Section title="Keyboard">
          <Row label="Shift+Enter inserts a new line">
            <Switch
              checked={draft.keyboard.shiftEnterNewline}
              onCheckedChange={(shiftEnterNewline) =>
                update('keyboard', { shiftEnterNewline })
              }
            />
          </Row>
        </Section>
        <Section title="Layout">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <Row key={side} label={`Padding ${side}`}>
              <NumberInput
                value={draft.padding[side]}
                onCommit={(value) => update('padding', { [side]: value })}
              />
            </Row>
          ))}
          <Row label="Scrollback lines">
            <NumberInput
              value={draft.scrollback}
              step={1000}
              onCommit={(scrollback) => commit({ ...draft, scrollback })}
            />
          </Row>
        </Section>
        <Section title="Theme">
          <Row label="Theme">
            <Select
              value={draft.theme.name}
              onValueChange={(name) =>
                update('theme', {
                  name,
                  colors:
                    name === customTheme
                      ? (draft.theme.colors ?? themeColors(draft.theme))
                      : draft.theme.colors,
                })
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getThemes().map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
                <SelectItem value={customTheme}>Custom</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Bold text in bright colors">
            <Switch
              checked={draft.theme.boldIsBright}
              onCheckedChange={(boldIsBright) =>
                update('theme', { boldIsBright })
              }
            />
          </Row>
        </Section>
        {customColors && (
          <>
            <Section title="Custom colors">
              {namedColors.map((color) => (
                <Row key={color.key} label={color.label}>
                  <ColorInput
                    label={color.label}
                    value={customColors[color.key]}
                    onCommit={(value) => updateColors({ [color.key]: value })}
                  />
                </Row>
              ))}
            </Section>
            <Section title="Custom palette">
              {(['Normal', 'Bright'] as const).map((row, rowIndex) => (
                <Row key={row} label={row}>
                  <div className="flex gap-1.5">
                    {customColors.palette
                      .slice(rowIndex * 8, rowIndex * 8 + 8)
                      .map((value, offset) => {
                        const index = rowIndex * 8 + offset
                        return (
                          <Swatch
                            key={paletteNames[index]}
                            label={paletteNames[index]}
                            value={value}
                            onChange={(next) =>
                              updateColors({
                                palette: customColors.palette.map(
                                  (item, position) =>
                                    position === index ? next : item
                                ),
                              })
                            }
                          />
                        )
                      })}
                  </div>
                </Row>
              ))}
            </Section>
          </>
        )}
        <Section title="Restart">
          <RestartRows />
        </Section>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              Every setting, including the shell for all platforms, goes back to
              its default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void restoreDefaults()}
            >
              Restore defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Section(props: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-muted-foreground mb-2 px-1 text-xs font-medium">
        {props.title}
        {props.note && <span className="font-normal"> · {props.note}</span>}
      </h2>
      <div className="bg-card divide-y overflow-hidden rounded-xl border">
        {props.children}
      </div>
    </section>
  )
}

function Row(props: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-h-13 items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-sm font-medium">{props.label}</span>
      <div className="shrink-0">{props.children}</div>
    </label>
  )
}

function TextInput(props: {
  value: string
  placeholder?: string
  className?: string
  type?: 'text' | 'number'
  step?: number
  valid?: (text: string) => boolean
  onCommit: (text: string) => void
}) {
  const [text, setText] = useState(props.value)

  function finish() {
    if (text === props.value) return
    if (props.valid && !props.valid(text)) {
      setText(props.value)
      return
    }
    props.onCommit(text)
  }

  return (
    <Input
      className={cn('w-56', props.className)}
      type={props.type}
      min={props.type === 'number' ? 0 : undefined}
      step={props.step}
      placeholder={props.placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

function NumberInput(props: {
  value: number
  step?: number
  onCommit: (value: number) => void
}) {
  return (
    <TextInput
      key={props.value}
      type="number"
      className="w-24"
      step={props.step ?? 1}
      value={String(props.value)}
      valid={(text) => text !== '' && Number(text) >= 0}
      onCommit={(text) => props.onCommit(Number(text))}
    />
  )
}

function ColorInput(props: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Swatch
        label={props.label}
        value={props.value}
        onChange={props.onCommit}
      />
      <TextInput
        key={props.value}
        className="w-24 font-mono uppercase"
        value={props.value}
        valid={(text) => hexColor.test(text)}
        onCommit={props.onCommit}
      />
    </div>
  )
}

function Swatch(props: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="color"
      aria-label={props.label}
      title={`${props.label} ${props.value.toUpperCase()}`}
      className="size-7 cursor-pointer rounded-md border bg-transparent p-0.5 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  )
}
