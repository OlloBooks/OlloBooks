import posthog from 'posthog-js'

const posthogKey = import.meta.env.VITE_POSTHOG_KEY
const posthogHost = import.meta.env.VITE_POSTHOG_HOST

export const isPostHogConfigured = Boolean(posthogKey && posthogHost)

if (isPostHogConfigured) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_exceptions: true,
    defaults: '2026-08-30',
    logs: {
      serviceName: 'ollobooks-web',
      environment: import.meta.env.MODE,
    },
  })
} else if (import.meta.env.DEV) {
  const missingVariable = posthogKey ? 'VITE_POSTHOG_HOST' : 'VITE_POSTHOG_KEY'
  console.error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  )
}

type LogAttributes = Record<string, string | number | boolean>

export const posthogLog = {
  info(message: string, attributes: LogAttributes) {
    if (isPostHogConfigured) posthog.logger.info(message, attributes)
  },
  error(message: string, attributes: LogAttributes) {
    if (isPostHogConfigured) posthog.logger.error(message, attributes)
  },
}

export default posthog
