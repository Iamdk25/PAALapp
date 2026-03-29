import { useCallback, useEffect, useState } from 'react'
import { fetchCourses } from '../lib/api'

/**
 * Courses backed by raw_pdfs/ on the API (pineconeCourse matches Pinecone metadata).
 */
export function useCourses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchCourses()
      setCourses(Array.isArray(list) ? list : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load courses')
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { courses, loading, error, refetch }
}
