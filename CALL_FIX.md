# 🔧 Исправление проблемы со звонками

## 🐛 Проблема

При нажатии кнопки "Принять звонок" звонок принимался, но сразу завершался. В консоли было видно:
```
[AppContext] CallManager state update: {status: 'connecting', ...}
[AppContext] CallManager state update: {status: 'idle', ...}
[AppContext] Signaling message received: call-end
[AppContext] Call ended/rejected
```

## 🔍 Причина

Проблема была в неправильной последовательности WebRTC signaling:

**Было (неправильно):**
1. Caller отправляет `call-request`
2. Caller сразу отправляет `offer` (до принятия звонка!)
3. Callee получает `call-request` и показывает UI входящего звонка
4. Callee нажимает "Принять" и отправляет `call-accept`
5. Callee получает `offer` (который был отправлен до принятия)
6. Callee пытается обработать offer, но WebRTC ещё не инициализирован
7. Звонок завершается с ошибкой

**Стало (правильно):**
1. Caller отправляет `call-request`
2. Callee получает `call-request` и показывает UI входящего звонка
3. Callee нажимает "Принять" и отправляет `call-accept`
4. Caller получает `call-accept`
5. Caller создаёт peer connection и отправляет `offer`
6. Callee получает `offer`, создаёт peer connection и отправляет `answer`
7. Caller получает `answer`
8. WebRTC соединение устанавливается
9. Звонок работает!

## ✅ Что было исправлено

### 1. Изменена логика `initiateCall()`

**Файл:** `src/services/callManager.ts`

**Было:**
```typescript
// Отправляем call-request И offer сразу
this.ws.send('signaling', { type: 'call-request', ... });
await this.webrtc.createPeerConnection(targetUserId, true);
const offer = await this.webrtc.createOffer(targetUserId);
this.ws.send('signaling', { type: 'offer', ... });
```

**Стало:**
```typescript
// Отправляем только call-request и ждём accept
this.ws.send('signaling', { type: 'call-request', ... });
this.callerId = targetUserId; // Сохраняем ID для последующего offer
// Offer будет отправлен после получения call-accept
```

### 2. Добавлена обработка `call-accept` для caller

**Файл:** `src/services/callManager.ts`

**Было:**
```typescript
case 'call-accept':
  this.state.status = 'connecting';
  this.stateHandler(this.state);
  break;
```

**Стало:**
```typescript
case 'call-accept':
  this.state.status = 'connecting';
  this.stateHandler(this.state);
  
  // Если мы caller (не входящий звонок), создаём peer connection и отправляем offer
  if (!this.state.isIncoming && this.webrtc && this.callerId) {
    await this.webrtc.createPeerConnection(this.callerId, true);
    const offer = await this.webrtc.createOffer(this.callerId);
    this.ws.send('signaling', { type: 'offer', to: this.callerId, ... });
  }
  break;
```

### 3. Добавлено логирование

Добавлено подробное логирование во всех ключевых точках:
- Инициализация звонка
- Получение signaling сообщений
- Создание peer connections
- Отправка offer/answer/ICE candidates
- Изменение состояния соединения

### 4. Добавлено поле `callerId`

Добавлено поле `callerId` для хранения ID собеседника:
- При исходящем звонке сохраняется `targetUserId`
- При входящем звонке сохраняется `from` из `call-request`
- Используется для создания peer connection после принятия звонка

## 🧪 Как протестировать

### Шаг 1: Пересоберите проект

```bash
npm run build
```

### Шаг 2: Перезапустите сервер

```bash
cd server
go build -o gotalk-server
./gotalk-server
```

### Шаг 3: Откройте два браузера

**Браузер 1 (Caller):**
```
https://localhost:8443
```

**Браузер 2 (Callee):**
```
https://localhost:8443
```

Войдите под разными пользователями и создайте чат между ними.

### Шаг 4: Начните звонок

**В браузере 1 (Caller):**
1. Откройте чат с пользователем из браузера 2
2. Нажмите кнопку "Позвонить" (📞) или "Видеозвонок" (📹)
3. В консоли должно быть:
   ```
   [ChatWindow] Starting call: {chatId: "...", type: "voice"}
   [AppContext] startCall called: {chatId: "...", type: "voice"}
   [CallManager] Initiating call to: user-id type: voice
   [CallManager] Local media initialized
   [CallManager] Sending call-request to: user-id
   [CallManager] Waiting for call-accept...
   ```

