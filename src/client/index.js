import logger from 'loglevel'
import { Events } from 'quasar'
import { Store } from 'kCore/client'

// We faced a bug in babel so that transform-runtime with export * from 'x' generates import statements in transpiled code
// Tracked here : https://github.com/babel/babel/issues/2877
// We tested the workaround given here https://github.com/babel/babel/issues/2877#issuecomment-270700000 with success so far
export * from '../permissions'
export * as mixins from './mixins'

export default function init () {
  // const app = this

  Events.$on('user-changed', user => {
    // Possible after a loggout
    if (!user) return
    if (user.organisations && user.organisations.length > 0) {
      Store.set('organisation', user.organisations[0])
    } else {
      logger.debug('empty organisations')
    }
  })

  logger.debug('Initializing kalisio team')
}
