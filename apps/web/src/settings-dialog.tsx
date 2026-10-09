import { type ReactNode, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { type Config, paletteNames, saveConfig } from '@/config'
import { applyConfig, getState } from '@/session'

type Colors = Config['colors']

const namedColors: {
  key: Exclude<keyof Colors, 'palette' | 'boldIsBright'>
  label: string
}[] = [
  { key: 'background', label: 'Background' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'cursor', label: 'Cursor' },
  { key: 'cursorText', label: 'Cursor text' },
  { key: 'selectionBackground', label: 'Selection background' },
  { key: 'selectionForeground', label: 'Selection foreground' },
]

export function SettingsDialog(props: { onDone: () => void }) {
  const [draft, setDraft] = useState(getState().config)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await applyConfig(await saveConfig(draft))
      props.onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    }
    setSaving(false)
  }

  function update<Key extends Exclude<keyof Config, 'scrollback'>>(
    key: Key,
    value: Partial<Config[Key]>
  ) {
    setDraft({ ...draft, [key]: { ...draft[key], ...value } })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onDone()
      }}
    >
      <DialogContent className="max-h-[90dvh] grid-rows-[auto_1fr_auto] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved to ~/.ttysh/config.json</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 grid gap-6 overflow-y-auto px-4">
          <Section title="Shell" note="Applies to new terminals.">
            <Field label="Command">
              <Input
                placeholder="System default"
                value={draft.shell.command ?? ''}
                onChange={(event) =>
                  update('shell', {
                    command:
                      event.target.value === '' ? null : event.target.value,
                  })
                }
              />
            </Field>
            <Field label="Working directory">
              <Input
                value={draft.shell.cwd}
                onChange={(event) =>
                  update('shell', { cwd: event.target.value })
                }
              />
            </Field>
          </Section>
          <Section title="Font">
            <Field label="Family">
              <Input
                value={draft.font.family}
                onChange={(event) =>
                  update('font', { family: event.target.value })
                }
              />
            </Field>
            <Field label="Size">
              <NumberInput
                value={draft.font.size}
                step={0.5}
                onChange={(size) => update('font', { size })}
              />
            </Field>
            <Field label="Line height">
              <NumberInput
                value={draft.font.lineHeight}
                step={0.05}
                onChange={(lineHeight) => update('font', { lineHeight })}
              />
            </Field>
            <Toggle
              label="Ligatures"
              checked={draft.font.ligatures}
              onChange={(ligatures) => update('font', { ligatures })}
            />
          </Section>
          <Section title="Cursor">
            <Field label="Style">
              <Select
                value={draft.cursor.style}
                onValueChange={(style: Config['cursor']['style']) =>
                  update('cursor', { style })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Block</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="underline">Underline</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Toggle
              label="Blink"
              checked={draft.cursor.blink}
              onChange={(blink) => update('cursor', { blink })}
            />
          </Section>
          <Section title="Layout">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <Field key={side} label={`Padding ${side}`}>
                <NumberInput
                  value={draft.padding[side]}
                  onChange={(value) => update('padding', { [side]: value })}
                />
              </Field>
            ))}
            <Field label="Scrollback lines">
              <NumberInput
                value={draft.scrollback}
                step={1000}
                onChange={(scrollback) => setDraft({ ...draft, scrollback })}
              />
            </Field>
          </Section>
          <Section title="Colors">
            {namedColors.map((color) => (
              <ColorField
                key={color.key}
                label={color.label}
                value={draft.colors[color.key]}
                onChange={(value) => update('colors', { [color.key]: value })}
              />
            ))}
            <Toggle
              label="Bold text in bright colors"
              checked={draft.colors.boldIsBright}
              onChange={(boldIsBright) => update('colors', { boldIsBright })}
            />
          </Section>
          <section className="grid gap-3">
            <h3 className="font-medium">Palette</h3>
            <div className="grid grid-cols-8 gap-2">
              {draft.colors.palette.map((value, index) => (
                <input
                  key={paletteNames[index]}
                  type="color"
                  aria-label={paletteNames[index]}
                  title={`${paletteNames[index]} ${value.toUpperCase()}`}
                  className="h-8 w-full cursor-pointer rounded-md border bg-transparent p-1 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  value={value}
                  onChange={(event) =>
                    update('colors', {
                      palette: draft.colors.palette.map((item, position) =>
                        position === index ? event.target.value : item
                      ),
                    })
                  }
                />
              ))}
            </div>
          </section>
        </div>
        {error && (
          <p className="text-destructive text-sm whitespace-pre-wrap">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={props.onDone}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section(props: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="font-medium">{props.title}</h3>
        {props.note && (
          <p className="text-muted-foreground text-xs">{props.note}</p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{props.children}</div>
    </section>
  )
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <Label className="grid gap-1.5 font-normal">
      <span className="text-muted-foreground">{props.label}</span>
      {props.children}
    </Label>
  )
}

function NumberInput(props: {
  value: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      step={props.step ?? 1}
      value={props.value}
      onChange={(event) => props.onChange(event.target.valueAsNumber)}
    />
  )
}

function Toggle(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Label className="flex items-center justify-between gap-3 self-end font-normal">
      <span className="text-muted-foreground">{props.label}</span>
      <Switch checked={props.checked} onCheckedChange={props.onChange} />
    </Label>
  )
}

function ColorField(props: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={props.label}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={props.label}
          className="h-9 w-10 flex-none cursor-pointer rounded-md border bg-transparent p-1 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <Input
          className="font-mono uppercase"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </div>
    </Field>
  )
}
