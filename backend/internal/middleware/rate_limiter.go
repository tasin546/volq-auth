package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/volq-auth/volq-auth/internal/cache"
)

// RateLimiter enforces sliding-window rate limits per IP
func RateLimiter(c cache.Cache, maxRequests int64, window time.Duration) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		clientIP := ctx.ClientIP()
		key := fmt.Sprintf("ratelimit:%s:%s", clientIP, ctx.FullPath())

		count, err := c.IncrementRateLimit(ctx.Request.Context(), key, window)
		if err != nil {
			// Fail open on cache error to avoid blocking valid traffic
			ctx.Next()
			return
		}

		if count > maxRequests {
			ctx.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "Too Many Requests",
				"message": fmt.Sprintf("Rate limit exceeded. Maximum %d requests per %s allowed.", maxRequests, window.String()),
			})
			return
		}

		ctx.Next()
	}
}
