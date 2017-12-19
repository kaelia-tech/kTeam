import _ from 'lodash'
import { Ability, AbilityBuilder, toMongoQuery } from 'casl'

// Define some alias to simplify ability definitions
Ability.addAlias('update', 'patch')
Ability.addAlias('read', ['get', 'find'])
Ability.addAlias('remove', 'delete')
Ability.addAlias('all', ['read', 'create', 'update', 'remove'])

export const Roles = {
  member: 0,
  manager: 1,
  owner: 2
}

// Hooks that can be added to customize abilities computation
let hooks = []

// Get the unique global symbol to store resource type / context on a resource object
export const RESOURCE_TYPE = 'type'
export const RESOURCE_TYPE_KEY = Symbol.for(RESOURCE_TYPE)

export function defineResourceRules (subject, resource, resourceService, can) {
  const role = Roles[resource.permissions]

  if (role >= Roles.member) {
    can('read', resourceService, { _id: resource._id })
  }
  if (role >= Roles.manager) {
    can('update', resourceService, { _id: resource._id })
    can(['create', 'remove'], 'authorisations', { resource: resource._id })
  }
  if (role >= Roles.owner) {
    can('remove', resourceService, { _id: resource._id })
  }
}

// Hook computing default abilities for a given user
export function defineUserAbilities (subject, can, cannot) {
  // Register
  can('service', 'users')
  can('create', 'users')

  if (subject) {
    // Read user profiles for authorizing
    can('read', 'users')
    // Update user profile and destroy it
    can(['update', 'remove'], 'users', { _id: subject._id })
  }
}

// Hook computing organisation abilities for a given user
export function defineOrganisationAbilities (subject, can, cannot) {
  if (subject) {
    // Create new organisations
    can('service', 'organisations')
    can('create', 'organisations')
    can('service', 'authorisations')

    if (subject.organisations) {
      subject.organisations.forEach(organisation => {
        // Generic rules for resources
        defineResourceRules(subject, organisation, 'organisations', can)
        // Specific rules for organisations
        const role = Roles[organisation.permissions]
        if (role >= Roles.member) {
          // The unique identifier of a service is its path not its name.
          // Indeed we have for instance a 'groups' service in each organisation.
          can('service', organisation._id.toString() + '/members')
          can(['read', 'update'], 'members', { context: organisation._id })
        }
        if (role >= Roles.manager) {
          // The unique identifier of a service is its path not its name.
          // Indeed we have for instance a 'groups' service in each organisation.
          can('service', organisation._id.toString() + '/groups')
          can('create', 'groups', { context: organisation._id })
        }
      })
    }
  }
}

// Hook computing group abilities for a given user
export function defineGroupAbilities (subject, can, cannot) {
  if (subject) {
    if (subject.groups) {
      subject.groups.forEach(group => {
        // Generic rules for resources
        defineResourceRules(subject, group, 'groups', can)
        // No specific rules for groups
      })
    }
  }
}

// Compute abilities for a given user
export function defineAbilities (subject) {
  const { rules, can, cannot } = AbilityBuilder.extract()

  // Run registered hooks
  hooks.forEach(hook => hook(subject, can, cannot))

  // CASL cannot infer the object type from the object itself so we need
  // to tell it how he can find the object type, i.e. service name.
  return new Ability(rules, { subjectName: resource => {
    if (!resource || typeof resource === 'string') {
      return resource
    }
    return resource[RESOURCE_TYPE_KEY]
  }})
}

defineAbilities.registerHook = function (hook) {
  if (!hooks.includes(hook)) {
    hooks.push(hook)
  }
}

defineAbilities.unregisterHook = function (hook) {
  hooks = hooks.filter(registeredHook => registeredHook !== hook)
}

export function hasServiceAbilities (abilities, service) {
  if (!abilities) return false
  // The unique identifier of a service is its path not its name.
  // Indeed we have for instance a 'groups' service in each organisation
  // Take care that in client we have the service path while on server we have the actual object
  const path = typeof service === 'string' ? service : service.getPath()
  return abilities.can('service', path)
}

export function hasResourceAbilities (abilities, operation, resourceType, context, resource) {
  if (!abilities) return false
  // Create a shallow copy adding context and type
  let object = Object.assign({}, resource)
  object[RESOURCE_TYPE_KEY] = resourceType
  // Add a virtual context to take it into account
  if (context) object.context = context

  const result = abilities.can(operation, object)

  return result
}

// Utility function used to remove the virtual context from query
export function removeContext (query) {
  _.forOwn(query, (value, key) => {
    // Process current attributes or recurse
    // Take care to nested fields like 'field._id'
    if (key === 'context') {
      delete query.context
    } else if (Array.isArray(value)) {
      value.forEach(item => removeContext(item))
    } else if (typeof value === 'object') {
      removeContext(value)
    }
  })
  return query
}

export function getQueryForAbilities (abilities, operation, resourceType) {
  if (!abilities) return {}

  const rules = abilities.rulesFor(operation, resourceType)
  let query = toMongoQuery(rules) || {}
  // Remove any context to avoid taking it into account because it is not really stored on objects
  return removeContext(query)
}
