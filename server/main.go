package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// ============ Models ============

type User struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Avatar   string `json:"avatar"`
	Status   string `json:"status"`
}

type Message struct {
	ID            string    `json:"id"`
	ChatID        string    `json:"chatId"`
	SenderID      string    `json:"senderId"`
	Text          string    `json:"text"`
	Timestamp     time.Time `json:"timestamp"`
	Type          string    `json:"type"` // text, voice, system
	VoiceDuration int       `json:"voiceDuration,omitempty"`
	AudioData     string    `json:"audioData,omitempty"` // base64 encoded audio
	Waveform      []float64 `json:"waveform,omitempty"`  // waveform visualization data
}

type Chat struct {
	ID           string   `json:"id"`
	Type         string   `json:"type"` // private, group
	Name         string   `json:"name"`
	Avatar       string   `json:"avatar"`
	Participants []string `json:"participants"`
}

// ============ WebSocket ============

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

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

// ============ Client Connection ============

type Client struct {
	ID       string
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
			log.Printf("Client connected: %s", client.ID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("Client disconnected: %s", client.ID)
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

// ============ Message Store (In-Memory for demo) ============

type MessageStore struct {
	messages map[string][]Message
	mu       sync.RWMutex
}

func NewMessageStore() *MessageStore {
	return &MessageStore{
		messages: make(map[string][]Message),
	}
}

func (s *MessageStore) Save(msg Message) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages[msg.ChatID] = append(s.messages[msg.ChatID], msg)
}

func (s *MessageStore) GetByChat(chatID string) []Message {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.messages[chatID]
}

// ============ Globals ============

var (
	hub     *Hub
	store   *MessageStore
)

// ============ Handlers ============

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		ID:   userID,
		Conn: conn,
		Send: make(chan []byte, 256),
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

	chatMsg.Message.ID = fmt.Sprintf("msg_%d", time.Now().UnixNano())
	chatMsg.Message.SenderID = client.ID
	chatMsg.Message.Timestamp = time.Now()

	// Save to store (without audio data to save memory)
	msgToSave := chatMsg.Message
	msgToSave.AudioData = "" // Don't store audio in memory
	store.Save(msgToSave)

	// Broadcast to chat participants with full payload (including audio)
	response, _ := json.Marshal(WSMessage{
		Type:    "chat-message",
		Payload: payload,
	})

	hub.BroadcastToChat(chatMsg.ChatID, response, "")
	log.Printf("Message sent in chat %s by %s (type: %s)", chatMsg.ChatID, client.ID, chatMsg.Message.Type)
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

	signal.From = client.ID

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

func handleGetMessages(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatID := vars["chatId"]

	messages := store.GetByChat(chatID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
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
	hub = NewHub()
	store = NewMessageStore()

	go hub.Run()

	router := mux.NewRouter()

	// CORS middleware
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// API Routes
	router.HandleFunc("/health", handleHealth).Methods("GET")
	router.HandleFunc("/api/messages/{chatId}", handleGetMessages).Methods("GET")
	router.HandleFunc("/ws/{userId}", handleWebSocket).Methods("GET")

	// Serve static files (frontend)
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("../dist")))

	port := ":8080"
	log.Printf("🚀 GoTalk server starting on port %s", port)
	log.Printf("📡 WebSocket endpoint: ws://localhost%s/ws/{userId}", port)
	log.Printf("💬 REST API: http://localhost%s/api/", port)

	if err := http.ListenAndServe(port, router); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
