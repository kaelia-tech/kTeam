import _ from 'lodash'
import makeDebug from 'debug'
import { Forbidden } from '@feathersjs/errors'
import { hooks } from '@kalisio/kdk-core'
import { permissions } from '@kalisio/kdk-core/common'

const debug = makeDebug('kalisio:kTeam:authorisations:hooks')

export function preventRemovingLastOwner (resourceScope) {
  return async function (hook) {
    // By pass check ?
    if (hook.params.force) return hook
    const params = hook.params
    const data = hook.data || {}
    const query = params.query || {}
    const scope = data.scope || query.scope
    const grantedPermissions = data.permissions || query.permissions
    const grantedRole = (grantedPermissions ? permissions.Roles[grantedPermissions] : undefined)
    const resource = hook.params.resource
    const subjects = hook.params.subjects
    const subjectService = hook.params.subjectsService
    // On create check if we try to downgrade permissions otherwise let pass through
    if (!_.isUndefined(grantedRole) && (grantedRole === permissions.Roles.owner)) return hook

    if ((scope === resourceScope) && resource && resource._id) {
      // Count existing owners
      const owners = await permissions.countSubjectsForResource(subjectService, resourceScope, resource._id, permissions.Roles.owner)
      // Now count owners we change/remove permissions on
      const removedOwners = subjects.reduce((count, subject) => {
        const resources = _.get(subject, resourceScope, [])
        const ownedResource = _.find(resources, { _id: resource._id, permissions: permissions.RoleNames[permissions.Roles.owner] })
        return (ownedResource ? count + 1 : count)
      }, 0)
      // If none remains stop
      if (removedOwners >= owners.total) {
        debug('Cannot remove the last owner of resource ', resource)
        const resourceName = resource.name ? resource.name : resource._id.toString()
        throw new Forbidden('You are not allowed to remove the last owner of resource ' + resourceName, {
          translation: {
            key: 'CANNOT_REMOVE_LAST_OWNER',
            params: { resource: resourceName }
          }
        })
      }
    }
    return hook
  }
}

export function removeOrganisationGroupsAuthorisations (hook) {
  const app = hook.app
  const authorisationService = app.getService('authorisations')
  const org = hook.params.resource
  const user = hook.params.user
  // Unset membership for the all org groups
  const orgGroupService = app.getService('groups', org)
  return orgGroupService.find({ paginate: false })
    .then(groups => {
      return Promise.all(groups.map(group => {
      // Unset membership on group for the all org users
        return authorisationService.remove(group._id.toString(), {
          query: {
            scope: 'groups'
          },
          user,
          force: hook.params.force,
          // Because we already have resource set it as objects to avoid populating
          // Moreover used as an after hook the resource might not already exist anymore
          subjects: hook.params.subjects,
          subjectsService: hook.params.subjectsService,
          resource: group,
          resourcesService: orgGroupService
        })
      }))
    })
    .then(groups => {
      debug('Authorisations unset on groups for organisation ' + org._id)
      return hook
    })
}

export async function removeOrganisationTagsAuthorisations (hook) {
  const app = hook.app
  const org = hook.params.resource
  const subjectService = hook.params.subjectsService
  const orgTagsService = app.getService('tags', org)
  const subjects = hook.params.subjects || []
  if (subjects.length === 0) return hook
  // Retrieve org tags
  const orgTags = await orgTagsService.find({ paginate: false })
  const promises = []
  subjects.forEach(subject => {
    const tags = subject.tags || []
    // Find tags from org
    const fromOrg = _.intersectionWith(tags, orgTags, hooks.isTagEqual)
    // Clear removed tags
    const notFromOrg = _.differenceWith(tags, orgTags, hooks.isTagEqual)
    // Update subject if required
    if (fromOrg.length > 0) {
      promises.push(subjectService.patch(subject._id.toString(), { tags: notFromOrg, devices: subject.devices }))
    }
  })
  // Perform subject updates in parallel
  await Promise.all(promises)
  debug(`Tags unset on ${promises.length} subjects for organisation ` + org._id)
  return hook
}
