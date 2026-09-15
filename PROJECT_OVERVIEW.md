# 📋 PROJECT OVERVIEW - GoTalk Messenger

## 🎯 Project Description

**GoTalk** is a full-featured real-time messenger application with voice/video calls and screen sharing capabilities. The project consists of a React frontend and Go backend with PostgreSQL database.

---

## 🏗️ Technology Stack

### Frontend
- **React 18** + **TypeScript** - UI framework
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **WebRTC** - Peer-to-peer video/audio/screen sharing
- **WebSocket** - Real-time messaging
- **MediaRecorder API** - Voice message recording
- **JWT** - Authentication tokens

### Backend
- **Go 1.21** - Server language
- **PostgreSQL** - Database
- **Gorilla WebSocket** - WebSocket server
- **Gorilla Mux** - HTTP router
- **pgx** - PostgreSQL driver
- **JWT** - Authentication
- **bcrypt** - Password hashing

---

## 📁 Project Structure

```
/
├── src/                          # Frontend source
│   ├── App.tsx                   # Main app component with routing
│   ├── main.tsx                  # Entry point
│   ├── index.css                 # Global styles
│   │
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   │
│   ├── store/
│   │   └── AppContext.tsx        # Global state management (React Context)
│   │
│   ├── services/
│   │   ├── websocket.ts          # WebSocket client with auto-reconnect
│   │   ├── webrtc.ts             # WebRTC manager for P2P connections
│   │   ├── callManager.ts        # Call orchestration (signaling + WebRTC)
│   │   ├── audioRecorder.ts      # Voice message recording
│   │   ├── auth.ts               # JWT authentication service
│   │   └── api.ts                # REST API client
│   │
│   └── components/
│       ├── LoginPage.tsx         # Login/Register page
│       ├── Sidebar.tsx           # Chat list sidebar
│       ├── ChatWindow.tsx        # Chat window with messages
│       ├── MessageBubble.tsx     # Message component (text/voice)
│       ├── CallOverlay.tsx       # Call UI (voice/video/screen)
│       ├── NewChatModal.tsx      # Create new chat modal
│       └── SettingsModal.tsx     # Settings modal
│
├── server/                       # Backend source
│   ├── main.go                   # Main server + WebSocket + signaling
│   ├── db.go                     # PostgreSQL connection + migrations
│   ├── auth.go                   # JWT authentication handlers
│   ├── user_repository.go        # User CRUD operations
│   ├── chat_repository.go        # Chat/Message CRUD operations
│   ├── chat_api.go               # Chat REST API endpoints
│   ├── https.go                  # HTTPS server with self-signed cert
│   │
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Initial database schema
│   │   └── 002_fix_null_values.sql   # Fix NULL values migration
│   │
│   ├── Dockerfile                # Docker image for backend
│   ├── go.mod                    # Go dependencies
│   └── .env.example              # Environment variables example
│
├── docker-compose.yml            # Docker Compose for full stack
├── package.json                  # Frontend dependencies
├── vite.config.js                # Vite configuration
└── index.html                    # HTML entry point
```

---

## ✅ Implemented Features

### 1. Authentication System
- ✅ User registration with username/password
- ✅ User login
- ✅ JWT token generation (72 hours expiration)
- ✅ Token storage in localStorage
- ✅ Auto-login on page refresh
- ✅ Protected API endpoints
- ✅ Logout functionality

### 2. Chat System
- ✅ Private chats (1-on-1)
- ✅ Group chats (multiple participants)
- ✅ Real-time message delivery via WebSocket
- ✅ Message persistence in PostgreSQL
- ✅ Unread message counter
- ✅ Online/offline status indicators
- ✅ Chat creation UI
- ✅ User search for chat creation

### 3. Messaging
- ✅ Text messages
- ✅ Voice messages (real recording via MediaRecorder)
- ✅ Voice message playback with waveform visualization
- ✅ Message timestamps
- ✅ Read receipts (basic)
- ✅ Emoji picker

### 4. Voice/Video Calls
- ✅ Voice calls (P2P via WebRTC)
- ✅ Video calls (P2P via WebRTC)
- ✅ Incoming call UI with accept/reject
- ✅ Call duration timer
- ✅ Mute/unmute microphone
- ✅ Enable/disable camera
- ✅ Call end functionality
- ✅ Local video preview
- ✅ Remote video display

