import makeDebug from 'debug'
const debug = makeDebug('kalisio:kTeam:organisations:hooks')

export function createOrganisationServices (hook) {
  let app = hook.app
  let organisationService = hook.service
  let databaseService = app.getService('databases')

  // First we create the organisation DB
  return databaseService.create({
    name: hook.result._id.toString()
  }, {
    user: hook.params.user
  })
  .then(db => {
    debug('DB created for organisation ' + hook.result.name)
    // Jump from infos/stats to real DB object
    db = app.db.instance.db(hook.result._id.toString())
    organisationService.createOrganisationServices(hook.result, db)
    return hook
  })
}

export function removeOrganisationServices (hook) {
  let app = hook.app
  let organisationService = hook.service
  let databaseService = app.getService('databases')

  // Then we remove the organisation DB
  return databaseService.remove(hook.result._id.toString(), {
    user: hook.params.user
  })
  .then(db => {
    debug('DB removed for organisation ' + hook.result.name)
    organisationService.removeOrganisationServices(hook.result)
    return hook
  })
}

export function createOrganisationAuthorisations (hook) {
  let app = hook.app
  let authorisationService = app.getService('authorisations')
  let userService = app.getService('users')
  // Set membership for the owner
  return authorisationService.create({
    scope: 'organisations',
    permissions: 'owner' // Owner by default
  }, {
    user: hook.params.user,
    // Because we already have subject/resource set it as objects to avoid populating
    subjects: [hook.params.user],
    subjectsService: userService,
    resource: hook.result,
    resourcesService: hook.service
  })
  .then(authorisation => {
    debug('Organisation ownership set for user ' + hook.result._id)
    return hook
  })
}

export function removeOrganisationAuthorisations (hook) {
  let app = hook.app
  let authorisationService = app.getService('authorisations')

  // Unset membership for the all org groups
  let orgGroupService = this.app.getService('groups', hook.result)
  return orgGroupService.find({ paginate: false })
  .then(groups => {
    return Promise.all(groups.map(group => {
      // Unset membership on group for the all org users
      return authorisationService.remove(group._id.toString(), {
        query: {
          subjectsService: hook.result._id.toString() + '/users',
          scope: 'groups'
        },
        user: hook.params.user,
        // Because we already have resource set it as objects to avoid populating
        resource: group,
        resourcesService: orgGroupService
      })
    }))
  })
  .then(groups => {
    debug('Authorisations unset on groups for organisation ' + hook.result._id)
    // Unset membership for the all org users
    return authorisationService.remove(hook.result._id.toString(), {
      query: {
        subjectsService: hook.result._id.toString() + '/users',
        scope: 'organisations'
      },
      user: hook.params.user,
      // Because we already have resource set it as objects to avoid populating
      resource: hook.result,
      resourcesService: hook.service
    })
  })
  .then(authorisation => {
    debug('Authorisations unset for organisation ' + hook.result._id)
    return hook
  })
}

export function createPrivateOrganisation (hook) {
  let app = hook.app
  let organisationService = app.getService('organisations')
  // Create a private organisation for the user
  return organisationService.create({
    _id: hook.result._id, // Same ID as user, fine because in another service
    name: hook.result.profile.name // Same name as user
  }, {
    user: hook.result
  })
  .then(org => {
    debug('Private organisation created for user ' + hook.result._id)
  })
}

export function removePrivateOrganisation (hook) {
  let app = hook.app
  let organisationService = app.getService('organisations')
  // Remove the private user's organisation
  return organisationService.remove(hook.result._id.toString(), {
    user: hook.result
  })
  .then(org => {
    debug('Private organisation removed for user ' + hook.result._id)
  })
}
