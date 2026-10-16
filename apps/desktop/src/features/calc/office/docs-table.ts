import type { DocumentResult } from '../engine/types.ts'

/*
 * A note as a document for Copy to Docs: the note's name as its title, each part of the note under
 * a heading as a two-column table of what was worked out and its answer, short comments as quiet
 * lines beside it, and the note's total in bold last.
 */

export interface DocsTable {
  markdown: string
  /** The note's lines the document shows: calculations, headings and the comments kept. */
  lines: number
}

/** A comment longer than this is the note's own prose, which stays out of the document. */
export const SHORT_COMMENT = 140

const HEADER = ['| Calculation | Result |', '| --- | ---: |']

interface Section {
  heading: string | null
  /** Comments before the section's first calculation. */
  before: string[]
  rows: [calculation: string, result: string][]
  /** Comments after it. */
  after: string[]
}

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Text that reads as itself in Markdown, a table cell's pipes included. */
const plain = (text: string): string => squash(text).replace(/[\\`*_[\]<>~|#&]/g, '\\$&')

const row = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`

const totalRow = (total: string): string => row(['**Total**', `**${plain(total)}**`])

/** The first line's whole text when the title is that line, or that line cut short; null otherwise. */
function titleFor(line: string, title: string): string | null {
  const a = line.toLowerCase()
  const b = title.toLowerCase()

  return a === b || (b.endsWith('…') && a.startsWith(b.slice(0, -1))) ? line : null
}

/** The note as Markdown for Herald Docs, and how many of its lines it shows. */
export function docsTable(document: DocumentResult, title: string): DocsTable {
  let name = squash(title) || 'Calculations'
  const sections: Section[] = [{ heading: null, before: [], rows: [], after: [] }]
  let lines = 0
  let first = true

  for (const line of document.lines) {
    if (line.kind === 'blank') {
      continue
    }

    const section = sections[sections.length - 1]
    const opening = first
    first = false

    if (line.kind === 'heading' || line.kind === 'comment') {
      const text = squash(line.label ?? line.source.replace(line.kind === 'heading' ? /^\s*#+/ : /^\s*\/\//, ''))
      const named = opening && text ? titleFor(text, name) : null

      if (named) {
        name = named.length <= SHORT_COMMENT ? named : name
      } else if (text && line.kind === 'heading') {
        sections.push({ heading: text, before: [], rows: [], after: [] })
        lines++
      } else if (text && text.length <= SHORT_COMMENT) {
        const comments = section.rows.length ? section.after : section.before
        comments.push(text)
        lines++
      }
    } else if (line.kind === 'value' || line.kind === 'error') {
      const calculation = squash(line.source)

      if (calculation) {
        section.rows.push([calculation, line.kind === 'value' ? squash(line.display ?? line.value?.exact ?? '') || '—' : '—'])
        lines++
      }
    }
  }

  const total = squash(document.totalDisplay ?? '')
  const tables = sections.filter(section => section.rows.length).length
  const blocks = [`# ${plain(name)}`]

  for (const section of sections) {
    if (section.heading) {
      blocks.push(`## ${plain(section.heading)}`)
    }

    blocks.push(...section.before.map(text => `_${plain(text)}_`))

    if (section.rows.length) {
      const rows = section.rows.map(([calculation, result]) => row([plain(calculation), plain(result)]))
      blocks.push([...HEADER, ...rows, ...(total && tables === 1 ? [totalRow(total)] : [])].join('\n'))
    }

    blocks.push(...section.after.map(text => `_${plain(text)}_`))
  }

  // With several tables the total is the whole note's, so it stands alone rather than under the last.
  if (total && tables !== 1) {
    blocks.push([totalRow(total), HEADER[1]].join('\n'))
  }

  return { markdown: `${blocks.join('\n\n')}\n`, lines }
}

/** The note as a neat Markdown document: its name, a table for each heading's part, the total in bold. */
export function toDocsMarkdown(document: DocumentResult, title: string): string {
  return docsTable(document, title).markdown
}
