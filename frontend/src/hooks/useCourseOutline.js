import { useEffect, useState } from 'react'
import { fetchCourseOutline } from '../lib/api'

/**
 * Fresh chapter/topic list for the Study Hub dropdowns (matches server outline.json / meta).
 */
export function useCourseOutline(courseId) {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    const run = async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        const data = await fetchCourseOutline(courseId)
        if (!cancelled) setChapters(Array.isArray(data.chapters) ? data.chapters : [])
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load outline')
          setChapters([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [courseId])

  return { chapters: courseId ? chapters : [], loading: !!courseId && loading, error }
}
