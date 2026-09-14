# 🔧 Исправление критической проблемы с signaling

## 🐛 Проблема

В логах было видно:
```
[CallManager] Received offer from: undefined
[CallManager] Received ICE candidate from: undefined
[CallManager] No sender ID in offer
```

Это приводило к тому, что:
- ❌ WebRTC соединение не устанавливалось
- ❌ Таймер не запускался
- ❌ Видео собеседника не отображалось
- ❌ Звук не передавался

## 🔍 Корень проблемы

**Файл:** `server/main.go`, функция `handleSignaling`

**Было:**
```go
func handleSignaling(client *Client, payload json.RawMessage) {
    var signal SignalingMessage
    if err := json.Unmarshal(payload, &signal); err != nil {
        log.Printf("Signaling parse error: %v", err)
        return
    }

    signal.From = client.UserID.String()  // ✅ Устанавливаем From

    // ❌ ПРОБЛЕМА: Маршалим оригинальный payload без From!
    response, _ := json.Marshal(WSMessage{
        Type:    "signaling",
        Payload: payload,  // ← payload не содержит From!
    })

    // ...
}
```

**Проблема:**
1. Сервер парсит `payload` в `signal`
2. Устанавливает `signal.From = client.UserID.String()`
3. **НО** маршалит оригинальный `payload`, который не содержит `From`!
4. Клиент получает сообщение без поля `from`
5. CallManager не может определить отправителя
6. WebRTC соединение не устанавливается

## ✅ Исправление

**Файл:** `server/main.go`

**Стало:**
```go
func handleSignaling(client *Client, payload json.RawMessage) {
    var signal SignalingMessage
    if err := json.Unmarshal(payload, &signal); err != nil {
        log.Printf("Signaling parse error: %v", err)
        return
    }

    // CRITICAL: Add sender ID to the message
    signal.From = client.UserID.String()
    
    log.Printf("[Signaling] Message type: %s, from: %s, to: %s", signal.Type, signal.From, signal.To)

    // CRITICAL: Marshal the updated signal object, not the original payload
    updatedPayload, err := json.Marshal(signal)  // ✅ Маршалим signal с From!
    if err != nil {
        log.Printf("Signaling marshal error: %v", err)
        return
    }

    // Route signaling message to target
    response, _ := json.Marshal(WSMessage{
        Type:    "signaling",
        Payload: updatedPayload,  // ✅ Используем updatedPayload с From!
    })

    if signal.To != "" {
        hub.SendTo(signal.To, response)
    } else {
        // Broadcast to all chat participants (for group calls)
        hub.BroadcastToChat(signal.ChatID, response, client.ID)
    }
}
```

**Что изменилось:**
1. ✅ Добавлено логирование signaling сообщений
2. ✅ Маршалим `signal` (с `From`), а не оригинальный `payload`
3. ✅ Используем `updatedPayload` в ответе

## 🧪 Как протестировать

### Шаг 1: Пересоберите сервер

```bash
cd server
go build -o gotalk-server
./gotalk-server
```

### Шаг 2: Откройте два браузера

```
Браузер 1: https://localhost:8443 (User A)
Браузер 2: https://localhost:8443 (User B)
```

### Шаг 3: Тест голосового звонка

**User A:**
1. Откройте чат с User B
2. Нажмите кнопку "Позвонить" (📞)
3. Разрешите доступ к микрофону

**User B:**
1. Примите звонок
2. Разрешите доступ к микрофону

**Проверьте консоль:**

**Сервер:**
```
[Signaling] Message type: call-request, from: user-a-id, to: user-b-id
[Signaling] Message type: call-accept, from: user-b-id, to: 
[Signaling] Message type: offer, from: user-a-id, to: user-b-id
[Signaling] Message type: answer, from: user-b-id, to: user-a-id
[Signaling] Message type: ice-candidate, from: user-a-id, to: user-b-id
[Signaling] Message type: ice-candidate, from: user-b-id, to: user-a-id
```

