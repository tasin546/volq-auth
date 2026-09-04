package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/volq-auth/volq-auth/internal/models"
	"github.com/volq-auth/volq-auth/internal/service"
)

type ClientHandler struct {
	authService *service.ClientAuthService
}

func NewClientHandler(authService *service.ClientAuthService) *ClientHandler {
	return &ClientHandler{authService: authService}
}

// Init handles [POST] /api/v1/client/init
func (h *ClientHandler) Init(c *gin.Context) {
	var req models.ClientInitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid handshake payload", "details": err.Error()})
		return
	}

	resp, err := h.authService.Init(c.Request.Context(), &req, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// License handles [POST] /api/v1/client/license
func (h *ClientHandler) License(c *gin.Context) {
	var req models.ClientEncryptedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid encrypted payload format"})
		return
	}

	resp, err := h.authService.AuthenticateLicense(c.Request.Context(), req.SessionID, req.Payload, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Login handles [POST] /api/v1/client/login (Mode B)
func (h *ClientHandler) Login(c *gin.Context) {
	var req models.ClientEncryptedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid encrypted payload format"})
		return
	}

	resp, err := h.authService.AuthenticateUser(c.Request.Context(), req.SessionID, req.Payload, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Variable handles [POST] /api/v1/client/var
func (h *ClientHandler) Variable(c *gin.Context) {
	var req struct {
		SessionToken string `json:"session_token" binding:"required"`
		Payload      string `json:"payload" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	resp, err := h.authService.GetVariable(c.Request.Context(), req.SessionToken, req.Payload)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Ping handles [GET] /api/v1/client/ping (Health check)
func (h *ClientHandler) Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "online",
		"engine":  "VOLQ-Auth Core",
		"version": "1.0.0",
	})
}
