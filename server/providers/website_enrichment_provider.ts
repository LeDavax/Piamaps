import type { ApplicationService } from '@adonisjs/core/types'
import { createClient } from '@libsql/client'

export default class WebsiteEnrichmentProvider {
  constructor(protected app: ApplicationService) {}

  async start() {
    const libsqlUrl = process.env.LIBSQL_URL
    const authToken = process.env.LIBSQL_AUTH_TOKEN

    if (!libsqlUrl) {
      console.warn('[enrich] LIBSQL_URL not set — skipping website enrichment')
      return
    }

    const db = createClient({ url: libsqlUrl, authToken })
    const { runEnrichment } = await import('#services/website_enrichment_service')

    // Fire-and-forget: doesn't block the HTTP server from starting
    runEnrichment(db).finally(() => db.close())
  }
}
