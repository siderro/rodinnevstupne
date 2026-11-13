import { Link } from 'react-router-dom'
import { getNovinky } from '../lib/novinky'
import { getVenueBySlug } from '../lib/venues'
import { formatDate } from '../lib/constants'
import { novinkyMeta, venuePath } from '../lib/seo'
import { useHead } from '../lib/useHead'
import VenueCard from '../components/VenueCard'

const placesWord = (n) => (n === 1 ? 'místo' : n >= 2 && n <= 4 ? 'místa' : 'míst')

export default function Novinky() {
  useHead(novinkyMeta())
  const releases = getNovinky()

  return (
    <>
      <section className="hero">
        <h1>Novinky v katalogu</h1>
        <p className="lead">
          Co jsme nově přidali a kde jsme opravili cenu nebo pravidla. Každé místo ověřujeme
          na oficiálním ceníku. Novinky můžete sledovat i přes <a href={`${import.meta.env.BASE_URL}rss.xml`}>RSS</a>.
        </p>
        <p><Link className="btn btn--ghost" to="/tip/">Znáte místo, které chybí? Pošlete tip</Link></p>
      </section>

      {releases.length === 0 && <p className="empty">Zatím tu nic není.</p>}

      {releases.map((r) => {
        const added = (r.added || []).map(getVenueBySlug).filter(Boolean)
        const updated = (r.updated || []).map((s) => ({ slug: s, venue: getVenueBySlug(s) }))
        const removed = r.removed || []
        return (
          <section key={r.date} id={r.date} className="release" aria-labelledby={`h-${r.date}`}>
            <p className="release-date"><time dateTime={r.date}>{formatDate(r.date)}</time>
              {r.total != null && <> · v katalogu {r.total}{' '}{placesWord(r.total)}</>}
            </p>
            <h2 id={`h-${r.date}`}>{r.headline}</h2>

            {added.length > 0 && (
              <>
                <h3 className="h-sm">{r.type === 'launch' ? 'Na startu' : 'Nově přidáno'} ({added.length})</h3>
                <div className="grid">
                  {added.map((v) => <VenueCard key={v.slug} venue={v} />)}
                </div>
              </>
            )}

            {updated.length > 0 && (
              <>
                <h3 className="h-sm">Opravili jsme</h3>
                <ul className="release-list">
                  {updated.map(({ slug, venue }) => (
                    <li key={slug}>
                      {venue ? <Link to={venuePath(venue)}>{venue.name}</Link> : slug}
                      {r.changes?.[slug]?.length > 0 && <>: {r.changes[slug].join(', ')}</>}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {removed.length > 0 && (
              <>
                <h3 className="h-sm">Vyřadili jsme</h3>
                <ul className="release-list">
                  {removed.map((s) => <li key={s}>{r.removed_names?.[s] || s}</li>)}
                </ul>
              </>
            )}
          </section>
        )
      })}
    </>
  )
}
