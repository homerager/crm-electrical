import FormData from 'form-data'
import Mailgun from 'mailgun.js'

function getMailgunClient() {
  const config = useRuntimeConfig()
  if (!config.mailgunApiKey || !config.mailgunDomain) return null
  const mg = new Mailgun(FormData)
  return mg.client({
    username: 'api',
    key: config.mailgunApiKey,
    url: config.mailgunUrl || 'https://api.eu.mailgun.net',
  })
}

export async function sendEmail(to: string | string[], subject: string, html: string): Promise<void> {
  const config = useRuntimeConfig()
  if (!config.mailgunApiKey || !config.mailgunDomain) return

  const client = getMailgunClient()
  if (!client) return

  const recipients = Array.isArray(to) ? to.join(',') : to

  try {
    await client.messages.create(config.mailgunDomain, {
      from: config.mailgunFrom || `CRM <noreply@${config.mailgunDomain}>`,
      to: recipients,
      subject,
      html,
    })
  } catch (e) {
    console.error('[Email] Failed to send:', e)
  }
}

// ── HTML layout helper ─────────────────────────────────────────────────────────

function emailLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1565c0;padding:24px 32px;">
              <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.5px;">CRM</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f4f6f9;border-top:1px solid #e0e0e0;">
              <p style="margin:0;font-size:12px;color:#9e9e9e;text-align:center;">
                Це автоматичне повідомлення системи CRM. Не відповідайте на нього.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Низький', MEDIUM: 'Середній', HIGH: 'Високий', URGENT: 'Терміново',
}
const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#4caf50', MEDIUM: '#ff9800', HIGH: '#f44336', URGENT: '#b71c1c',
}
const STATUS_LABELS: Record<string, string> = {
  TODO: 'До виконання', IN_PROGRESS: 'В роботі', REVIEW: 'На перевірці',
  DONE: 'Виконано', CANCELLED: 'Скасовано',
}

function taskMetaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#757575;font-size:14px;width:130px;">${label}:</td>
    <td style="padding:6px 0;color:#212121;font-size:14px;">${value}</td>
  </tr>`
}

function ctaButton(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#1565c0;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${text}</a>`
}

// ── Email builders ─────────────────────────────────────────────────────────────

export function buildTaskAssignedEmail(task: {
  id: string
  title: string
  priority: string
  status: string
  dueDate?: Date | string | null
  description?: string | null
  project?: { name: string } | null
  createdBy?: { name: string } | null
}, appUrl: string): { subject: string; html: string } {
  const subject = `Вам призначено завдання: ${task.title}`
  const taskUrl = `${appUrl.replace(/\/$/, '')}/tasks/${task.id}`
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk-UA') : 'не вказано'
  const priorityColor = PRIORITY_COLORS[task.priority] ?? '#9e9e9e'
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? task.priority

  const descHtml = task.description
    ? `<p style="margin:16px 0 0;color:#424242;font-size:14px;line-height:1.6;">${task.description.substring(0, 400)}</p>`
    : ''

  const bodyHtml = `
    <h2 style="margin:0 0 8px;color:#1565c0;font-size:18px;">📋 Вам призначено нове завдання</h2>
    <h3 style="margin:0 0 24px;color:#212121;font-size:22px;font-weight:700;">${task.title}</h3>

    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${taskMetaRow('Пріоритет', `<span style="color:${priorityColor};font-weight:600;">${priorityLabel}</span>`)}
      ${taskMetaRow('Статус', STATUS_LABELS[task.status] ?? task.status)}
      ${taskMetaRow('Дедлайн', due)}
      ${task.project ? taskMetaRow('Проєкт', task.project.name) : ''}
      ${task.createdBy ? taskMetaRow('Створив(ла)', task.createdBy.name) : ''}
    </table>

    ${descHtml}
    ${ctaButton('Відкрити завдання', taskUrl)}
  `

  return { subject, html: emailLayout(subject, bodyHtml) }
}

export function buildTaskUpdatedEmail(task: {
  id: string
  title: string
}, changedBy: string, changes: Record<string, string>, appUrl: string): { subject: string; html: string } {
  const subject = `Завдання оновлено: ${task.title}`
  const taskUrl = `${appUrl.replace(/\/$/, '')}/tasks/${task.id}`

  const changesHtml = Object.entries(changes)
    .map(([key, val]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#757575;font-size:14px;width:130px;">${key}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#212121;font-size:14px;">${val}</td>
      </tr>`)
    .join('')

  const bodyHtml = `
    <h2 style="margin:0 0 8px;color:#e65100;font-size:18px;">🔄 Завдання оновлено</h2>
    <h3 style="margin:0 0 24px;color:#212121;font-size:20px;font-weight:700;">${task.title}</h3>

    <p style="margin:0 0 8px;color:#424242;font-size:14px;">
      <strong>${changedBy}</strong> вніс(ла) наступні зміни:
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e0e0e0;border-radius:6px;border-collapse:collapse;">
      ${changesHtml}
    </table>

    ${ctaButton('Відкрити завдання', taskUrl)}
  `

  return { subject, html: emailLayout(subject, bodyHtml) }
}

export function buildTaskCommentEmail(task: {
  id: string
  title: string
}, commenterName: string, appUrl: string): { subject: string; html: string } {
  const subject = `Новий коментар до завдання: ${task.title}`
  const taskUrl = `${appUrl.replace(/\/$/, '')}/tasks/${task.id}`

  const bodyHtml = `
    <h2 style="margin:0 0 8px;color:#2e7d32;font-size:18px;">💬 Новий коментар</h2>
    <h3 style="margin:0 0 24px;color:#212121;font-size:20px;font-weight:700;">${task.title}</h3>

    <p style="margin:0;color:#424242;font-size:15px;line-height:1.6;">
      <strong>${commenterName}</strong> залишив(ла) коментар до вашого завдання.
    </p>

    ${ctaButton('Переглянути коментар', taskUrl)}
  `

  return { subject, html: emailLayout(subject, bodyHtml) }
}

export function buildTaskReassignedEmail(task: {
  id: string
  title: string
  priority: string
  dueDate?: Date | string | null
}, assignedByName: string, appUrl: string): { subject: string; html: string } {
  const subject = `Вам перепризначено завдання: ${task.title}`
  const taskUrl = `${appUrl.replace(/\/$/, '')}/tasks/${task.id}`
  const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('uk-UA') : 'не вказано'
  const priorityColor = PRIORITY_COLORS[task.priority] ?? '#9e9e9e'
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? task.priority

  const bodyHtml = `
    <h2 style="margin:0 0 8px;color:#6a1b9a;font-size:18px;">🔁 Вам перепризначено завдання</h2>
    <h3 style="margin:0 0 24px;color:#212121;font-size:20px;font-weight:700;">${task.title}</h3>

    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${taskMetaRow('Пріоритет', `<span style="color:${priorityColor};font-weight:600;">${priorityLabel}</span>`)}
      ${taskMetaRow('Дедлайн', due)}
      ${taskMetaRow('Призначив(ла)', assignedByName)}
    </table>

    ${ctaButton('Відкрити завдання', taskUrl)}
  `

  return { subject, html: emailLayout(subject, bodyHtml) }
}
