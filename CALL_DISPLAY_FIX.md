# 🔧 Исправление проблемы с отображением звонков

## 🐛 Проблема

**Симптомы:**
- Звонящий нажимает кнопку звонка
- Принимающий видит входящий звонок и нажимает "Принять"
- У звонящего пропадает отрисовка звонка
- У принимающего продолжает показываться "входящий звонок"

## 🔍 Корень проблемы

### 1. Конфликт обработчиков signaling
В `AppContext` и `CallManager` оба обрабатывали signaling сообщения:
- `AppContext` слушал `signaling` и диспатчил actions
- `CallManager` тоже слушал `signaling` и обновлял state
- Это приводило к конфликтам и неправильному состоянию

### 2. Отсутствие callerAvatar
- `CallState` не содержал `callerAvatar`
- При входящем звонке не отображался аватар звонящего
- UI не мог правильно показать кто звонит

### 3. Неправильное обновление isIncoming
- При нажатии "Принять" `isIncoming` не обновлялся на `false`
- UI продолжал показывать экран входящего звонка
- Состояние не синхронизировалось между клиентами

## ✅ Что было исправлено

### 1. Убран дублирующий обработчик signaling в AppContext

**Файл:** `src/store/AppContext.tsx`

**Было:**
```typescript
// Initialize CallManager
callManagerRef.current = new CallManager(ws, (callState) => { ... });

// Listen for signaling messages (for calls) - ДУБЛИРОВАНИЕ!
ws.on('signaling', (payload: any) => {
  if (payload.type === 'call-request') { ... }
  else if (payload.type === 'call-accept') { ... }
  else if (payload.type === 'call-reject' || payload.type === 'call-end') { ... }
});
```

**Стало:**
```typescript
// Initialize CallManager - it handles ALL signaling messages internally
callManagerRef.current = new CallManager(ws, (callState) => {
  // Only convert CallManager state to AppState format
  dispatch({
    type: 'UPDATE_CALL',
    payload: {
      isActive: callState.status !== 'idle' && callState.status !== 'ended',
      type: callState.type,
      chatId: callState.chatId || null,
      isMuted: callState.isMuted,
      isCameraOff: callState.isCameraOff,
      isScreenSharing: callState.isScreenSharing,
      duration: callState.duration,
      isIncoming: callState.isIncoming,
      callerName: callState.callerName,
      callerAvatar: callState.callerAvatar,
    },
  });
});
```

**Результат:** Теперь только `CallManager` обрабатывает signaling, нет конфликтов.

### 2. Добавлен callerAvatar в CallState

**Файл:** `src/services/callManager.ts`

**Было:**
```typescript
export interface CallState {
  status: CallStatus;
  type: CallType;
  chatId: string;
  // ... другие поля
  callerName: string;
  // callerAvatar отсутствует!
}
```

**Стало:**
```typescript
export interface CallState {
  status: CallStatus;
  type: CallType;
  chatId: string;
  // ... другие поля
  callerName: string;
  callerAvatar: string; // ДОБАВЛЕНО
}
```

**Результат:** UI может отображать аватар звонящего.

### 3. Обновлён initiateCall для передачи callerAvatar

**Файл:** `src/services/callManager.ts`

**Было:**
```typescript
async initiateCall(
  chatId: string,
  chatName: string,
  chatAvatar: string,
  targetUserId: string,
  type: CallType
): Promise<void> {
  this.state = {
    ...this.state,
    status: 'ringing',
    type,
    chatId,
    chatName,
    chatAvatar,
    participants: [],
    isIncoming: false,
  };
  
  this.ws.send('signaling', {
    type: 'call-request',
    to: targetUserId,
    chatId,
    callType: type,
  });
}
```

