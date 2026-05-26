import sanitizeHtml from 'sanitize-html'

export function sanitizeCommentHtml(dirty: string) {
  return sanitizeHtml(dirty, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['class', 'data-type', 'data-id', 'data-label', 'data-mention-suggestion-char'],
    },
    allowedClasses: {
      span: ['mention'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  })
}

/** Extract user IDs from mention spans in sanitized HTML. */
export function extractMentionIds(html: string): string[] {
  const ids: string[] = []
  const re = /data-type="mention"[^>]*data-id="([^"]+)"/g
  let match
  while ((match = re.exec(html)) !== null) {
    if (match[1] && !ids.includes(match[1])) ids.push(match[1])
  }
  // Also check reversed attribute order
  const re2 = /data-id="([^"]+)"[^>]*data-type="mention"/g
  while ((match = re2.exec(html)) !== null) {
    if (match[1] && !ids.includes(match[1])) ids.push(match[1])
  }
  return ids
}

export function isEmptyCommentContent(sanitized: string) {
  const t = sanitized
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length === 0
}
