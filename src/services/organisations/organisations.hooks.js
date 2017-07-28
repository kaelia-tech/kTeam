import { createOrganisationServices, removeOrganisationServices, createOrganisationAuthorisations, removeOrganisationAuthorisations } from '../../hooks'
const { authenticate } = require('feathers-authentication').hooks

module.exports = {
  before: {
    all: [ authenticate('jwt') ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [ createOrganisationServices, createOrganisationAuthorisations ],
    update: [],
    patch: [],
    remove: [ removeOrganisationAuthorisations, removeOrganisationServices ]
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
}
