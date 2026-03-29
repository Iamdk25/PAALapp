/**
 * Helpers for course objects returned by GET /api/courses
 * (see course_catalog.py + raw_pdfs/ folder names).
 */

export function findCourseById(courses, id) {
  if (!id || !Array.isArray(courses)) return null
  return courses.find((c) => c.id === id) ?? null
}