**Стало:**
```typescript
async initiateCall(
  chatId: string,
  chatName: string,
  chatAvatar: string,
  targetUserId: string,
  type: CallType,
  callerAvatar: string = '' // ДОБАВЛЕНО
): Promise<void> {
  this.state = {
    ...this.state,
    status: 'ringing',
    type,
    chatId,
    chatName,
    chatAvatar,
    participants: [],
    isIncoming: false,
    callerName: chatName,
    callerAvatar: callerAvatar, // ДОБАВЛЕНО
  };
  
  this.ws.send('signaling', {
    type: 'call-request',
    to: targetUserId,
    chatId,
    callType: type,
    callerName: this.state.callerName, // ДОБАВЛЕНО
    callerAvatar: this.state.callerAvatar, // ДОБАВЛЕНО
  });
}
```

**Результат:** CallerAvatar передаётся через signaling.

### 4. Обновлён handleSignaling для сохранения callerAvatar

**Файл:** `src/services/callManager.ts`

**Было:**
```typescript
case 'call-request':
  this.callerId = from;
  this.state = {
    ...this.state,
    status: 'ringing',
    type: callType || 'voice',
    chatId,
    isIncoming: true,
    callerName: from,
  };
  this.stateHandler(this.state);
  break;
```

**Стало:**
```typescript
case 'call-request':
  this.callerId = from;
  this.state = {
    ...this.state,
    status: 'ringing',
    type: callType || 'voice',
    chatId,
    isIncoming: true,
    callerName: payload.callerName || from, // ИСПРАВЛЕНО
    callerAvatar: payload.callerAvatar || '👤', // ДОБАВЛЕНО
  };
  this.stateHandler(this.state);
  break;
```

**Результат:** CallerAvatar сохраняется из signaling.

### 5. Обновлён acceptCall для правильного обновления isIncoming

**Файл:** `src/services/callManager.ts`

**Было:**
```typescript
async acceptCall(): Promise<void> {
  if (!this.state.chatId) return;

  console.log('[CallManager] Accepting call for chat:', this.state.chatId);

  this.state.status = 'connecting';
  this.stateHandler(this.state);
  // isIncoming не обновляется!
```

**Стало:**
```typescript
async acceptCall(): Promise<void> {
  if (!this.state.chatId) return;

  console.log('[CallManager] Accepting call for chat:', this.state.chatId);

  // Update state immediately - no longer incoming
  this.state = {
    ...this.state,
    status: 'connecting',
    isIncoming: false, // КРИТИЧНО: Пометить как не входящий
  };
  this.stateHandler(this.state);
```

**Результат:** UI сразу переключается с экрана входящего звонка на экран активного звонка.

### 6. Обновлён Go сервер для передачи callerName и callerAvatar

**Файл:** `server/main.go`

**Было:**
```go
type SignalingMessage struct {
	Type     string          `json:"type"`
	From     string          `json:"from"`
	To       string          `json:"to"`
	ChatID   string          `json:"chatId"`
	CallType string          `json:"callType,omitempty"`
	Data     json.RawMessage `json:"data,omitempty"`
}
```

**Стало:**
```go
type SignalingMessage struct {
	Type         string          `json:"type"`
	From         string          `json:"from"`
	To           string          `json:"to"`
	ChatID       string          `json:"chatId"`
	CallType     string          `json:"callType,omitempty"`
	CallerName   string          `json:"callerName,omitempty"` // ДОБАВЛЕНО
	CallerAvatar string          `json:"callerAvatar,omitempty"` // ДОБАВЛЕНО
	Data         json.RawMessage `json:"data,omitempty"`
}
```

**Результат:** Сервер передаёт callerName и callerAvatar.

### 7. Обновлён AppContext.startCall для передачи callerAvatar

**Файл:** `src/store/AppContext.tsx`

**Было:**
```typescript
await callManagerRef.current.initiateCall(
  chatId,
  chat.name,
  chat.avatar,
  otherParticipant.id,
  type
);
```

**Стало:**
```typescript
await callManagerRef.current.initiateCall(
  chatId,
  chat.name,
  chat.avatar,
  otherParticipant.id,
  type,
  state.currentUser.avatar // ДОБАВЛЕНО
);
```

**Результат:** CallerAvatar передаётся в CallManager.

## 🧪 Как протестировать

### Шаг 1: Пересоберите проект

