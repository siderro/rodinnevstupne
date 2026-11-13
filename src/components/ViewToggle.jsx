// Přepínač „Seznam / Mapa“ (stav je v URL, takže funguje Zpět i sdílení odkazu)
export default function ViewToggle({ value, onChange }) {
  return (
    <div className="segmented segmented--sm view-toggle" role="group" aria-label="Zobrazení výsledků">
      {[['seznam', 'Seznam'], ['mapa', 'Mapa']].map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} className={value === v ? 'is-on' : ''}
          onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}