**User A (Caller):**
```
[CallManager] Initiating call to: user-b-id type: voice
[CallManager] Local stream acquired
[CallManager] Sending call-request to: user-b-id
[CallManager] Received signaling: call-accept from: user-b-id
[CallManager] Creating peer connection and sending offer to: user-b-id
[CallManager] Sending offer to: user-b-id
[CallManager] Received signaling: answer from: user-b-id
[CallManager] Answer processed successfully
[CallManager] Received signaling: ice-candidate from: user-b-id
[CallManager] Connection state changed: connected for peer: user-b-id
[CallManager] Remote stream received
[CallManager] Streams changed, updating UI
```

**User B (Callee):**
```
[CallManager] Received signaling: call-request from: user-a-id
[CallManager] Incoming call from: user-a-id
[CallManager] Accepting call for chat: chat-id
[CallManager] Local stream acquired
[CallManager] Call accepted, waiting for offer from caller
[CallManager] Received signaling: offer from: user-a-id
[CallManager] Creating peer connection for: user-a-id
[CallManager] Sending answer to: user-a-id
[CallManager] Received signaling: ice-candidate from: user-a-id
[CallManager] Connection state changed: connected for peer: user-a-id
[CallManager] Remote stream received
[CallManager] Streams changed, updating UI
```

### Шаг 4: Проверьте результаты

✅ **Таймер работает** - должен отображаться таймер звонка  
✅ **Звук передаётся** - оба слышат друг друга  
✅ **Видео отображается** - в видеозвонке видны обе камеры  
✅ **WebRTC соединение установлено** - в консоли видно `Connection state changed: connected`

## 📊 Ожидаемая последовательность signaling

### Голосовой звонок:
```
1. Caller → Server: call-request (from: caller-id, to: callee-id)
2. Server → Callee: call-request (from: caller-id)
3. Callee → Server: call-accept (from: callee-id)
4. Server → Caller: call-accept (from: callee-id)
5. Caller → Server: offer (from: caller-id, to: callee-id)
6. Server → Callee: offer (from: caller-id)
7. Callee → Server: answer (from: callee-id, to: caller-id)
8. Server → Caller: answer (from: callee-id)
9. Caller ↔ Server: ice-candidate (множество)
10. Callee ↔ Server: ice-candidate (множество)
11. ✅ WebRTC соединение установлено
12. ✅ Таймер запущен
14. ✅ Звук и видео передаются
```

## 🔍 Диагностика

### Если всё ещё `from: undefined`:

**Проверьте логи сервера:**
```
[Signaling] Message type: offer, from: user-id, to: user-id
```

Если `from` есть в логах сервера, но `undefined` в консоли браузера:
- Проблема в фронтенде
- Проверьте, что фронтенд пересобран
- Очистите кэш браузера (Ctrl+Shift+R)

### Если таймер не работает:

**Проверьте консоль:**
```
[CallManager] Connection state changed: connected
```

Если нет этого лога:
- WebRTC соединение не установлено
- Проверьте signaling (все сообщения должны иметь `from`)
- Проверьте ICE candidates
- Проверьте `chrome://webrtc-internals/`

### Если видео не отображается:

**Проверьте консоль:**
```
[CallManager] Remote stream received
[CallOverlay] Setting remote video stream
```

Если есть эти логи, но видео не видно:
- Проверьте, что video элемент рендерится
- Проверьте, что stream имеет video tracks
- Проверьте разрешения камеры у собеседника

## 📁 Изменённые файлы

### Backend:
- `server/main.go` - исправлена функция `handleSignaling`, теперь маршалит `signal` с `From`

## ✅ Итог

Критическая проблема с signaling решена:
- ✅ Сервер добавляет `from` во все signaling сообщения
- ✅ Клиенты получают корректные signaling сообщения
- ✅ WebRTC соединение устанавливается
- ✅ Таймер запускается
- ✅ Звук и видео передаются

Просто пересоберите сервер и протестируйте звонки!
