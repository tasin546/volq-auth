package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

type WebhookPayload struct {
	Event     string                 `json:"event"`
	AppID     string                 `json:"app_id"`
	AppName   string                 `json:"app_name"`
	Actor     string                 `json:"actor"`
	IPAddress string                 `json:"ip_address"`
	Timestamp string                 `json:"timestamp"`
	Details   map[string]interface{} `json:"details"`
}

type WebhookService struct {
	client *http.Client
	queue  chan struct {
		url     string
		payload WebhookPayload
	}
}

func NewWebhookService() *WebhookService {
	s := &WebhookService{
		client: &http.Client{Timeout: 5 * time.Second},
		queue: make(chan struct {
			url     string
			payload WebhookPayload
		}, 1000),
	}

	// Start async background worker
	go s.worker()
	return s
}

func (s *WebhookService) Dispatch(webhookURL string, payload WebhookPayload) {
	if webhookURL == "" {
		return
	}

	payload.Timestamp = time.Now().Format(time.RFC3339)

	select {
	case s.queue <- struct {
		url     string
		payload WebhookPayload
	}{url: webhookURL, payload: payload}:
	default:
		log.Println("[WEBHOOK] Warning: Webhook dispatch queue is full, dropping event")
	}
}

func (s *WebhookService) worker() {
	for job := range s.queue {
		if strings.Contains(job.url, "discord.com/api/webhooks") {
			s.sendDiscordEmbed(job.url, job.payload)
		} else {
			s.sendStandardWebhook(job.url, job.payload)
		}
	}
}

func (s *WebhookService) sendDiscordEmbed(url string, p WebhookPayload) {
	// Discord embed color coding:
	// Green (0x10B981) for login/redeem, Red (0xEF4444) for tamper/mismatch, Amber (0xF59E0B) for warnings
	color := 0x3B82F6 // Default Blue
	switch p.Event {
	case "user.login", "license.redeem":
		color = 0x10B981 // Emerald Green
	case "hwid.mismatch", "client.tamper_detected", "replay.detected":
		color = 0xEF4444 // Crimson Red
	case "version.mismatch", "license.expired":
		color = 0xF59E0B // Amber
	}

	fields := []map[string]interface{}{
		{"name": "Application", "value": p.AppName, "inline": true},
		{"name": "Actor / User", "value": p.Actor, "inline": true},
		{"name": "IP Address", "value": p.IPAddress, "inline": true},
	}

	for k, v := range p.Details {
		fields = append(fields, map[string]interface{}{
			"name":   strings.Title(k),
			"value":  fmt.Sprintf("%v", v),
			"inline": true,
		})
	}

	discordBody := map[string]interface{}{
		"username":   "VOLQ-Auth Security Sentinel",
		"avatar_url": "https://raw.githubusercontent.com/volq-auth/assets/main/shield.png",
		"embeds": []map[string]interface{}{
			{
				"title":       fmt.Sprintf("Security Event: %s", p.Event),
				"color":       color,
				"fields":      fields,
				"footer":      map[string]interface{}{"text": "VOLQ-Auth Production Guard • " + p.Timestamp},
			},
		},
	}

	data, err := json.Marshal(discordBody)
	if err != nil {
		return
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err == nil && resp != nil {
		resp.Body.Close()
	}
}

func (s *WebhookService) sendStandardWebhook(url string, p WebhookPayload) {
	data, err := json.Marshal(p)
	if err != nil {
		return
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err == nil && resp != nil {
		resp.Body.Close()
	}
}
