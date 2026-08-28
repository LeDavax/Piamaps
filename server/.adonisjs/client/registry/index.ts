/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'practitioners.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/practitioners',
    tokens: [{"old":"/api/practitioners","type":0,"val":"api","end":""},{"old":"/api/practitioners","type":0,"val":"practitioners","end":""}],
    types: placeholder as Registry['practitioners.index']['types'],
  },
  'practitioners.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/practitioners/:id',
    tokens: [{"old":"/api/practitioners/:id","type":0,"val":"api","end":""},{"old":"/api/practitioners/:id","type":0,"val":"practitioners","end":""},{"old":"/api/practitioners/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['practitioners.show']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
