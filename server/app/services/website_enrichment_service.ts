import { createClient, type Client } from '@libsql/client'
import { parse as parseHtml } from 'node-html-parser'

const ALLOWED_DOMAINS = ['doctolib.fr', 'docorga.fr', 'lemedecin.fr', 'maiia.com', 'keldoc.com']

const PROFESSION_LABELS: Record<string, string> = {
  '10': 'médecin',
  '21': 'chirurgien-dentiste',
  '26': 'pharmacien',
  '28': 'infirmier',
  '31': 'kinésithérapeute',
  '32': 'pédicure podologue',
  '33': 'ergothérapeute',
  '35': 'orthophoniste',
  '40': 'sage-femme',
  '69': 'diététicien',
  '1': 'médecin',
  '3': 'chirurgien-dentiste',
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

export interface EnrichLogger {
  info(msg: string): void
  success(msg: string): void
  error(msg: string): void
}

export interface EnrichOptions {
  force?: boolean
  logger?: EnrichLogger
}

function isAllowedDomain(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl)
    return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))
  } catch {
    return false
  }
}

function cleanDdgUrl(href: string): string {
  if (href.includes('uddg=')) {
    try {
      const uddg = new URL(href, 'https://duckduckgo.com').searchParams.get('uddg')
      return uddg ? decodeURIComponent(uddg) : href
    } catch {
      return href
    }
  }
  return href
}

async function searchDdg(query: string): Promise<string[]> {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  const params = new URLSearchParams({ q: query, kp: '1', kl: 'fr-fr' })

  try {
    const res = await fetch(`https://html.duckduckgo.com/html?${params.toString()}`, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(8000),
    })

    const html = await res.text()
    const root = parseHtml(html)
    const urls: string[] = []

    for (const block of root.querySelectorAll('.result.web-result').slice(0, 5)) {
      const href = block.querySelector('.result__a')?.getAttribute('href') ?? ''
      const url = cleanDdgUrl(href)
      if (url && isAllowedDomain(url) && !urls.includes(url)) {
        urls.push(url)
      }
    }

    return urls
  } catch {
    return []
  }
}

export async function runEnrichment(db: Client, options: EnrichOptions = {}): Promise<void> {
  const log: EnrichLogger = options.logger ?? {
    info: (m) => console.log(`[enrich] ${m}`),
    success: (m) => console.log(`[enrich] ✓ ${m}`),
    error: (m) => console.error(`[enrich] ✗ ${m}`),
  }

  const whereClause =
    options.force ? '' : "WHERE website IS NULL OR website = '' OR website = '[]'"

  const { rows } = await db.execute(
    `SELECT id, first_name, last_name, profession_code, city FROM practitioners ${whereClause} ORDER BY id DESC`
  )

  log.info(`${rows.length} practitioners to process`)

  let updated = 0

  for (const row of rows) {
    const id = String(row[0])
    const firstName = String(row[1])
    const lastName = String(row[2])
    const profession = PROFESSION_LABELS[String(row[3] ?? '')] ?? 'professionnel de santé'
    const city = String(row[4] ?? '')

    const query = `"${firstName} ${lastName}" ${profession} ${city} doctolib OR keldoc OR maiia OR lemedecin OR docorga`
    log.info(`→ ${firstName} ${lastName} (${city})`)

    const urls = await searchDdg(query)

    if (urls.length > 0) {
      await db.execute({
        sql: 'UPDATE practitioners SET website = ? WHERE id = ?',
        args: [JSON.stringify(urls), id],
      })
      log.info(`   ✓ ${urls.join(', ')}`)
      updated++
    }

    await new Promise((r) => setTimeout(r, 1500))
  }

  log.success(`Done — ${updated}/${rows.length} updated`)
}
