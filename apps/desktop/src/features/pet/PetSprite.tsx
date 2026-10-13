import { useEffect, useRef } from 'react'
import { PET_FRAME_HEIGHT, PET_FRAME_WIDTH } from '../../../shared/pet.ts'
import type { LoadedSheet } from './sheet.ts'
import { frameAt, type PetPose, poseRow } from './sprite.ts'

const images = new Map<string, HTMLImageElement>()

function imageFor(url: string): HTMLImageElement {
  let image = images.get(url)

  if (!image) {
    for (const key of images.keys()) {
      images.delete(key)
    }

    image = new Image()
    image.decoding = 'async'
    image.src = url
    images.set(url, image)
  }

  return image
}

function paint(canvas: HTMLCanvasElement, image: HTMLImageElement, row: number, frame: number, mirror: boolean): void {
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (mirror) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, frame * PET_FRAME_WIDTH, row * PET_FRAME_HEIGHT, PET_FRAME_WIDTH, PET_FRAME_HEIGHT, 0, 0, canvas.width, canvas.height)
}

/**
 * One frame of the pet at a time, drawn on a canvas. A pose loops at a low frame rate while it
 * lasts; idle plays a couple of loops and then rests on its first frame, so a quiet pet sets no
 * timer at all, and none runs while it is hidden or motion is reduced.
 */
export function PetSprite({ sheet, pose, since, scale, reduced, paused, rest }: { sheet: LoadedSheet; pose: PetPose; since: number; scale: number; reduced: boolean; paused: boolean; rest?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const width = Math.max(1, Math.round(PET_FRAME_WIDTH * scale))
  const height = Math.max(1, Math.round(PET_FRAME_HEIGHT * scale))
  const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
  const { row, frames, mirror } = poseRow(pose, sheet.layout)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const image = imageFor(sheet.url)
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    const draw = () => {
      if (stopped) {
        return
      }

      const step = frameAt(rest ? 'idle' : pose, frames, Date.now() - since, reduced)
      // A pose held still (motion reduced, a worried pet at rest) shows its middle frame: a row's first
      // frame is often the plain standing one, so it would read as idle.
      paint(canvas, image, row, step.nextMs === null && pose !== 'idle' ? Math.floor(frames / 2) : step.frame, mirror)

      if (step.nextMs !== null && !paused) {
        timer = setTimeout(draw, Math.max(16, step.nextMs))
      }
    }

    if (image.complete && image.naturalWidth > 0) {
      draw()
    } else {
      image.addEventListener('load', draw, { once: true })
    }

    return () => {
      stopped = true
      image.removeEventListener('load', draw)

      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [sheet.url, pose, since, reduced, paused, rest, row, frames, mirror, width, height, ratio])

  return <canvas ref={canvasRef} width={Math.round(width * ratio)} height={Math.round(height * ratio)} style={{ width, height }} aria-hidden="true" className="pointer-events-none block select-none" />
}