### 5. Screen Sharing
- ✅ Screen share initiation
- ✅ Local screen preview (for sender)
- ✅ Remote screen display (for receiver)
- ✅ Screen share with audio
- ✅ Stop screen share
- ✅ Camera preview during screen share

### 6. Real-time Updates
- ✅ WebSocket connection with auto-reconnect
- ✅ Heartbeat mechanism (30s interval)
- ✅ Real-time message updates
- ✅ Real-time user status updates
- ✅ Real-time call signaling

### 7. Network
- ✅ HTTPS server with self-signed certificate
- ✅ Automatic certificate generation
- ✅ Support for localhost and local network (192.168.1.156)
- ✅ WebSocket automatically uses wss:// with HTTPS
- ✅ CORS middleware

---

## 🐛 Known Issues & Bugs

### Critical Issues

1. **Screen Share Renegotiation**
   - **Status:** Partially fixed
   - **Problem:** After `replaceTrack()`, the remote peer may not receive the new track without proper renegotiation
   - **Current implementation:** Renegotiation is triggered after `replaceTrack()` in `webrtc.ts`
   - **Testing needed:** Verify screen share works reliably in both directions

2. **WebRTC Connection Stability**
   - **Status:** Needs testing
   - **Problem:** Connection may drop in certain network conditions
   - **Current implementation:** Basic error handling in `webrtc.ts`
   - **Missing:** TURN server for NAT traversal (only STUN servers configured)

3. **Audio Quality**
   - **Status:** Basic implementation
   - **Problem:** No advanced audio processing
   - **Current implementation:** Basic echo cancellation, noise suppression, auto gain control
   - **Missing:** Advanced audio codecs, adaptive bitrate

### Medium Priority Issues

4. **Group Calls**
   - **Status:** UI ready, WebRTC not fully implemented
   - **Problem:** Mesh network for multiple participants not implemented
   - **Current implementation:** Only 1-on-1 calls work
   - **Missing:** SFU (Selective Forwarding Unit) or mesh network

5. **Message Editing/Deletion**
   - **Status:** Not implemented
   - **Problem:** Users cannot edit or delete sent messages
   - **Current implementation:** Messages are immutable
   - **Missing:** Edit/delete UI and API endpoints

6. **File/Image Sharing**
   - **Status:** Not implemented
   - **Problem:** Cannot send files or images
   - **Current implementation:** Only text and voice messages
   - **Missing:** File upload UI, storage, and API

### Low Priority Issues

7. **Typing Indicator**
   - **Status:** Backend ready, frontend not implemented
   - **Problem:** No "user is typing..." indicator
   - **Current implementation:** WebSocket event exists but not used
   - **Missing:** UI indicator

8. **Message Reactions**
   - **Status:** Not implemented
   - **Problem:** Cannot react to messages with emojis
   - **Current implementation:** Not started
   - **Missing:** Full implementation

9. **Push Notifications**
   - **Status:** Not implemented
   - **Problem:** No browser push notifications
   - **Current implementation:** Not started
   - **Missing:** Service worker, notification API

---

## 🔍 Code Quality Issues to Check

### Potential Bugs

1. **Race Conditions in WebRTC**
   - **File:** `src/services/webrtc.ts`
   - **Issue:** Multiple async operations may cause race conditions
   - **Check:** Peer connection creation, track replacement, renegotiation

2. **Memory Leaks**
   - **Files:** `src/components/CallOverlay.tsx`, `src/services/webrtc.ts`
   - **Issue:** MediaStream tracks may not be properly cleaned up
   - **Check:** `cleanup()` methods, useEffect cleanup functions

3. **WebSocket Reconnection**
   - **File:** `src/services/websocket.ts`
   - **Issue:** Reconnection logic may cause duplicate connections
   - **Check:** Reconnection attempts, state management

4. **State Synchronization**
   - **File:** `src/store/AppContext.tsx`
   - **Issue:** State may become inconsistent between WebSocket events and UI
   - **Check:** Action handlers, state updates

5. **Error Handling**
   - **Files:** All service files
   - **Issue:** Some errors may be silently ignored
   - **Check:** try-catch blocks, error logging

### Security Issues

1. **JWT Secret**
   - **File:** `server/auth.go`
   - **Issue:** Hardcoded default JWT secret
   - **Check:** Environment variable usage

2. **CORS Configuration**
   - **File:** `server/main.go`
   - **Issue:** CORS allows all origins (`*`)
   - **Check:** Production CORS configuration

