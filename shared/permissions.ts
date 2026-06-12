/**
 * Єдиний реєстр дозволів (permissions) для всього застосунку.
 *
 * Модель доступу: RBAC з індивідуальними overrides.
 *   ефективні_права(user) = ДЕФОЛТИ_РОЛІ[role] ± індивідуальні overrides
 *
 * Дозвіл — рядок виду `<module>.<action>`, напр. `payments.edit`.
 * Цей файл спільний для сервера (server/**) і клієнта (app/**),
 * тому містить лише чисті дані та функції без залежностей від рантайму.
 */

export type Role = 'ADMIN' | 'MANAGER' | 'STOREKEEPER' | 'USER' | 'EMPLOYEE'

/** Дії (CRUD + кілька спеціальних). Ключ → людська назва. */
export const ACTION_LABELS: Record<string, string> = {
  view: 'Перегляд',
  create: 'Створення',
  edit: 'Редагування',
  delete: 'Видалення',
  manage: 'Керування',
  import: 'Імпорт',
  dashboard: 'Дашборд',
  salary: 'Зарплата',
}

export interface PermissionModule {
  /** Технічний ключ модуля (префікс дозволу). */
  key: string
  /** Назва для UI. */
  label: string
  /** Дозволені дії у цьому модулі. */
  actions: string[]
}