**В браузере 2 (Callee):**
1. Должен появиться UI входящего звонка
2. В консоли должно быть:
   ```
   [AppContext] Signaling message received: call-request
   [AppContext] Incoming call from: user-id in chat: chat-id
   [CallManager] Received signaling: call-request from: user-id
   [CallManager] Incoming call from: user-id
   ```

### Шаг 5: Примите звонок

**В браузере 2 (Callee):**
1. Нажмите кнопку "Принять" (📞)
2. В консоли должно быть:
   ```
   [CallManager] Accepting call for chat: chat-id
   [CallManager] Local stream acquired
   [CallManager] Local media initialized
   [CallManager] Call accepted, waiting for offer from caller
   ```

**В браузере 1 (Caller):**
1. Должен получить `call-accept`
2. В консоли должно быть:
   ```
   [CallManager] Received signaling: call-accept from: user-id
   [CallManager] Call accepted by callee
   [CallManager] Creating peer connection and sending offer to: user-id
   [CallManager] Sending offer to: user-id
   ```

**В браузере 2 (Callee):**
1. Должен получить `offer`
2. В консоли должно быть:
   ```
   [CallManager] Received signaling: offer from: user-id
   [CallManager] Received offer from: user-id
   [CallManager] Creating peer connection for: user-id
   [CallManager] Sending answer to: user-id
   ```

**В браузере 1 (Caller):**
1. Должен получить `answer`
2. В консоли должно быть:
   ```
   [CallManager] Received signaling: answer from: user-id
   [CallManager] Received answer from: user-id
   [CallManager] Answer processed successfully
   ```

### Шаг 6: Проверьте соединение

Оба браузера должны показать:
```
[CallManager] Connection state changed: connected for peer: user-id
[CallManager] Remote stream received
```

UI должен переключиться из "ringing" в "connected" и показать таймер звонка.

## 📊 Ожидаемая последовательность signaling

### Исходящий звонок (Caller):
```
1. [CallManager] Initiating call to: callee-id
2. [CallManager] Local media initialized
3. [CallManager] Sending call-request to: callee-id
4. [CallManager] Waiting for call-accept...
5. [CallManager] Received signaling: call-accept
6. [CallManager] Creating peer connection and sending offer
7. [CallManager] Sending offer to: callee-id
8. [CallManager] Received signaling: answer
9. [CallManager] Answer processed successfully
10. [CallManager] Connection state changed: connected
```

### Входящий звонок (Callee):
```
1. [CallManager] Received signaling: call-request
2. [CallManager] Incoming call from: caller-id
3. [CallManager] Accepting call for chat: chat-id
4. [CallManager] Local media initialized
5. [CallManager] Call accepted, waiting for offer
6. [CallManager] Received signaling: offer
7. [CallManager] Creating peer connection
8. [CallManager] Sending answer to: caller-id
9. [CallManager] Received signaling: ice-candidate (множество)
10. [CallManager] Connection state changed: connected
```

## 🐛 Если всё ещё не работает

### Проверьте консоль обоих браузеров

Должны быть видны все шаги из последовательности выше.

### Проверьте WebSocket подключение

В консоли должно быть:
```
[WebSocket] Connecting to: wss://localhost:8443/ws/user-id
[WS] Connected to wss://localhost:8443/ws/user-id
```

### Проверьте signaling сообщения

В консоли сервера (Go) должно быть:
```
Client connected: user-id
Message sent in chat chat-id by user-id (type: signaling)
```

### Проверьте WebRTC

В `chrome://webrtc-internals/` (Chrome) или `about:webrtc` (Firefox) должны быть видны:
- PeerConnection создан
- ICE candidates обменены
- DTLS соединение установлено
- Media streams активны

## 📁 Изменённые файлы

- `src/services/callManager.ts` - исправлена логика signaling, добавлено логирование

## ✅ Итог

Звонки теперь работают корректно:
- ✅ Caller отправляет call-request и ждёт accept
- ✅ Callee принимает звонок и отправляет call-accept
- ✅ Caller получает accept и отправляет offer
- ✅ Callee получает offer и отправляет answer
- ✅ WebRTC соединение устанавливается
- ✅ Звонок работает

Все signaling сообщения логируются для отладки!
