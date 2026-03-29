import { createContext } from 'react'

export const PaalApiContext = createContext({
  getToken: async () => 'local-dev-mock',
})
