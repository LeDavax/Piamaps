import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'practitioners.index': { paramsTuple?: []; params?: {} }
    'practitioners.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'practitioners.index': { paramsTuple?: []; params?: {} }
    'practitioners.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'practitioners.index': { paramsTuple?: []; params?: {} }
    'practitioners.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}