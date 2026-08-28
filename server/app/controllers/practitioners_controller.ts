import { practitioners } from '#data/mock_practitioners'
import type { HttpContext } from '@adonisjs/core/http'

const PROFESSION_LABELS: Record<string, string> = {
  '1': 'Médecin',
  '21': 'Pharmacien',
  '26': 'Audioprothésiste',
  '28': 'Opticien-Lunetier',
  '40': 'Chirurgien-Dentiste',
  '50': 'Sage-Femme',
  '60': 'Infirmier',
  '70': 'Masseur-Kinésithérapeute',
  '80': 'Pédicure-Podologue',
  '81': 'Orthophoniste',
  '82': 'Orthoptiste',
  '83': 'Psychomotricien',
  '86': 'Ergothérapeute',
  '91': 'Diététicien',
  '93': 'Psychologue',
  '94': 'Ostéopathe',
  '96': 'Chiropracteur',
}

export default class PractitionersController {
  async index({ request }: HttpContext) {
    const profession = request.input('profession', '').toLowerCase()
    const location = request.input('location', '').toLowerCase()
    const lat = request.input('lat')
    const lng = request.input('lng')

    let results = [...practitioners]

    if (profession) {
      results = results.filter((p) => {
        const label = (PROFESSION_LABELS[p.profession_code] ?? '').toLowerCase()
        const diplomas = p.diplomas ?? ''
        return (
          label.includes(profession) ||
          diplomas.toLowerCase().includes(profession)
        )
      })
    }

    if (location) {
      results = results.filter(
        (p) =>
          p.city.toLowerCase().includes(location) ||
          p.postal_code.includes(location) ||
          p.department_code === location
      )
    }

    const data = results.map((p) => ({
      ...p,
      profession_label: PROFESSION_LABELS[p.profession_code] ?? p.profession_code,
      distance:
        lat && lng && p.latitude && p.longitude
          ? this.haversine(+lat, +lng, p.latitude, p.longitude)
          : null,
    }))

    if (lat && lng) {
      data.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    }

    return { data }
  }

  async show({ params, response }: HttpContext) {
    const practitioner = practitioners.find((p) => p.id === params.id)

    if (!practitioner) {
      return response.notFound({ error: 'Practitioner not found' })
    }

    return {
      data: {
        ...practitioner,
        profession_label: PROFESSION_LABELS[practitioner.profession_code] ?? practitioner.profession_code,
      },
    }
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
  }
}
