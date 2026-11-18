import { useEffect, useState } from 'react'

// Aktuální měsíc (1–12) až po načtení v prohlížeči. Prerender (SSR) dostane null,
// ať se HTML neliší podle dne buildu (stejně jako kalkulačka).
export function useMonth() {
  const [month, setMonth] = useState(null)
  useEffect(() => { setMonth(new Date().getMonth() + 1) }, [])
  return month
}
