import {
  buildDocumentSnapshot,
  DOC_TYPE_TO_ENUM,
  type DocType,
} from '../../utils/documentData'

interface RequestBody {
  type: DocType
  objectId: string
  clientId?: string
  number: string
  date: string
  vatPercent?: number | null
  notes?: string
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth
  if (!auth) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const body = await readBody<RequestBody>(event)

  if (!body.type || !body.objectId || !body.number || !body.date) {
    throw createError({ statusCode: 400, statusMessage: 'Вкажіть тип, обʼєкт, номер та дату' })
  }
  if (!DOC_TYPE_TO_ENUM[body.type]) {
    throw createError({ statusCode: 400, statusMessage: 'Невідомий тип документа' })
  }

  const [object, globalSettings] = await Promise.all([
    prisma.constructionObject.findUnique({ where: { id: body.objectId }, include: { client: true } }),
    prisma.settings.findUnique({ where: { id: 'global' } }),
  ])
  if (!object) throw createError({ statusCode: 404, statusMessage: 'Обʼєкт не знайдено' })

  let client: any = null
  if (body.clientId) {
    client = await prisma.client.findUnique({ where: { id: body.clientId } })
    if (!client) throw createError({ statusCode: 404, statusMessage: 'Клієнта не знайдено' })
  } else if (object.client) {
    client = object.client
  }

  if (body.type === 'contract' && !client) {
    throw createError({ statusCode: 400, statusMessage: 'Для договору потрібен клієнт (замовник)' })
  }

  const data = await buildDocumentSnapshot({
    type: body.type,
    object,
    client,
    globalSettings,
    vatPercent: body.vatPercent ?? null,
  })

  const document = await prisma.document.create({
    data: {
      type: DOC_TYPE_TO_ENUM[body.type],
      number: body.number,
      date: new Date(body.date),
      objectId: object.id,
      clientId: client?.id ?? null,
      data: data as unknown as object,
      notes: body.notes || null,
      createdById: auth.userId,
    },
  })

  return { document }
})
