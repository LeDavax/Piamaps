import { BaseCommand, flags } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import { createClient } from '@libsql/client'
import { runEnrichment } from '#services/website_enrichment_service'

export default class EnrichWebsites extends BaseCommand {
  static commandName = 'enrich:websites'
  static description = 'Enrich practitioners with booking site URLs via DuckDuckGo (Turso DB)'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Overwrite existing website entries', alias: 'f' })
  declare force: boolean

  async run() {
    const libsqlUrl = process.env.LIBSQL_URL
    const authToken = process.env.LIBSQL_AUTH_TOKEN

    if (!libsqlUrl) {
      this.logger.error('LIBSQL_URL environment variable is required')
      this.exitCode = 1
      return
    }

    const db = createClient({ url: libsqlUrl, authToken })

    await runEnrichment(db, {
      force: this.force,
      logger: {
        info: (m) => this.logger.info(m),
        success: (m) => this.logger.success(m),
        error: (m) => this.logger.error(m),
      },
    })

    db.close()
  }
}
