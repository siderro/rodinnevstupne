import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Pokud nejsou klíče, appka běží v „ukázkovém" režimu (SAMPLE_VENUES).
export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured ? createClient(url, anonKey) : null

export const TABLE = 'rv_venues'
