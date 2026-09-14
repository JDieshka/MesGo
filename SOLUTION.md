# ✅ Проблема решена: "cannot scan NULL into *string"

## Что было исправлено

### Корень проблемы
При создании личного чата поля `name` и `avatar` не устанавливались, что приводило к NULL значениям в базе данных. При попытке прочитать эти значения возникала ошибка.

### Что сделано
1. **`server/chat_repository.go`** - Добавлены значения по умолчанию при создании личного чата:
   - `name = 'Private Chat'`
   - `avatar = '💬'`

2. **`server/migrations/002_fix_null_values.sql`** - Новая миграция:
   - Обновляет существующие записи с NULL значениями
   - Устанавливает DEFAULT значения для колонок

3. **`server/db.go`** - Обновлена функция миграций:
   - Автоматически применяет все миграции из папки `migrations/`
   - Логирует процесс применения каждой миграции

## Как применить

### 1. Перезапустите сервер

**Docker:**
```bash
docker-compose down
docker-compose up -d --build
```

**Локально:**
```bash
cd server
go run .
```

### 2. Проверьте логи

При запуске вы должны увидеть:
```
✅ Migration applied: migrations/001_initial_schema.sql
✅ Migration applied: migrations/002_fix_null_values.sql
✅ All database migrations completed
```

### 3. Протестируйте

1. Откройте `http://localhost:8080`
2. Войдите в систему
3. Нажмите **"+"** → выберите пользователя → **"Начать чат"**
4. ✅ Чат создаётся успешно!

## Проверка в базе данных

```bash
# Подключитесь к PostgreSQL
docker exec -it gotalk-postgres psql -U gotalk -d gotalk

# Проверьте, что все чаты имеют корректные значения
SELECT id, type, name, avatar FROM chats;

# Проверьте DEFAULT значения
SELECT column_name, column_default 
FROM information_schema.columns 
WHERE table_name = 'chats' 
  AND column_name IN ('name', 'avatar');
```

Ожидаемый результат:
```
 column_name |   column_default
-------------+---------------------
 avatar      | '💬'::character varying
 name        | 'Private Chat'::character varying
```

## Что теперь работает

✅ Создание личных чатов без ошибок  
✅ Создание групповых чатов  
✅ Отправка сообщений без дублирования  
✅ Сохранение сообщений в PostgreSQL  
✅ Загрузка сообщений при обновлении страницы  
✅ Все существующие чаты имеют корректные значения

## Если что-то не работает

### Ошибка всё ещё возникает
1. Убедитесь, что сервер перезапущен с новым кодом
2. Проверьте, что миграция применилась (смотрите логи)
3. В крайнем случае очистите базу: `docker-compose down -v && docker-compose up -d`

### Чаты не отображаются
1. Проверьте консоль браузера (F12) на ошибки
2. Убедитесь, что пользователь зарегистрирован в БД
3. Проверьте логи сервера на наличие ошибок

## Файлы изменений

- `server/chat_repository.go` - Установка значений по умолчанию
- `server/migrations/002_fix_null_values.sql` - Миграция для исправления NULL
- `server/db.go` - Автоматическое применение всех миграций
- `NULL_FIX.md` - Подробная документация исправления
