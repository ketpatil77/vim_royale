import { createContext, useContext, useState, useEffect } from 'react'

type CRTContextType = {
  crtEnabled: boolean
  toggleCrt: () => void
}

const CRTContext = createContext<CRTContextType | null>(null)

export function CRTProvider({ children }: { children: React.ReactNode }) {
  const [crtEnabled, setCrtEnabled] = useState(() => {
    const saved = localStorage.getItem('crtEnabled')
    return saved !== null ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('crtEnabled', JSON.stringify(crtEnabled))
  }, [crtEnabled])

  const toggleCrt = () => setCrtEnabled((prev: boolean) => !prev)

  return (
    <CRTContext.Provider value={{ crtEnabled, toggleCrt }}>
      {children}
    </CRTContext.Provider>
  )
}

export function useCRT() {
  const context = useContext(CRTContext)
  if (!context) throw new Error('useCRT must be used within CRTProvider')
  return context
}