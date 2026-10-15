import { drawPetFrame } from '../../petdex/draw.ts'
import type { PetFrame } from './engine.ts'
import type { SceneLayout } from './layout.ts'

/** How far down its frame a pet's feet are: the frame's bottom edge sits a little below them. */
export const FEET = 0.92

const SHADOW = 'rgba(0, 8, 40, 0.42)'
const SHADOW_EDGE = 'rgba(0, 8, 40, 0)'

/** Where a pet's frame is drawn, for its feet at (x, y). */
export function spriteRect(frame: Pick<PetFrame, 'x' | 'y'>, pet: SceneLayout['pet']): { x: number; y: number; width: number; height: number } {
  return { x: frame.x - pet.width / 2, y: frame.y - pet.height * FEET, width: pet.width, height: pet.height }
}

/** Every pet back to front, each on a soft shadow, into a context `ratio` device pixels to a CSS pixel. */
export function paintPets(ctx: CanvasRenderingContext2D, frames: readonly PetFrame[], layout: SceneLayout, ratio: number, draw: typeof drawPetFrame = drawPetFrame): void {
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, layout.width, layout.height)
  const radius = layout.pet.width * 0.32
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
  shadow.addColorStop(0, SHADOW)
  shadow.addColorStop(1, SHADOW_EDGE)

  for (const frame of frames) {
    if (frame.opacity <= 0) {
      continue
    }

    ctx.save()
    ctx.globalAlpha = Math.min(1, frame.opacity)
    ctx.translate(frame.x, frame.y)
    ctx.scale(1, 0.3)
    ctx.fillStyle = shadow
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    if (frame.sheet && frame.cell) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, frame.opacity)
      draw(ctx, frame.sheet, { row: frame.cell.row, frame: frame.cell.frame, mirror: frame.cell.mirror }, spriteRect(frame, layout.pet), frame.tint)
      ctx.restore()
    }
  }
}
