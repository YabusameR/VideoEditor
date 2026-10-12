import { createFileRoute, redirect } from '@tanstack/react-router'

/** No landing page: the app opens straight on the project list. */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/projects', replace: true })
  },
})
