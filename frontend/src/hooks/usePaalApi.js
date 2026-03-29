import { useContext } from 'react'
import { PaalApiContext } from '../providers/paalApiContext'

export function usePaalApi() {
  return useContext(PaalApiContext)
}
