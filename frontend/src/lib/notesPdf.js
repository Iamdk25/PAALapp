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
  shell.style.cssText =
    'position:fixed;left:-12000px;top:0;width:820px;background:#fff;color:#0f172a;font-family:system-ui,Segoe UI,sans-serif;'

  const title = escapeHtml(meta.title || 'Study notes')
  shell.innerHTML = `
    <div style="padding:28px 36px 40px;box-sizing:border-box;">
      <div style="border-bottom:2px solid #006747;padding-bottom:12px;margin-bottom:22px;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">PAAL study notes</div>
        <h1 style="font-size:22px;font-weight:700;margin:10px 0 0;color:#006747;line-height:1.25;">${title}</h1>
      </div>
      <div class="paal-md" style="font-size:13px;line-height:1.65;color:#1e293b;">
        <style>
          .paal-md h1 { font-size: 18px; margin: 18px 0 8px; color: #0f172a; }
          .paal-md h2 { font-size: 16px; margin: 16px 0 6px; color: #14532d; }
          .paal-md h3 { font-size: 14px; margin: 14px 0 6px; color: #334155; }
          .paal-md p { margin: 0 0 10px; }
          .paal-md ul, .paal-md ol { margin: 0 0 10px; padding-left: 1.35em; }
          .paal-md li { margin: 4px 0; }
          .paal-md code { font-family: ui-monospace, monospace; font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
          .paal-md pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; overflow: hidden; font-size: 12px; white-space: pre-wrap; }
          .paal-md pre code { background: none; padding: 0; }
          .paal-md strong { color: #0f172a; }
          .paal-md blockquote { border-left: 3px solid #006747; margin: 10px 0; padding-left: 12px; color: #475569; }
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
    const fullHeight = Math.max(inner.scrollHeight, inner.getBoundingClientRect().height, 400)
    const fullWidth = Math.max(inner.scrollWidth, 820)

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })

    await doc.html(inner, {
      x: 12,
      y: 12,
      width: 186,
      windowWidth: fullWidth,
      autoPaging: 'text',
      html2canvas: {
        scale: 0.85,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowHeight: fullHeight,
        height: fullHeight,
        width: fullWidth,
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
