# 🔧 Исправление проблемы с выбором чатов

## Проблема
При создании нескольких чатов, при клике на один из них выбираются все и открывается последний созданный.

## Что было исправлено

### 1. Уникальные ключи для React списков
**Файл:** `src/components/Sidebar.tsx`

**Изменения:**
- Добавлены уникальные ключи с префиксом типа чата:
  - Личные чаты: `key={`private-${chat.id}`}`
  - Групповые чаты: `key={`group-${chat.id}`}`
- Добавлен `e.stopPropagation()` для предотвращения всплытия событий

### 2. Защита от перезаписи активного чата
**Файл:** `src/store/AppContext.tsx`

**Изменения:**
- В функции `refreshChats()` добавлена проверка:
  ```typescript
  const currentActiveId = stateRef.current.activeChatId;
  if (chats.length > 0 && !currentActiveId) {
    dispatch({ type: 'SET_ACTIVE_CHAT', payload: chats[0].id });
  }
  ```
- Теперь `refreshChats()` НЕ перезаписывает выбранный пользователем чат

### 3. Добавлено логирование для отладки
**Файлы:** 
- `src/store/AppContext.tsx` - логирование в reducer
- `src/components/Sidebar.tsx` - логирование при клике
- `src/components/ChatWindow.tsx` - логирование активного чата
- `src/components/NewChatModal.tsx` - логирование создания чата

## Как протестировать

### Шаг 1: Откройте консоль браузера
Нажмите F12 и перейдите на вкладку "Console"

### Шаг 2: Создайте несколько чатов
1. Нажмите "+" → выберите пользователя → "Начать чат"
2. В консоли вы должны увидеть:
   ```
   [NewChatModal] Private chat created: <uuid>
   [NewChatModal] Refreshing chats...
   [NewChatModal] Chats refreshed, setting active chat to: <uuid>
   [Reducer] SET_ACTIVE_CHAT: <uuid> Previous: null
   [Reducer] SET_CHATS: [{id: "<uuid>", name: "..."}]
   ```

### Шаг 3: Создайте второй чат
1. Нажмите "+" → выберите другого пользователя → "Начать чат"
2. В консоли:
   ```
   [NewChatModal] Private chat created: <uuid2>
   [Reducer] SET_ACTIVE_CHAT: <uuid2> Previous: <uuid1>
   [Reducer] SET_CHATS: [{id: "<uuid2>", name: "..."}, {id: "<uuid1>", name: "..."}]
   ```

### Шаг 4: Кликните на первый чат
1. Кликните на первый чат в списке
2. В консоли:
   ```
   [Sidebar] Clicked chat: <uuid1> <name>
   [Reducer] SET_ACTIVE_CHAT: <uuid1> Previous: <uuid2>
   [ChatWindow] Active chat ID: <uuid1>
   [ChatWindow] Active chat: <name>
   [ChatWindow] All chats: [{id: "<uuid1>", name: "..."}, {id: "<uuid2>", name: "..."}]
   ```

### Шаг 5: Проверьте результат
✅ Должен открыться первый чат (не второй!)  
✅ В списке должен быть выделен только первый чат  
✅ В консоли все ID должны быть разными

## Возможные проблемы и решения

### Проблема 1: Все чаты имеют одинаковый ID
**Симптом:** В консоли видно, что все чаты имеют одинаковый UUID

**Решение:** Проблема на стороне сервера. Проверьте:
```bash
# Подключитесь к PostgreSQL
docker exec -it gotalk-postgres psql -U gotalk -d gotalk

# Проверьте чаты
SELECT id, type, name FROM chats;
```

Все ID должны быть уникальными UUID.

### Проблема 2: Active chat не меняется при клике
**Симптом:** В консоли видно `[Sidebar] Clicked chat: <uuid>`, но `[Reducer] SET_ACTIVE_CHAT` не вызывается

**Решение:** Проверьте, что onClick правильно привязан:
```typescript
onClick={(e) => {
  e.stopPropagation();
  dispatch({ type: 'SET_ACTIVE_CHAT', payload: chat.id });
}}
```

### Проблема 3: После refreshChats() сбрасывается активный чат
**Симптом:** После создания чата активный чат сбрасывается на первый

**Решение:** Убедитесь, что в `refreshChats()` есть проверка:
```typescript
const currentActiveId = stateRef.current.activeChatId;
if (chats.length > 0 && !currentActiveId) {
  dispatch({ type: 'SET_ACTIVE_CHAT', payload: chats[0].id });
}
```

## Проверка в базе данных

```bash
# Подключитесь к PostgreSQL
docker exec -it gotalk-postgres psql -U gotalk -d gotalk

# Проверьте, что все чаты имеют уникальные ID
SELECT id, type, name, created_at 
FROM chats 
ORDER BY created_at DESC;

# Проверьте, что нет дубликатов
SELECT id, COUNT(*) 
FROM chats 
GROUP BY id 
HAVING COUNT(*) > 1;
```

Должен вернуть 0 строк (нет дубликатов).

## Что должно работать после исправления

✅ Каждый чат имеет уникальный UUID  
✅ При клике на чат выделяется только он  
✅ При создании нового чата он открывается  
✅ При переключении между чатами открывается правильный чат  
✅ После обновления страницы активный чат сохраняется  
✅ В консоли видны все действия с чатами

## Логирование

Для отладки добавлено логирование в:
- `[Sidebar]` - клики по чатам
- `[ChatWindow]` - активный чат и список всех чатов
- `[NewChatModal]` - создание чатов
- `[Reducer]` - все изменения state

Если проблема сохраняется, пришлите вывод консоли при:
1. Создании первого чата
2. Создании второго чата
3. Клике на первый чат
4. Клике на второй чат
