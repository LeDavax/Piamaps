/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const PractitionersController = () => import('#controllers/practitioners_controller')

router.get('/', () => {
  return { hello: 'piamaps-api' }
})

router
  .group(() => {
    router.get('practitioners', [PractitionersController, 'index'])
    router.get('practitioners/:id', [PractitionersController, 'show'])
  })
  .prefix('/api')
