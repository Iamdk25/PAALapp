import { jsPDF } from 'jspdf'
import { marked } from 'marked'
import { normalizeAgentOutput } from './parseAgent'

/** Strip outer ```markdown fence if the model wrapped output. */
export function stripNotesFences(raw) {
  const t = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  const m = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i)
  return m ? m[1].trim() : t
}

/** Crew box + "Final Output:" lines before real Markdown study guide. */
export function extractNotesMarkdown(raw) {
  let t = normalizeAgentOutput(typeof raw === 'string' ? raw : String(raw ?? ''))
  t = stripNotesFences(t.trim())
  t = t.replace(/^\s*Final\s+Output:\s*/i, '')
  t = stripNotesFences(t.trim())
  const atHeading = t.search(/(^|\n)#\s+\S/)
  if (atHeading > 0) t = t.slice(atHeading).trimStart()
  return t.trim() || stripNotesFences(normalizeAgentOutput(String(raw ?? '')))
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function sanitizeNotesFileBase(courseCode, topicLabel) {
  const combined = `${courseCode || 'PAAL'} — ${topicLabel || 'notes'}`
  return (
    combined
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'PAAL-notes'
  )
}

/**
 * Build a PDF from Markdown notes, open it in a new tab, and trigger download.
 * @param {string} markdown
 * @param {{ title: string, courseCode: string, topicLabel: string }} meta
 */
export async function openNotesPdfFromMarkdown(markdown, meta) {
  const md = stripNotesFences(markdown)
  const htmlBody = marked.parse(md, { async: false })

  const shell = document.createElement('div')
  // Map 1px to 1pt exactly for A4 (595.28pt wide). With 40pt margins, inner width is 515pt.
  // Using 515px strictly ensures no text is scaled up (preventing huge text) and avoids boundary truncation.
  shell.style.cssText =
    'position:fixed;left:-12000px;top:0;width:515px;max-width:515px;background:#ffffff;color:#0f172a;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;overflow-wrap:break-word;word-break:break-word;overflow-x:hidden;'

  const title = escapeHtml(meta.title || 'Study Material')
  const course = escapeHtml(meta.courseCode || '')

  shell.innerHTML = `
    <div style="width:515px; max-width:515px; box-sizing:border-box; overflow:hidden;">
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 20px;">
        ${course ? `<div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">${course}</div>` : ''}
        <h1 style="font-size: 20px; font-weight: 700; margin: 0; color: #0f172a; line-height: 1.3;">${title}</h1>
      </div>
      <div class="paal-md" style="font-size: 11.5px; line-height: 1.6; color: #1e293b;">
        <style>
          .paal-md h1 { font-size: 16px; font-weight: 700; margin: 20px 0 10px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; page-break-after: avoid; }
          .paal-md h2 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #0f172a; page-break-after: avoid; }
          .paal-md h3 { font-size: 12px; font-weight: 600; margin: 14px 0 6px; color: #1e293b; page-break-after: avoid; }
          .paal-md p { margin: 0 0 12px; text-align: justify; page-break-inside: avoid; }
          .paal-md ul, .paal-md ol { margin: 0 0 12px; padding-left: 20px; }
          .paal-md li { margin: 4px 0; page-break-inside: avoid; }
          .paal-md code { font-family: ui-monospace, monospace; font-size: 10px; background: #f1f5f9; padding: 2px 4px; border-radius: 4px; color: #0f172a; break-inside: avoid; }
          .paal-md pre { background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; overflow: hidden; font-size: 10px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.4; margin: 16px 0; page-break-inside: avoid; }
          .paal-md pre code { background: none; padding: 0; color: inherit; }
          .paal-md strong { color: #0f172a; font-weight: 600; }
          .paal-md blockquote { border-left: 3px solid #3b82f6; background: #f8fafc; margin: 16px 0; padding: 12px 16px; color: #475569; border-radius: 0 6px 6px 0; font-style: italic; page-break-inside: avoid; }
          .paal-md table { width: 100%; border-collapse: collapse; margin: 16px 0; page-break-inside: avoid; }
          .paal-md th, .paal-md td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          .paal-md th { background: #f8fafc; font-weight: 600; color: #0f172a; }
          .paal-md img { max-width: 100%; height: auto; border-radius: 6px; margin: 16px 0; page-break-inside: avoid; }
        </style>
        ${htmlBody}
      </div>
    </div>
  `

  document.body.appendChild(shell)

  try {
    const inner = shell.firstElementChild
    if (!inner) throw new Error('Could not build notes layout.')

    await new Promise((resolve) => requestAnimationFrame(() => resolve()))

    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true })

    await doc.html(inner, {
      margin: [40, 40, 40, 40],
      autoPaging: 'text',
      width: 515,
      windowWidth: 515,
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
    })

    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)

    window.open(url, '_blank', 'noopener,noreferrer')

    const fileBase = sanitizeNotesFileBase(meta.courseCode, meta.topicLabel)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileBase}.pdf`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()

    window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
  } finally {
    document.body.removeChild(shell)
  }
}
