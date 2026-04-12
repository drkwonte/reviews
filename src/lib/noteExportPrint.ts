import { supabase } from '@/lib/supabase'

const QUESTION_IMAGES_BUCKET = 'question-images'
const SIGNED_URL_TTL_SECONDS = 3600

export interface RawNoteForExport {
  id: string
  subject: string
  category?: string | null
  source?: string | null
  created_at: string
  problem_url?: string | null
  answer_url?: string | null
  problem_text?: string | null
  answer_text?: string | null
  accuracy?: number | null
  review_count?: number | null
  is_favorite?: boolean
}

export interface PreparedExportNote extends RawNoteForExport {
  problemImageUrl: string | null
  answerImageUrl: string | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/\n/g, ' ')
}

async function resolveStorageImageUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl?.trim()) return null
  const value = pathOrUrl.trim()
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }
  const { data, error } = await supabase.storage
    .from(QUESTION_IMAGES_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.warn('noteExportPrint: signed URL failed', error?.message)
    return null
  }
  return data.signedUrl
}

export async function prepareNotesForPrintExport(rows: RawNoteForExport[]): Promise<PreparedExportNote[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      problemImageUrl: await resolveStorageImageUrl(row.problem_url),
      answerImageUrl: await resolveStorageImageUrl(row.answer_url),
    })),
  )
}

export interface NotesPrintMeta {
  titleLine: string
  filterLine: string
  exportedAt: string
}

export function buildNotesPrintHtml(notes: PreparedExportNote[], meta: NotesPrintMeta): string {
  const blocks = notes
    .map((n, index) => {
      const reviewed = (n.review_count ?? 0) > 0
      const accPct = reviewed ? Math.round((n.accuracy ?? 0) * 100) : null
      const problemImg = n.problemImageUrl
        ? `<div class="img-block"><img src="${escapeAttr(n.problemImageUrl)}" alt="문제 이미지" /></div>`
        : ''
      const answerImg = n.answerImageUrl
        ? `<div class="img-block"><img src="${escapeAttr(n.answerImageUrl)}" alt="정답 이미지" /></div>`
        : ''
      const problemText = n.problem_text?.trim()
        ? `<div class="text-block"><span class="label">문제 (텍스트)</span><pre>${escapeHtml(n.problem_text)}</pre></div>`
        : ''
      const answerText = n.answer_text?.trim()
        ? `<div class="text-block"><span class="label">정답 (텍스트)</span><pre>${escapeHtml(n.answer_text)}</pre></div>`
        : ''
      const stats = `<p class="stats">복습 ${n.review_count ?? 0}회 · ${
        reviewed && accPct !== null ? `최근 정답률 약 ${accPct}%` : '복습 전'
      }${n.is_favorite ? ' · ★ 중요' : ''}</p>`

      return `
        <article class="note" data-index="${index + 1}">
          <header class="note-head">
            <h2>${escapeHtml(n.subject || '과목 없음')}</h2>
            <p class="meta">${escapeHtml(n.category || '단원 미상')} · ${escapeHtml(n.source || '출처 없음')} · 등록 ${escapeHtml(
              n.created_at?.slice(0, 10) ?? '',
            )}</p>
          </header>
          ${problemImg}
          ${problemText}
          ${answerImg}
          ${answerText}
          ${stats}
        </article>
      `
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(meta.titleLine)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      color: #111;
      line-height: 1.5;
      padding: 16px 20px 32px;
      max-width: 800px;
      margin: 0 auto;
    }
    .doc-title { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
    .doc-meta { font-size: 12px; color: #444; margin: 0 0 4px; }
    .doc-filter { font-size: 12px; color: #666; margin: 0 0 24px; }
    .note {
      page-break-after: always;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .note:last-child { page-break-after: auto; }
    .note-head h2 { font-size: 16px; margin: 0 0 6px; }
    .note-head .meta { font-size: 11px; color: #555; margin: 0; }
    .img-block {
      margin: 12px 0;
      text-align: center;
      background: #f5f5f5;
      padding: 8px;
      border-radius: 6px;
    }
    .img-block img { max-width: 100%; height: auto; vertical-align: middle; }
    .text-block { margin: 12px 0; }
    .text-block .label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #333;
      margin-bottom: 4px;
    }
    .text-block pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 11px;
      margin: 0;
      padding: 10px;
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
    }
    .stats { font-size: 11px; color: #666; margin: 12px 0 0; }
    @media print {
      body { padding: 0; max-width: none; }
      .note { border-color: #999; }
    }
  </style>
</head>
<body>
  <h1 class="doc-title">${escapeHtml(meta.titleLine)}</h1>
  <p class="doc-meta">보낸 시각: ${escapeHtml(meta.exportedAt)} · 총 ${notes.length}건</p>
  <p class="doc-filter">${escapeHtml(meta.filterLine)}</p>
  ${blocks}
</body>
</html>`
}

export function openNotesPrintWindow(html: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.')
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  const runPrint = () => {
    printWindow.focus()
    printWindow.print()
  }
  setTimeout(runPrint, 350)
}