/**
 * Реєстр модулів і доступних дій.
 * Додати нову можливість = додати рядок/дію тут (єдине джерело правди).
 */
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'payments', label: 'Фінанси (оплати)', actions: ['view', 'create', 'edit', 'delete', 'dashboard'] },
  { key: 'paymentSchedules', label: 'Графік платежів', actions: ['view', 'manage'] },
  { key: 'objects', label: "Об'єкти", actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'projects', label: 'Проєкти', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { key: 'tasks', label: 'Задачі', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { key: 'clients', label: 'Клієнти', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'contractors', label: 'Підрядники', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'proposals', label: 'Комерційні пропозиції', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'invoices', label: 'Накладні', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'purchaseRequests', label: 'Заявки на закупівлю', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'products', label: 'Товари', actions: ['view', 'create', 'edit', 'delete', 'import'] },
  { key: 'supplierPrices', label: 'Прайси постачальників', actions: ['view', 'manage', 'import'] },
  { key: 'warehouses', label: 'Склади', actions: ['view', 'manage'] },
  { key: 'inventory', label: 'Інвентаризація', actions: ['view', 'manage'] },
  { key: 'equipment', label: 'Обладнання', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'schedules', label: 'Графік роботи', actions: ['view', 'manage'] },
  { key: 'photoReports', label: 'Фотозвіти', actions: ['view', 'manage'] },
  { key: 'electricalInstallationWorks', label: 'Монтажні роботи', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'documents', label: 'Документи', actions: ['view', 'manage'] },
  { key: 'reports', label: 'Звіти', actions: ['view', 'salary'] },
  { key: 'users', label: 'Користувачі', actions: ['view', 'manage'] },
  { key: 'settings', label: 'Налаштування', actions: ['manage'] },
  { key: 'auditLog', label: 'Журнал дій', actions: ['view'] },
]

/** Повний пласкою список усіх дозволів, напр. ['payments.view', ...]. */
export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a}`),
)

const ALL = new Set(ALL_PERMISSIONS)

/** Зручний помічник для опису дефолтів ролі: усі дії перелічених модулів. */
function modules(...keys: string[]): string[] {
  return ALL_PERMISSIONS.filter((p) => keys.includes(p.split('.')[0] ?? ''))
}

/** Лише перелічені дії з модуля, напр. only('tasks', 'view', 'create'). */
function only(moduleKey: string, ...actions: string[]): string[] {
  return actions.map((a) => `${moduleKey}.${a}`).filter((p) => ALL.has(p))
}

/**
 * Дозволи, які за замовчуванням має лише ADMIN (адмін-розділи + чутливі звіти).
 * Їх не отримує жодна інша роль автоматично, але адмін може видати точково через матрицю прав.
 */
export const ADMIN_ONLY_PERMISSIONS: string[] = [
  'users.view',
  'users.manage',
  'settings.manage',
  'auditLog.view',
  'reports.salary',
  'payments.dashboard',
]

/**
 * Дефолтні дозволи для кожної ролі.
 * '*' = всі дозволи (повний доступ).
 * Це лише ДЕФОЛТИ — їх можна перевизначати індивідуально по користувачу.
 */
export const ROLE_DEFAULTS: Record<Role, string[] | '*'> = {
  // Повний доступ
  ADMIN: '*',

  // Як адмін, але без адмін-розділів (користувачі, налаштування, журнал, зарплата, фін. дашборд)
  MANAGER: ALL_PERMISSIONS.filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p)),

  // Комірник: склад, товари, інвентаризація, обладнання + перегляд решти
  STOREKEEPER: [
    ...modules('products', 'supplierPrices', 'warehouses', 'inventory', 'equipment'),
    ...only('objects', 'view'),
    ...only('tasks', 'view'),
    ...only('invoices', 'view', 'create', 'edit'),
    ...only('reports', 'view'),
  ],

  // Базовий користувач: задачі, перегляд об'єктів/товарів
  USER: [
    ...only('tasks', 'view', 'create', 'edit'),
    ...only('objects', 'view'),
    ...only('products', 'view'),
    ...only('schedules', 'view'),
    ...only('photoReports', 'view'),
  ],

  // Працівник: проєкти/об'єкти (перегляд), задачі, власний розклад, фотозвіти
  // (доп. scope-обмеження «лише своє» — в middleware employee-scope/employee-api)
  EMPLOYEE: [
    ...only('projects', 'view'),
    ...only('objects', 'view'),
    ...only('tasks', 'view'),
    ...only('schedules', 'view'),
    ...only('photoReports', 'view'),
  ],
}

/** Дефолтний набір дозволів для ролі у вигляді масиву ключів. */
export function defaultPermissionsForRole(role: Role): string[] {
  const def = ROLE_DEFAULTS[role]
  return def === '*' ? [...ALL_PERMISSIONS] : def
}

/** Тип збереженого override: { 'payments.edit': true, 'users.manage': false }. */
export type PermissionOverrides = Record<string, boolean>

/**
 * Обчислює ефективний набір дозволів користувача:
 * дефолти ролі, поверх яких накладаються індивідуальні overrides.
 */
export function effectivePermissions(
  role: Role,
  overrides?: PermissionOverrides | null,
): Set<string> {
  const set = new Set(defaultPermissionsForRole(role))
  if (overrides) {
    for (const [perm, allowed] of Object.entries(overrides)) {
      if (!ALL.has(perm)) {
        continue // ігноруємо застарілі/невідомі ключі
      }

      if (allowed) {
        set.add(perm)
      } else {
        set.delete(perm)
      }
    }
  }
  return set
}

/** Перевірка одного дозволу за роллю + overrides. */
export function hasPermission(
  role: Role,
  overrides: PermissionOverrides | null | undefined,
  permission: string,
): boolean {
  return effectivePermissions(role, overrides).has(permission)
}

/** Відсіює невідомі ключі та нормалізує значення до boolean. */
export function sanitizeOverrides(input: unknown): PermissionOverrides {
  const out: PermissionOverrides = {}
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (ALL.has(k)) out[k] = Boolean(v)
    }
  }
  return out
}

/**
 * Карта «префікс маршруту → потрібний дозвіл» для захисту сторінок.
 * Збіг — за найбільш специфічним (найдовшим) префіксом, тому порядок тут не важливий.
 * Маршрути без запису (напр. '/', '/login', '/profile') доступні будь-якому авторизованому.
 */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/clients': 'clients.view',
  '/proposals': 'proposals.view',
  '/warehouses': 'warehouses.view',
  '/products': 'products.view',
  '/product-groups': 'products.view',
  '/movements': 'warehouses.view',
  '/inventory': 'inventory.view',
  '/equipment': 'equipment.view',
  '/projects': 'projects.view',
  '/objects': 'objects.view',
  '/documents': 'documents.view',
  '/tasks': 'tasks.view',
  '/tasks/salary': 'reports.salary',
  '/schedule': 'schedules.view',
  '/time-logs/manual': 'schedules.manage',
  '/finance-dashboard': 'payments.dashboard',
  '/payments': 'payments.view',
  '/payments/schedule': 'paymentSchedules.view',
  '/contractors': 'contractors.view',
  '/invoices': 'invoices.view',
  '/supplier-prices': 'supplierPrices.view',
  '/purchase-requests': 'purchaseRequests.view',
  '/reports': 'reports.view',
  '/photo-reports': 'photoReports.view',
  '/electrical-installation-works': 'electricalInstallationWorks.view',
  '/settings': 'settings.manage',
  '/users': 'users.view',
  '/job-titles': 'settings.manage',
  '/audit-log': 'auditLog.view',
}

// Префікси, відсортовані від найдовшого до найкоротшого (один раз при завантаженні модуля).
const ROUTE_PREFIXES = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)

/**
 * Повертає дозвіл, потрібний для маршруту, або null якщо сторінка відкрита всім авторизованим.
 * Зіставляє за найбільш специфічним префіксом, тож /payments/schedule → paymentSchedules.view,
 * а /payments/123 → payments.view.
 */
export function requiredPermissionForPath(path: string): string | null {
  const clean = path.split('?')[0]!.replace(/\/+$/, '') || '/'
  for (const prefix of ROUTE_PREFIXES) {
    if (clean === prefix || clean.startsWith(prefix + '/')) {
      return ROUTE_PERMISSIONS[prefix]!
    }
  }
  return null
}
