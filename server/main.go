package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// ============ Models ============

type WSMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type ChatMessage struct {
	ChatID  string  `json:"chatId"`
	Message Message `json:"message"`
}

type TypingIndicator struct {
	ChatID string `json:"chatId"`
	UserID string `json:"userId"`
}

// ============ WebSocket ============

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// ============ Client Connection ============

type Client struct {
	ID       string
	UserID   uuid.UUID
	Conn     *websocket.Conn
	Send     chan []byte
	mu       sync.Mutex
}

// ============ Hub (WebSocket Manager) ============

type Hub struct {
	clients    map[string]*Client
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("Client connected: %s (user: %s)", client.ID, client.UserID)

			// Update user status to online
			userRepo := &UserRepository{}
			userRepo.UpdateUserStatus(client.UserID, "online")

			// Broadcast status update to all clients
			statusMsg, _ := json.Marshal(WSMessage{
				Type: "user-status",
				Payload: map[string]interface{}{
					"userId": client.UserID,
					"status": "online",
				},
			})
			h.BroadcastToAll(statusMsg, client.ID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected: %s (user: %s)", client.ID, client.UserID)

			// Update user status to offline
			userRepo := &UserRepository{}
			userRepo.UpdateUserStatus(client.UserID, "offline")

			// Broadcast status update
			statusMsg, _ := json.Marshal(WSMessage{
				Type: "user-status",
				Payload: map[string]interface{}{
					"userId": client.UserID,
					"status": "offline",
				},
			})
			h.BroadcastToAll(statusMsg, "")
		}
	}
}

func (h *Hub) BroadcastToChat(chatID string, message []byte, excludeID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for id, client := range h.clients {
		if id != excludeID {
			select {
			case client.Send <- message:
			default:
				close(client.Send)
				delete(h.clients, id)
			}
		}
	}
}

func (h *Hub) BroadcastToAll(message []byte, excludeID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for id, client := range h.clients {
		if id != excludeID {
			select {
			case client.Send <- message:
			default:
				close(client.Send)
				delete(h.clients, id)
			}
		}
	}
}

func (h *Hub) SendTo(userID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if client, ok := h.clients[userID]; ok {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(h.clients, userID)
		}
	}
}

func (h *Hub) GetOnlineUsers() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]string, 0, len(h.clients))
	for id := range h.clients {
		users = append(users, id)
	}
	return users
}

// ============ WebRTC Signaling ============

type SignalingMessage struct {
	Type     string          `json:"type"` // offer, answer, ice-candidate, call-request, call-accept, call-end
	From     string          `json:"from"`
	To       string          `json:"to"`
	ChatID   string          `json:"chatId"`
	CallType string          `json:"callType,omitempty"` // voice, video
	Data     json.RawMessage `json:"data,omitempty"`
}

// ============ Globals ============

var (
	hub *Hub
)

// ============ Handlers ============

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]

	// Parse user ID
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		ID:     userID,
		UserID: parsedUserID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
	}

	hub.register <- client

	// Read messages
	go func() {
		defer func() {
			hub.unregister <- client
			client.Conn.Close()
		}()

		for {
			_, message, err := client.Conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					log.Printf("WebSocket error: %v", err)
				}
				break
			}

			var wsMsg WSMessage
			if err := json.Unmarshal(message, &wsMsg); err != nil {
				log.Printf("JSON parse error: %v", err)
				continue
			}

			switch wsMsg.Type {
			case "ping":
				// Heartbeat response
				pong, _ := json.Marshal(WSMessage{Type: "pong"})
				client.Send <- pong

			case "chat-message":
				handleChatMessage(client, wsMsg.Payload)

			case "typing":
				handleTyping(client, wsMsg.Payload)

			case "signaling":
				handleSignaling(client, wsMsg.Payload)

			default:
				log.Printf("Unknown message type: %s", wsMsg.Type)
			}
		}
	}()

	// Write messages
	go func() {
		for message := range client.Send {
			client.mu.Lock()
			err := client.Conn.WriteMessage(websocket.TextMessage, message)
			client.mu.Unlock()
			if err != nil {
				log.Printf("Write error: %v", err)
				return
			}
		}
	}()
}

