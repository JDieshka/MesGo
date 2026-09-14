package main

import (
	"encoding/json"
	"log"
	"sync"
)

// ============ WebRTC Signaling Server ============

// Room represents a call room (for group calls)
type Room struct {
	ID       string
	Clients  map[string]*Client
	mu       sync.RWMutex
}

// RoomManager manages active call rooms
type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) GetOrCreateRoom(roomID string) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if room, exists := rm.rooms[roomID]; exists {
		return room
	}

	room := &Room{
		ID:      roomID,
		Clients: make(map[string]*Client),
	}
	rm.rooms[roomID] = room
	return room
}

func (rm *RoomManager) RemoveRoom(roomID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.rooms, roomID)
}

func (rm *RoomManager) GetRoom(roomID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.rooms[roomID]
}

func (r *Room) AddClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[client.ID] = client
}

func (r *Room) RemoveClient(clientID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Clients, clientID)
}

func (r *Room) Broadcast(message []byte, excludeID string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for id, client := range r.Clients {
		if id != excludeID {
			select {
			case client.Send <- message:
			default:
				log.Printf("Failed to send to client %s", id)
			}
		}
	}
}

func (r *Room) GetClientCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Clients)
}

// ============ WebRTC Message Types ============

type RTCOffer struct {
	SDP  json.RawMessage `json:"sdp"`
	Type string          `json:"type"`
}

type RTCAnswer struct {
	SDP  json.RawMessage `json:"sdp"`
	Type string          `json:"type"`
}

type RTCIceCandidate struct {
	Candidate     string `json:"candidate"`
	SDPMLineIndex int    `json:"sdpMLineIndex"`
	SDPMid        string `json:"sdpMid"`
}

type CallRequest struct {
	RoomID   string `json:"roomId"`
	CallType string `json:"callType"` // voice, video
	From     string `json:"from"`
}

type CallResponse struct {
	RoomID   string `json:"roomId"`
	Accepted bool   `json:"accepted"`
	From     string `json:"from"`
}

// ============ Signaling Flow ============
// 1. Caller sends "call-request" to callee(s)
// 2. Callee(s) respond with "call-accept" or "call-reject"
// 3. If accepted, caller creates RTCPeerConnection and sends "offer"
// 4. Callee creates answer and sends "answer"
// 5. Both exchange ICE candidates via "ice-candidate"
// 6. For group calls, each new participant creates offer to existing participants
// 7. Screen sharing: sender adds new track to existing peer connection