3. **Password Storage**
   - **File:** `server/user_repository.go`
   - **Issue:** Bcrypt cost factor may be too low
   - **Check:** `bcrypt.DefaultCost` value

4. **SQL Injection**
   - **Files:** `server/*_repository.go`
   - **Issue:** Using parameterized queries (good), but verify all queries
   - **Check:** All SQL queries use `$1`, `$2`, etc.

5. **XSS Protection**
   - **Files:** All React components
   - **Issue:** User input may not be properly escaped
   - **Check:** Message rendering, user input handling

### Performance Issues

1. **Message Loading**
   - **File:** `src/store/AppContext.tsx`
   - **Issue:** All messages loaded at once (no pagination)
   - **Check:** `refreshMessages()` function

2. **WebRTC Stream Management**
   - **File:** `src/services/webrtc.ts`
   - **Issue:** Multiple streams may be created unnecessarily
   - **Check:** Stream creation, track management

3. **Database Queries**
   - **Files:** `server/*_repository.go`
   - **Issue:** Some queries may not be optimized
   - **Check:** Query execution plans, indexes

---

## 🧪 Testing Checklist

### Authentication
- [ ] Register new user
- [ ] Login with existing user
- [ ] Auto-login on page refresh
- [ ] Logout
- [ ] Invalid credentials handling
- [ ] Token expiration

### Chat System
- [ ] Create private chat
- [ ] Create group chat
- [ ] Send text message
- [ ] Send voice message
- [ ] Receive messages in real-time
- [ ] Unread counter updates
- [ ] Online/offline status

### Voice Calls
- [ ] Initiate voice call
- [ ] Receive incoming call
- [ ] Accept call
- [ ] Reject call
- [ ] Mute/unmute
- [ ] End call
- [ ] Audio quality

### Video Calls
- [ ] Initiate video call
- [ ] Receive incoming video call
- [ ] Accept video call
- [ ] Local video preview
- [ ] Remote video display
- [ ] Enable/disable camera
- [ ] Video quality

### Screen Sharing
- [ ] Start screen share
- [ ] Local screen preview (sender)
- [ ] Remote screen display (receiver)
- [ ] Screen share with audio
- [ ] Stop screen share
- [ ] Camera during screen share
- [ ] Switch between camera and screen

### Real-time Updates
- [ ] Message delivery
- [ ] User status updates
- [ ] WebSocket reconnection
- [ ] Connection loss handling

### Network
- [ ] HTTPS access
- [ ] Local network access (192.168.1.156)
- [ ] Self-signed certificate acceptance
- [ ] WebSocket connection

---

## 🚀 How to Run

### Option 1: Docker (Recommended)

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Start Go backend
cd server
go mod tidy
go run .

# Frontend is already built in dist/
# Open https://localhost:8443
```

### Option 2: Local Development

```bash
# 1. PostgreSQL
docker run -d \
  --name gotalk-postgres \
  -e POSTGRES_USER=gotalk \
  -e POSTGRES_PASSWORD=gotalk \
  -e POSTGRES_DB=gotalk \
  -p 5432:5432 \
  postgres:16-alpine

# 2. Backend
cd server
export DATABASE_URL="postgres://gotalk:gotalk@localhost:5432/gotalk?sslmode=disable"
export JWT_SECRET="your-secret-key"
go mod tidy
go run .