func handleChatMessage(client *Client, payload json.RawMessage) {
	var chatMsg ChatMessage
	if err := json.Unmarshal(payload, &chatMsg); err != nil {
		log.Printf("Chat message parse error: %v", err)
		return
	}

	// Parse chat ID
	chatID, err := uuid.Parse(chatMsg.ChatID)
	if err != nil {
		log.Printf("Invalid chat ID: %v", err)
		return
	}

	// Save to database
	msgRepo := &MessageRepository{}
	msg, err := msgRepo.SaveMessage(
		chatID,
		client.UserID,
		chatMsg.Message.Text,
		chatMsg.Message.Type,
		chatMsg.Message.VoiceDuration,
		chatMsg.Message.AudioData,
		chatMsg.Message.Waveform,
	)

	if err != nil {
		log.Printf("Failed to save message: %v", err)
		return
	}

	// Update message with generated ID and timestamp
	chatMsg.Message.ID = msg.ID.String()
	chatMsg.Message.SenderID = client.UserID.String()
	chatMsg.Message.Timestamp = msg.CreatedAt

	// Broadcast to chat participants
	response, _ := json.Marshal(WSMessage{
		Type:    "chat-message",
		Payload: payload,
	})

	hub.BroadcastToChat(chatMsg.ChatID, response, "")
	log.Printf("Message sent in chat %s by %s (type: %s)", chatMsg.ChatID, client.UserID, chatMsg.Message.Type)
}

func handleTyping(client *Client, payload json.RawMessage) {
	var typing TypingIndicator
	if err := json.Unmarshal(payload, &typing); err != nil {
		return
	}

	response, _ := json.Marshal(WSMessage{
		Type:    "typing",
		Payload: payload,
	})

	hub.BroadcastToChat(typing.ChatID, response, client.ID)
}

func handleSignaling(client *Client, payload json.RawMessage) {
	var signal SignalingMessage
	if err := json.Unmarshal(payload, &signal); err != nil {
		log.Printf("Signaling parse error: %v", err)
		return
	}

	signal.From = client.UserID.String()

	// Route signaling message to target
	response, _ := json.Marshal(WSMessage{
		Type:    "signaling",
		Payload: payload,
	})

	if signal.To != "" {
		hub.SendTo(signal.To, response)
	} else {
		// Broadcast to all chat participants (for group calls)
		hub.BroadcastToChat(signal.ChatID, response, client.ID)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "ok",
		"online_users": len(hub.GetOnlineUsers()),
		"time":         time.Now(),
	})
}

// ============ Main ============

func main() {
	// Initialize database
	if err := InitDB(); err != nil {
		log.Printf("⚠️  Database initialization failed: %v", err)
		log.Println("Continuing without database (messages will not be persisted)")
	} else {
		// Run migrations
		if err := RunMigrations(); err != nil {
			log.Printf("⚠️  Migration failed: %v", err)
		}
		defer CloseDB()
	}

	hub = NewHub()
	go hub.Run()

	router := mux.NewRouter()

	// CORS middleware
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Public routes (no auth required)
	router.HandleFunc("/health", handleHealth).Methods("GET")
	router.HandleFunc("/api/auth/register", RegisterHandler).Methods("POST")
	router.HandleFunc("/api/auth/login", LoginHandler).Methods("POST")

	// Protected routes (auth required)
	api := router.PathPrefix("/api").Subrouter()
	api.Use(AuthMiddleware)
	api.HandleFunc("/me", GetCurrentUserHandler).Methods("GET")
	api.HandleFunc("/chats", GetUserChatsHandler).Methods("GET")
	api.HandleFunc("/messages/{chatId}", GetChatMessagesHandler).Methods("GET")

	// WebSocket (auth via query param for now)
	router.HandleFunc("/ws/{userId}", handleWebSocket).Methods("GET")

	// Serve static files (frontend)
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("../dist")))

	port := ":8080"
	log.Printf("🚀 GoTalk server starting on port %s", port)
	log.Printf("🌐 Server is accessible from all network interfaces (0.0.0.0)")
	log.Printf("")
	log.Printf("📡 Available endpoints:")
	log.Printf("   Local:    http://localhost%s", port)
	log.Printf("   Network:  http://<your-pc-ip>%s (e.g., http://192.168.1.156%s)", port, port)
	log.Printf("   WebSocket: ws://<your-pc-ip>%s/ws/{userId}", port)
	log.Printf("")
	log.Printf("🔐 Auth endpoints: http://<your-pc-ip>%s/api/auth/", port)
	log.Printf("💬 REST API: http://<your-pc-ip>%s/api/", port)

	if err := http.ListenAndServe(port, router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
