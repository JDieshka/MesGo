# 🔧 Исправление ошибки "cannot scan NULL into *string"

## Проблема

При создании личного чата возникала ошибка:
```
Failed to create private chat: can't scan into dest[2]: cannot scan NULL into *string
```

**Причина:** Поля `name` и `avatar` в таблице `chats` имели значение NULL для личных чатов, а код пытался загрузить их в `string`.

## Что исправлено

### 1. Установка значений по умолчанию при создании чата
**Файл:** `server/chat_repository.go`

Изменён запрос `INSERT` в функции `CreatePrivateChat`:
```sql
-- Было:
INSERT INTO chats (type, created_by)
VALUES ('private', $1)

-- Стало:
INSERT INTO chats (type, name, avatar, created_by)
VALUES ('private', 'Private Chat', '💬', $1)
```

### 2. Миграция для исправления существующих записей
**Файл:** `server/migrations/002_fix_null_values.sql`

Создана новая миграция, которая:
- Обновляет существующие записи с NULL значениями
- Устанавливает значения по умолчанию для колонок `name` и `avatar`

### 3. Автоматическое применение всех миграций
**Файл:** `server/db.go`

Обновлена функция `RunMigrations()` для применения всех миграций из папки `migrations/` в порядке возрастания номеров.

## Как применить исправления

### Шаг 1: Перезапустите сервер

```bash
# Остановите текущий сервер
docker-compose down

# Или если запускали локально, остановите процесс (Ctrl+C)

# Перезапустите
docker-compose up -d --build

# Или локально:
cd server
go run .
```

При запуске вы увидите в логах:
```
✅ Migration applied: migrations/001_initial_schema.sql
✅ Migration applied: migrations/002_fix_null_values.sql
✅ All database migrations completed
```

### Шаг 2: Протестируйте создание личного чата

1. Откройте приложение: `http://localhost:8080`
2. Войдите в систему
3. Нажмите кнопку **"+"** в левом верхнем углу
4. Выберите пользователя
5. Нажмите **"Начать чат"**

**Ожидаемый результат:** Чат создаётся успешно без ошибок!

### Шаг 3: Проверьте существующие чаты

Если у вас уже были созданы личные чаты (которые не работали), они теперь должны:
- Имя: "Private Chat"
- Аватар: 💬
- Функционировать корректно

## Технические детали

### Структура таблицы chats (после миграции)

```sql
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('private', 'group')),
    name VARCHAR(100) DEFAULT 'Private Chat',  -- ← добавлено DEFAULT
    avatar VARCHAR(10) DEFAULT '💬',             -- ← добавлено DEFAULT
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Почему это работает

1. **Новые чаты:** При создании личного чата явно указываются значения `'Private Chat'` и `'💬'`
2. **Существующие чаты:** Миграция обновляет все записи с NULL значениями
3. **Будущие чаты:** DEFAULT значения гарантируют, что NULL никогда не будет вставлен

## Проверка в базе данных

Вы можете проверить, что все записи теперь имеют корректные значения:

```bash
# Подключитесь к PostgreSQL
docker exec -it gotalk-postgres psql -U gotalk -d gotalk

# Проверьте записи
SELECT id, type, name, avatar FROM chats;

# Должны увидеть что-то вроде:
#  id  |  type  |     name      | avatar
# -----+--------+---------------+--------
#  ... | private| Private Chat  | 💬
#  ... | group  | Команда       | 🚀
```

## Если ошибка повторяется

Если после применения исправлений ошибка всё ещё возникает:

1. **Проверьте логи сервера:**
```bash
docker-compose logs server
```

2. **Убедитесь, что миграция применилась:**
```bash
docker exec -it gotalk-postgres psql -U gotalk -d gotalk -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'chats' AND column_name IN ('name', 'avatar');"
```

Должны увидеть:
```
 column_name |   column_default
-------------+---------------------
 name        | 'Private Chat'::character varying
 avatar      | '💬'::character varying
```

3. **Очистите базу данных (крайний случай):**
```bash
docker-compose down -v  # Удалит все данные!
docker-compose up -d
```

## ✅ Готово!

Теперь личные чаты создаются без ошибок, а все существующие чаты имеют корректные значения полей `name` и `avatar`.
