import type { ReactNode } from 'react'

export function Section(props: {
  title: string
  note?: string
  children: ReactNode
}) {
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

export function Row(props: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-h-13 items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-sm font-medium">{props.label}</span>
      <div className="shrink-0">{props.children}</div>
    </label>
  )
}
