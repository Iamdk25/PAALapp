import ReactMarkdown from 'react-markdown'

/**
 * Renders tutor / assistant content as Markdown (headings, lists, bold).
 * Uses CommonMark via react-markdown only — no extra remark plugins, so the
 * bundle does not depend on remark-gfm (avoids missing-module errors when
 * node_modules is out of sync).
 */
export function AssistantMarkdown({ content }) {
  return (
    <div className="assistant-md prose prose-sm max-w-none text-slate-800 prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-bold prose-headings:text-slate-900 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-slate-900">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