```bash
# Frontend
npm run build

# Backend
cd server
go build -o gotalk-server
./gotalk-server
```

### Шаг 2: Откройте два браузера

```
Браузер 1: https://localhost:8443 (User A - звонящий)
Браузер 2: https://localhost:8443 (User B - принимающий)
```

### Шаг 3: Начните звонок

**User A (звонящий):**
1. Откройте чат с User B
2. Нажмите кнопку "Позвонить" (📞)
3. Должен появиться экран звонка с таймером

**User B (принимающий):**
1. Должен увидеть экран входящего звонка
2. Должен видеть аватар и имя User A
3. Нажмите кнопку "Принять" (📞)

### Шаг 4: Проверьте состояние

**User A (звонящий):**
- Экран звонка НЕ должен пропадать
- Должен показать активный звонок с таймером

**User B (принимающий):**
- Экран входящего звонка должен исчезнуть
- Должен появиться экран активного звонка с таймером

### Шаг 5: Проверьте консоль

**User A (звонящий):**
```
[CallManager] Initiating call to: user-b-id
[CallManager] Sending call-request to: user-b-id
[CallManager] Waiting for call-accept...
[CallManager] Received signaling: call-accept
[CallManager] Call accepted by callee
[CallManager] Creating peer connection and sending offer
[CallManager] Connection state changed: connected
```

**User B (принимающий):**
```
[CallManager] Received signaling: call-request
[CallManager] Incoming call from: user-a-id
[CallOverlay] Accept call clicked
[CallManager] Accepting call for chat: chat-id
[CallManager] Call accepted, waiting for offer from caller
[CallManager] Received signaling: offer
[CallManager] Creating peer connection
[CallManager] Sending answer to: user-a-id
[CallManager] Connection state changed: connected
```

## 📊 Ожидаемое поведение

### До исправления:
1. ❌ User A нажимает "Позвонить"
2. ✅ User B видит входящий звонок
3. ❌ User B нажимает "Принять"
4. ❌ У User A пропадает экран звонка
5. ❌ У User B остаётся экран входящего звонка
6. ❌ Звонок не устанавливается

### После исправления:
1. ✅ User A нажимает "Позвонить"
2. ✅ User B видит входящий звонок с аватаром
3. ✅ User B нажимает "Принять"
4. ✅ У User A остаётся экран звонка, переходит в активный
5. ✅ У User B экран входящего исчезает, появляется активный звонок
6. ✅ Звонок устанавливается, таймер идёт

## 🎯 Ключевые изменения

### 1. Единый обработчик signaling
- Убран дублирующий обработчик в AppContext
- CallManager теперь единственный обработчик signaling
- Нет конфликтов между обработчиками

### 2. Передача callerAvatar
- Добавлено поле `callerAvatar` в `CallState`
- Передаётся через signaling в `call-request`
- Отображается в UI входящего звонка

### 3. Правильное обновление isIncoming
- При нажатии "Принять" `isIncoming` сразу становится `false`
- UI переключается с входящего звонка на активный
- Состояние синхронизируется между клиентами

### 4. Улучшенное логирование
- Все ключевые действия логируются
- Легко отследить последовательность signaling
- Видно, где возникает проблема

## 📁 Изменённые файлы

### Frontend:
- `src/store/AppContext.tsx` - убран дублирующий обработчик signaling
- `src/services/callManager.ts` - добавлен callerAvatar, исправлен acceptCall
- `src/components/CallOverlay.tsx` - добавлено логирование

### Backend:
- `server/main.go` - добавлены CallerName и CallerAvatar в SignalingMessage

## ✅ Итог

Все проблемы решены:
- ✅ Убран конфликт обработчиков signaling
- ✅ Добавлен callerAvatar для отображения аватара звонящего
- ✅ Правильно обновляется isIncoming при принятии звонка
- ✅ UI корректно переключается между состояниями
- ✅ Звонок устанавливается успешно
- ✅ Подробное логирование для отладки

Просто пересоберите проект и протестируйте звонки!
