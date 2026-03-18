import { verifyJwt } from '~/server/utils/jwt'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  if (!url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/api/auth/login')) return
  if (url.pathname.startsWith('/api/auth/logout')) return

  const token = getCookie(event, 'token')
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const payload = await verifyJwt(token)
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid token' })
  }

  event.context.auth = payload
})
