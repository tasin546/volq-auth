package cache

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// SessionData holds the authenticated client session info
type SessionData struct {
	AppID           string    `json:"app_id"`
	SessionID       string    `json:"session_id"`
	LicenseID       string    `json:"license_id,omitempty"`
	UserID          string    `json:"user_id,omitempty"`
	HWID            string    `json:"hwid"`
	TierLevel       int       `json:"tier_level"`
	EncryptionKey   string    `json:"encryption_key"` // Base64 32-byte AES key
	MACKey          string    `json:"mac_key"`        // Base64 32-byte MAC key
	CreatedAt       time.Time `json:"created_at"`
	ExpiresAt       time.Time `json:"expires_at"`
}

// Cache defines the caching and rate limiting interface
type Cache interface {
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Get(ctx context.Context, key string) (string, error)
	Delete(ctx context.Context, key string) error
	// SetNonce returns true if nonce was stored, false if it already existed (replay detected)
	SetNonce(ctx context.Context, nonce string, ttl time.Duration) (bool, error)
	// IncrementRateLimit increments request counter and returns current count
	IncrementRateLimit(ctx context.Context, key string, ttl time.Duration) (int64, error)
	// Session management
	StoreSession(ctx context.Context, token string, data *SessionData, ttl time.Duration) error
	GetSession(ctx context.Context, token string) (*SessionData, error)
	DeleteSession(ctx context.Context, token string) error
}

// NewCache initializes Redis or falls back to internal memory cache
func NewCache(redisURL string) Cache {
	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err == nil {
			client := redis.NewClient(opt)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			if err := client.Ping(ctx).Err(); err == nil {
				log.Println("[CACHE] Successfully connected to Redis / Upstash instance.")
				return &redisCache{client: client}
			}
			log.Println("[CACHE] Redis connection failed, falling back to In-Memory cache engine.")
		}
	}

	log.Println("[CACHE] Initializing zero-cost In-Memory Cache with TTL engine.")
	return newMemoryCache()
}

// ============================================================================
// REDIS IMPLEMENTATION
// ============================================================================
type redisCache struct {
	client *redis.Client
}

func (r *redisCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *redisCache) Get(ctx context.Context, key string) (string, error) {
	return r.client.Get(ctx, key).Result()
}

func (r *redisCache) Delete(ctx context.Context, key string) error {
	return r.client.Del(ctx, key).Err()
}

func (r *redisCache) SetNonce(ctx context.Context, nonce string, ttl time.Duration) (bool, error) {
	key := "nonce:" + nonce
	success, err := r.client.SetNX(ctx, key, "1", ttl).Result()
	return success, err
}

func (r *redisCache) IncrementRateLimit(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	pipe := r.client.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return 0, err
	}
	return incr.Val(), nil
}

func (r *redisCache) StoreSession(ctx context.Context, token string, data *SessionData, ttl time.Duration) error {
	bytes, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, "session:"+token, bytes, ttl).Err()
}

func (r *redisCache) GetSession(ctx context.Context, token string) (*SessionData, error) {
	val, err := r.client.Get(ctx, "session:"+token).Result()
	if err != nil {
		return nil, err
	}
	var data SessionData
	if err := json.Unmarshal([]byte(val), &data); err != nil {
		return nil, err
	}
	return &data, nil
}

func (r *redisCache) DeleteSession(ctx context.Context, token string) error {
	return r.client.Del(ctx, "session:"+token).Err()
}

// ============================================================================
// IN-MEMORY FALLBACK IMPLEMENTATION (100% Free & Zero External Dependencies)
// ============================================================================
type memItem struct {
	value     interface{}
	expiresAt time.Time
}

type memoryCache struct {
	mu    sync.RWMutex
	items map[string]memItem
}

func newMemoryCache() *memoryCache {
	mc := &memoryCache{
		items: make(map[string]memItem),
	}

	// Janitor goroutine for expired keys
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		for range ticker.C {
			mc.mu.Lock()
			now := time.Now()
			for k, v := range mc.items {
				if !v.expiresAt.IsZero() && now.After(v.expiresAt) {
					delete(mc.items, k)
				}
			}
			mc.mu.Unlock()
		}
	}()

	return mc
}

func (m *memoryCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	var exp time.Time
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}
	m.items[key] = memItem{value: value, expiresAt: exp}
	return nil
}

func (m *memoryCache) Get(ctx context.Context, key string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, exists := m.items[key]
	if !exists || (!item.expiresAt.IsZero() && time.Now().After(item.expiresAt)) {
		return "", redis.Nil
	}

	switch v := item.value.(type) {
	case string:
		return v, nil
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}
}

func (m *memoryCache) Delete(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.items, key)
	return nil
}

func (m *memoryCache) SetNonce(ctx context.Context, nonce string, ttl time.Duration) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := "nonce:" + nonce
	now := time.Now()
	item, exists := m.items[key]
	if exists && (item.expiresAt.IsZero() || item.expiresAt.After(now)) {
		// Nonce already exists - Replay detected!
		return false, nil
	}

	m.items[key] = memItem{value: "1", expiresAt: now.Add(ttl)}
	return true, nil
}

func (m *memoryCache) IncrementRateLimit(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	item, exists := m.items[key]
	var count int64 = 1

	if exists && (item.expiresAt.IsZero() || item.expiresAt.After(now)) {
		if c, ok := item.value.(int64); ok {
			count = c + 1
		}
		m.items[key] = memItem{value: count, expiresAt: item.expiresAt}
	} else {
		m.items[key] = memItem{value: count, expiresAt: now.Add(ttl)}
	}

	return count, nil
}

func (m *memoryCache) StoreSession(ctx context.Context, token string, data *SessionData, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.items["session:"+token] = memItem{value: *data, expiresAt: time.Now().Add(ttl)}
	return nil
}

func (m *memoryCache) GetSession(ctx context.Context, token string) (*SessionData, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, exists := m.items["session:"+token]
	if !exists || (!item.expiresAt.IsZero() && time.Now().After(item.expiresAt)) {
		return nil, redis.Nil
	}

	if sess, ok := item.value.(SessionData); ok {
		return &sess, nil
	}
	return nil, redis.Nil
}

func (m *memoryCache) DeleteSession(ctx context.Context, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.items, "session:"+token)
	return nil
}
