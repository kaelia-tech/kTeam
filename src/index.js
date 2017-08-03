import makeDebug from 'debug'
import services from './services'
// We faced a bug in babel so that transform-runtime with export * from 'x' generates import statements in transpiled code
// Tracked here : https://github.com/babel/babel/issues/2877
// We tested the workaround given here https://github.com/babel/babel/issues/2877#issuecomment-270700000 with success so far
export * as hooks from './hooks'
export * from './permissions'

const debug = makeDebug('kaelia:kTeam')

export default function init () {
  const app = this

  debug('Initializing kaelia team')
  app.configure(services)
}
