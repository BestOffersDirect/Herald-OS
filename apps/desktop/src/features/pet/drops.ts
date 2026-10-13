import { extensionOf, type OfficeApp, officeAppFor } from '../../../shared/office/files.ts'
import type { PetDropSuggestionId } from '../../../shared/pet.ts'

/*
 * Files dropped on the pet: what they can become, offered as a few choices, and the command or the
 * request to Hermes each choice turns into. Herald Docs, Sheets and Slides are offered only for the
 * formats they open, so a choice never fails on the file it was offered for.
 */

export type DropKind = 'pdf' | 'image' | 'document' | 'spreadsheet' | 'presentation' | 'other'

const EXTENSIONS: [DropKind, string][] = [
  ['pdf', 'pdf'],
  ['image', 'png jpg jpeg gif webp heic heif tif tiff bmp avif psd'],
  ['document', 'docx docm doc odt rtf md markdown txt pages'],
  ['spreadsheet', 'xlsx xlsm xls ods csv tsv numbers'],
  ['presentation', 'pptx ppt odp key']
]

const KINDS = new Map<string, DropKind>(EXTENSIONS.flatMap(([kind, list]) => list.split(' ').map(extension => [`.${extension}`, kind] as const)))

export function dropKind(filePath: string): DropKind {
  return KINDS.get(extensionOf(filePath)) ?? 'other'
}

export interface DropSuggestion {
  id: PetDropSuggestionId
  label: string
}

const MAX_FILES = 10
/** A path is named on a line of its own in a request, so it must hold no line break or control character. */
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/
const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/

const usable = (paths: readonly string[]): boolean => paths.length > 0 && paths.length <= MAX_FILES && paths.every(file => ABSOLUTE.test(file) && !CONTROL.test(file))

/** Herald opens it itself, without LibreOffice (which the pet cannot tell is there). */
const opensIn = (file: string, app: OfficeApp): boolean => officeAppFor(file, { libreOffice: false }) === app

function suggestionIds(paths: readonly string[]): PetDropSuggestionId[] {
  if (!usable(paths)) {
    return []
  }

  if (paths.length > 1) {
    return paths.every(file => ['pdf', 'image'].includes(dropKind(file))) ? ['summarize', 'fileInvoice', 'ask'] : ['summarize', 'ask']
  }

  const [file] = paths

  switch (dropKind(file)) {
    case 'pdf':
      return ['summarize', 'fileInvoice', 'slides', 'ask']
    case 'image':
      return ['canvas', 'describe', 'fileInvoice', 'ask']
    case 'document':
      return opensIn(file, 'docs') ? ['summarize', 'slides', 'openDocs', 'ask'] : ['summarize', 'ask']
    case 'spreadsheet':
      return opensIn(file, 'sheets') ? ['summarize', 'openSheets', 'ask'] : ['summarize', 'ask']
    case 'presentation':
      return opensIn(file, 'slides') ? ['summarize', 'openSlides', 'ask'] : ['summarize', 'ask']
    default:
      return ['ask']
  }
}

const LABELS: Record<PetDropSuggestionId, string> = {
  summarize: 'Summarise it',
  fileInvoice: 'File it as an invoice',
  slides: 'Turn it into slides',
  canvas: 'Edit in Herald Canvas',
  describe: 'What is in it?',
  openDocs: 'Open in Herald Docs',
  openSheets: 'Open in Herald Sheets',
  openSlides: 'Open in Herald Slides',
  ask: 'Ask about it'
}

const PLURAL_LABELS: Partial<Record<PetDropSuggestionId, string>> = {
  summarize: 'Summarise them',
  fileInvoice: 'File them as invoices',
  ask: 'Ask about them'
}

export function dropSuggestions(paths: readonly string[]): DropSuggestion[] {
  return suggestionIds(paths).map(id => ({ id, label: (paths.length > 1 ? PLURAL_LABELS[id] : undefined) ?? LABELS[id] }))
}

export type DropAction = { kind: 'command'; command: string; args: Record<string, unknown> } | { kind: 'prompt'; prompt: string }

const command = (id: string, args: Record<string, unknown>): DropAction => ({ kind: 'command', command: id, args })
const prompt = (text: string): DropAction => ({ kind: 'prompt', prompt: text })

export function dropAction(id: PetDropSuggestionId, paths: readonly string[], text?: string): DropAction | null {
  if (!suggestionIds(paths).includes(id)) {
    return null
  }

  const [file] = paths
  const several = paths.length > 1
  const list = paths.join('\n')

  switch (id) {
    case 'canvas':
      return command('canvas.open', { path: file })
    case 'openDocs':
      return command('docs.open', { path: file })
    case 'openSheets':
      return command('sheets.open', { path: file })
    case 'openSlides':
      return command('slides.open', { path: file })
    case 'slides':
      return dropKind(file) === 'pdf' ? prompt(`Make a short presentation in Herald Slides from this PDF: a few slides with its key points.\n${file}`) : command('slides.fromDocument', { document: file })
    case 'summarize':
      return prompt(several ? `Summarise these files for me, a few short lines each:\n${list}` : `Summarise this file for me in a few short lines:\n${list}`)
    case 'fileInvoice':
      return prompt(
        several
          ? `These are invoices. Read each one, give it a clear name (who it is from, the date and the amount) and file them where my invoices are kept. Show me the plan before you move or rename anything.\n${list}`
          : `This is an invoice. Read it, give it a clear name (who it is from, the date and the amount) and file it where my invoices are kept. Show me the plan before you move or rename anything.\n${list}`
      )
    case 'describe':
      return prompt(`What is in this image? Describe it briefly.\n${list}`)
    case 'ask': {
      const words = text?.trim()

      if (words) {
        return prompt(`${words}\n\n${several ? 'The files:' : 'The file:'}\n${list}`)
      }

      return prompt(several ? `Have a look at these files and tell me briefly what they are.\n${list}` : `Have a look at this file and tell me briefly what it is.\n${list}`)
    }
  }
}
