# ЕлектроМонтаж CRM

CRM система обліку матеріалів електромонтажної компанії.

## Стек

- **Nuxt 4** + Vue 3 + TypeScript + TSX
- **Vuetify 3** (Material Design UI)
- **Prisma** + PostgreSQL
- **JWT** авторизація (httpOnly cookies)

## Налаштування

### 1. Встановлення залежностей

```bash
npm install
```

### 2. База даних

Переконайтесь що PostgreSQL запущено. Створіть базу даних:

```sql
CREATE DATABASE crm_electrical_db;
```

### 3. Змінні середовища

Скопіюйте `.env.example` в `.env` та заповніть:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/crm_electrical_db"
JWT_SECRET="your-super-secret-key-min-32-chars"
```

### 4. Міграція бази даних

```bash
npm run db:migrate
```

### 5. Seed початкових даних

```bash
npm run db:seed
```

Створяться тестові акаунти:
- **Admin**: `admin@crm.com` / `admin123`
- **Комірник**: `storekeeper@crm.com` / `store123`

### 6. Запуск

```bash
npm run dev
```

Відкрийте [http://localhost:3000](http://localhost:3000)

## Структура проєкту

```
app/
  pages/           # Всі сторінки (TSX)
  layouts/         # Layouts (TSX)
  composables/     # useAuth
  middleware/      # auth middleware
  plugins/         # Vuetify plugin
server/
  api/             # API routes
  middleware/      # JWT перевірка
  utils/           # prisma.ts, jwt.ts
prisma/
  schema.prisma    # DB схема
  seed.ts          # Початкові дані
```

## Ролі

| Функція | ADMIN | STOREKEEPER |
|---------|-------|-------------|
| Склади (CRUD) | ✓ | Перегляд |
| Обʼєкти (CRUD) | ✓ | Перегляд |
| Товари (CRUD) | ✓ | Перегляд |
| Контрагенти (CRUD) | ✓ | Перегляд |
| Накладні (CRUD) | ✓ | ✓ |
| Переміщення (CRUD) | ✓ | ✓ |
| Репорти | ✓ | ✓ |
| Користувачі | ✓ | — |
