/**
 * In-app back navigation.
 *
 * `navigate(-1)` and `window.history.length` are both unreliable for a Back
 * button: history.length counts entries from before the app was even opened, and
 * going back one entry can land on whatever page linked here — an external site,
 * or a login page the user has since passed through. Neither tells us whether
 * the previous entry is a valid in-app destination.
 *
 * So we keep our own trail of in-app routes actually visited in this session and
 * navigate to the last one explicitly. When there is no recorded previous route,
 * callers get their declared fallback instead (for Studio pages, the Creator
 * Dashboard). The user therefore always lands somewhere valid and never leaves
 * the app unexpectedly.
 */
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Routes that must never be a Back target — passing through them is transient. */
const NON_RETURNABLE = [
  '/login',
  '/register',
  '/admin/login',
  '/forgot-password',
]

/** Module-level trail, newest last. Survives route changes, resets on reload. */
const trail = []
const MAX_TRAIL = 20

function isReturnable(path) {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')            // protocol-relative URL, i.e. off-site
    && !NON_RETURNABLE.some(p => path === p || path.startsWith(`${p}/`))
}

/** Record a visited in-app route. Called by <InAppHistoryTracker/>. */
export function recordVisit(path) {
  if (!isReturnable(path)) return
  if (trail[trail.length - 1] === path) return   // ignore repeats/replaces
  trail.push(path)
  if (trail.length > MAX_TRAIL) trail.shift()
}

/**
 * The most recent recorded route that is not `currentPath` and is not inside
 * `excludePrefix` (used so Back from the Studio editor skips other Studio
 * routes when asked to leave the Studio altogether).
 */
export function previousInAppRoute(currentPath, excludePrefix) {
  for (let i = trail.length - 1; i >= 0; i -= 1) {
    const candidate = trail[i]
    if (candidate === currentPath) continue
    if (excludePrefix && candidate.startsWith(excludePrefix)) continue
    return candidate
  }
  return null
}

/** Visible for tests. */
export function _resetTrail() {
  trail.length = 0
}

/**
 * Returns `{ goBack, backTarget }`.
 *
 * @param {string} fallback       Where to go when no valid previous route exists.
 * @param {object} [options]
 * @param {string} [options.excludePrefix]  Skip recorded routes under this prefix.
 * @param {() => boolean} [options.confirmLeave]
 *        Called before navigating. Return false to cancel (used for unsaved
 *        changes and in-progress exports).
 */
export function useInAppBack(fallback, options = {}) {
  const { excludePrefix, confirmLeave } = options
  const navigate = useNavigate()
  const location = useLocation()

  const backTarget = previousInAppRoute(location.pathname, excludePrefix) || fallback

  const goBack = useCallback(() => {
    if (confirmLeave && confirmLeave() === false) return
    navigate(backTarget)
  }, [navigate, backTarget, confirmLeave])

  return { goBack, backTarget }
}
