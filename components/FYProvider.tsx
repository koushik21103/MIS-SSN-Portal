'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type FY = {
  id: string
  label: string
  isActive: boolean
}

type FYContextType = {
  fyId: string
  fyLabel: string
  availableFys: FY[]
  setFyId: (id: string) => void
  loading: boolean
}

const FYContext = createContext<FYContextType | undefined>(undefined)

export function FYProvider({ children }: { children: React.ReactNode }) {
  const [availableFys, setAvailableFys] = useState<FY[]>([])
  const [fyId, setFyIdState] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFys() {
      try {
        const res = await fetch('/api/fy')
        if (res.ok) {
          const fys: FY[] = await res.json()
          setAvailableFys(fys)
          
          // Default to the globally active one if no local override exists
          const activeFy = fys.find(f => f.isActive) || fys[0]
          if (activeFy) {
            setFyIdState(activeFy.id)
          }
        }
      } catch (err) {
        console.error('Failed to load FYs', err)
      } finally {
        setLoading(false)
      }
    }
    loadFys()
  }, [])

  const setFyId = (id: string) => {
    setFyIdState(id)
  }

  const currentFyLabel = availableFys.find(f => f.id === fyId)?.label || ''

  return (
    <FYContext.Provider value={{ fyId, fyLabel: currentFyLabel, availableFys, setFyId, loading }}>
      {children}
    </FYContext.Provider>
  )
}

export function useFY() {
  const context = useContext(FYContext)
  if (context === undefined) {
    throw new Error('useFY must be used within a FYProvider')
  }
  return context
}
