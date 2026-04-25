import { verifyJwt } from '../utils/jwt'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  if (!url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/api/auth/login')) return
  if (url.pathname.startsWith('/api/auth/logout')) return
  if (url.pathname.startsWith('/api/telegram/webhook')) return

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
