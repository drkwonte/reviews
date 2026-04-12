import { supabase } from '@/lib/supabase'

export const QUESTION_IMAGES_BUCKET = 'question-images'

/**
 * Reads ordered storage paths or absolute URLs from JSONB `problem_urls` / `answer_urls`,
 * falling back to the legacy single `problem_url` / `answer_url` column.
 */
export function normalizeStoredImagePathList(value: unknown, singleFallback?: string | null): string[] {
  if (Array.isArray(value)) {
    const paths = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
    if (paths.length > 0) return paths
  }
  if (typeof singleFallback === 'string' && singleFallback.trim().length > 0) {
    return [singleFallback.trim()]
  }
  return []
}

export function pathsToPublicImageUrls(paths: string[]): string[] {
  return paths.map((pathOrUrl) => {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl
    }
    const { data } = supabase.storage.from(QUESTION_IMAGES_BUCKET).getPublicUrl(pathOrUrl)
    return data.publicUrl
  })
}
