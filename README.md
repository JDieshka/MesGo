# GoTalk — Мессенджер

Полнофункциональное веб-приложение для обмена сообщениями с поддержкой голосовых/видео звонков и трансляции экрана.

## 🏗️ Архитектура

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** для стилей
- **Vite** для сборки
- **Lucide React** для иконок
- **Framer Motion** для анимаций

### Backend
- **Go** (Golang)
- **Gorilla WebSocket** для real-time сообщений
- **Gorilla Mux** для HTTP роутинга
- **WebRTC** для голосовых/видео звонков

## 📋 Функциональность

### 💬 Чат
- Личные сообщения
- Групповые чаты
- Голосовые сообщения
- Индикатор набора текста
- Статусы онлайн/оффлайн
- Счётчик непрочитанных сообщений
- Эмодзи

### 📞 Звонки
- Голосовые звонки (личные)
- Видеозвонки (личные)
- Групповые голосовые звонки
- Групповые видеозвонки
- Управление микрофоном и камерой

### 🖥️ Трансляция экрана
- Демонстрация экрана в личных звонках
- Демонстрация экрана в групповых звонках
- Поддержка аудио при демонстрации

## 🚀 Запуск

### Frontend (разработка)
```bash
npm install
npm run dev
```

### Frontend (сборка)
```bash
npm run build
```

### Backend (Go)
```bash
cd server
go mod tidy
go run main.go webrtc.go
```

Сервер запустится на порту 8080.

## 📡 API Endpoints

### WebSocket
- `ws://localhost:8080/ws/{userId}` — подключение к WebSocket

### REST API
- `GET /health` — проверка здоровья сервера
- `GET /api/messages/{chatId}` — получение сообщений чата

### WebSocket Messages

#### Отправка сообщения
```json
{
  "type": "chat-message",
  "payload": {
    "chatId": "chat1",
    "message": {
      "text": "Hello!",
      "type": "text"
    }
  }
}
```

#### Typing indicator
```json
{
  "type": "typing",
  "payload": {
    "chatId": "chat1",
    "userId": "user1"
  }
}
```

#### WebRTC Signaling
```json
{
  "type": "signaling",
  "payload": {
    "type": "offer",
    "from": "user1",
    "to": "user2",
    "chatId": "chat1",
    "callType": "video",
    "data": { "sdp": "..." }
  }
}
```

## 🔧 Структура проекта

```
├── src/
│   ├── App.tsx              # Главный компонент
│   ├── index.css            # Глобальные стили
│   ├── main.tsx             # Точка входа
│   ├── types/
│   │   └── index.ts         # TypeScript типы
│   ├── store/
│   │   └── AppContext.tsx    # State management
│   └── components/
│       ├── Sidebar.tsx       # Боковая панель с чатами
│       ├── ChatWindow.tsx    # Окно чата
│       ├── MessageBubble.tsx # Компонент сообщения
│       └── CallOverlay.tsx   # Интерфейс звонка
├── server/
│   ├── main.go              # Основной сервер
│   ├── webrtc.go            # WebRTC signaling
│   └── go.mod               # Go модули
└── index.html
```

## 🌐 WebRTC Flow

1. **Инициация звонка**: Отправитель → Signaling Server → Получатель
2. **SDP Offer**: Отправитель создаёт PeerConnection, отправляет offer
3. **SDP Answer**: Получатель принимает, создаёт answer
4. **ICE Candidates**: Обмен через signaling server
5. **Media Stream**: P2P соединение установлено
6. **Screen Share**: Добавление нового трека в существующее соединение

## 📝 Лицензия

MIT
