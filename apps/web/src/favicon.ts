import type { Config } from '@/config'

const size = 64
const storageKey = 'ttysh-favicons'
const limit = 32
const cache = new Map<string, string>(readStored())
let current = ''

export function updateFavicon(logo: string | null, colors: Config['colors']) {
  const key = `${logo}|${colors.background}|${colors.foreground}`
  if (key === current) return
  current = key
  const cached = cache.get(key)
  if (cached !== undefined) {
    iconLink().href = cached
    return
  }
  void draw(logo, colors).then(
    (url) => {
      remember(key, url)
      if (key === current) iconLink().href = url
    },
    (error: unknown) => console.error(error)
  )
}

function readStored(): [string, string][] {
  const stored = localStorage.getItem(storageKey)
  if (stored === null) return []
  return JSON.parse(stored) as [string, string][]
}

function remember(key: string, url: string) {
  cache.delete(key)
  cache.set(key, url)
  for (const oldest of cache.keys()) {
    if (cache.size <= limit) break
    cache.delete(oldest)
  }
  localStorage.setItem(storageKey, JSON.stringify([...cache]))
}

async function draw(logo: string | null, colors: Config['colors']) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas 2d context is unavailable')

  if (logo === null) {
    drawBadge(context, 0, size, colors)
    return canvas.toDataURL()
  }

  const image = await loadImage(`/api/logos/${logo}`)
  const scale = Math.max(size / image.width, size / image.height)
  const width = image.width * scale
  const height = image.height * scale
  context.save()
  context.beginPath()
  context.roundRect(0, 0, size, size, 12)
  context.clip()
  context.drawImage(
    image,
    (size - width) / 2,
    (size - height) / 2,
    width,
    height
  )
  context.restore()

  context.globalCompositeOperation = 'destination-out'
  context.beginPath()
  context.roundRect(24, 24, 44, 44, 13)
  context.fill()
  context.globalCompositeOperation = 'source-over'
  drawBadge(context, 28, 36, colors)
  return canvas.toDataURL()
}

function drawBadge(
  context: CanvasRenderingContext2D,
  offset: number,
  extent: number,
  colors: Config['colors']
) {
  function point(x: number, y: number) {
    return [offset + x * extent, offset + y * extent] as const
  }
  context.fillStyle = colors.background
  context.beginPath()
  context.roundRect(offset, offset, extent, extent, extent * 0.25)
  context.fill()
  context.strokeStyle = colors.foreground
  context.lineWidth = extent * 0.11
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(...point(0.24, 0.3))
  context.lineTo(...point(0.46, 0.5))
  context.lineTo(...point(0.24, 0.7))
  context.moveTo(...point(0.54, 0.7))
  context.lineTo(...point(0.76, 0.7))
  context.stroke()
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`could not load ${src}`))
    image.src = src
  })
}

function iconLink() {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (existing) return existing
  const link = document.createElement('link')
  link.rel = 'icon'
  document.head.append(link)
  return link
}