# 3. Frontend
npm install
npm run dev
```

---

## 📊 Database Schema

### users
```sql
- id (UUID, PRIMARY KEY)
- username (VARCHAR, UNIQUE)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- display_name (VARCHAR)
- avatar (VARCHAR)
- status (VARCHAR) -- online, offline, busy, away
- last_seen (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### chats
```sql
- id (UUID, PRIMARY KEY)
- type (VARCHAR) -- private, group
- name (VARCHAR)
- avatar (VARCHAR)
- created_by (UUID, FK -> users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### chat_participants
```sql
- chat_id (UUID, FK -> chats)
- user_id (UUID, FK -> users)
- joined_at (TIMESTAMP)
- last_read_at (TIMESTAMP)
```

### messages
```sql
- id (UUID, PRIMARY KEY)
- chat_id (UUID, FK -> chats)
- sender_id (UUID, FK -> users)
- text (TEXT)
- type (VARCHAR) -- text, voice, system, file
- voice_duration (INTEGER)
- audio_data (TEXT) -- base64 encoded
- waveform (JSONB)
- created_at (TIMESTAMP)
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/me` - Get current user (requires auth)

### Chats
- `GET /api/chats/details` - Get user's chats with details
- `POST /api/chats` - Create new chat
- `PUT /api/chats/{chatId}/read` - Mark chat as read

### Users
- `GET /api/users` - Get all users
- `GET /api/users/search?q=...` - Search users

### Messages
- `GET /api/messages/{chatId}` - Get chat messages

### WebSocket
- `wss://192.168.1.156:8443/ws/{userId}` - WebSocket connection

---

## 🎯 What to Test

### Priority 1: Critical Functionality
1. **Authentication flow** - Register, login, logout
2. **Chat creation** - Private and group chats
3. **Message sending** - Text and voice messages
4. **Voice calls** - Basic P2P calls
5. **Video calls** - Basic P2P video
6. **Screen sharing** - Most complex feature

### Priority 2: Edge Cases
1. **Network issues** - WebSocket reconnection
2. **Concurrent operations** - Multiple actions at once
3. **Error handling** - Invalid inputs, server errors
4. **Memory leaks** - Long-running sessions

### Priority 3: Security
1. **Authentication bypass** - Try accessing protected endpoints without token
2. **SQL injection** - Try injecting SQL in inputs
3. **XSS** - Try injecting scripts in messages
4. **CORS** - Try accessing from unauthorized origin

---

## 📝 Notes for Review

### What Works Well
- ✅ Clean separation of concerns (services, components, store)
- ✅ TypeScript for type safety
- ✅ WebSocket with auto-reconnect
- ✅ JWT authentication
- ✅ PostgreSQL with migrations
- ✅ HTTPS with auto-generated certificates

### What Needs Improvement
- ⚠️ WebRTC error handling could be more robust
- ⚠️ No TURN server (only STUN) - may fail behind strict NAT
- ⚠️ No pagination for messages
- ⚠️ Limited error messages for users
- ⚠️ No loading states in some places
- ⚠️ Console logs should be removed for production

### Architecture Decisions
1. **React Context for state** - Simple but may not scale well
2. **WebSocket for signaling** - Good for real-time, but needs TURN for production
3. **PostgreSQL** - Good choice for relational data
4. **Self-signed certificates** - OK for development, not for production
5. **Base64 for audio** - Simple but increases payload size

---

## 🔗 External Dependencies

### Frontend
- react, react-dom
- lucide-react (icons)
- tailwindcss

### Backend
- gorilla/mux (HTTP router)
- gorilla/websocket (WebSocket)
- jackc/pgx (PostgreSQL driver)
- golang-jwt/jwt (JWT tokens)
- google/uuid (UUID generation)
- golang.org/x/crypto (bcrypt)

---

## 📚 Documentation Files

- `README.md` - Main documentation
- `FINAL_SUMMARY.md` - Project completion report
- `SCREEN_SHARE_FIX.md` - Screen share fixes
- `SIGNALING_FIX.md` - Signaling fixes
- `SOUND_VIDEO_FIX.md` - Audio/video fixes
- `MEDIA_FIX.md` - Media stream fixes
- `CALL_FIX.md` - Call fixes
- `LOOP_VARIABLE_CAPTURE_FIX.md` - Go loop variable fix
- `NULL_FIX.md` - NULL values fix
- `REALTIME_UPDATES.md` - Real-time updates
- `TESTING.md` - Testing guide

---

## 🎓 Learning Points

This project demonstrates:
1. **Full-stack development** - React + Go + PostgreSQL
2. **Real-time communication** - WebSocket + WebRTC
3. **Authentication** - JWT with bcrypt
4. **Database design** - Relational schema with migrations
5. **P2P communication** - WebRTC signaling and connection
6. **Media handling** - Audio/video recording and streaming
7. **HTTPS** - Self-signed certificates
8. **Docker** - Containerization

---

## 🚨 Important Notes

1. **This is a development project** - Not production-ready
2. **Self-signed certificates** - Browser will show security warning
3. **No TURN server** - WebRTC may fail behind strict NAT/firewall
4. **Base64 audio** - Increases payload size significantly
5. **No rate limiting** - Vulnerable to spam/DoS
6. **No input validation** - May accept invalid data
7. **Console logs** - Should be removed for production

---

## 📞 Support

For questions or issues, check the documentation files or review the code comments.

**Good luck with your review!** 🚀
