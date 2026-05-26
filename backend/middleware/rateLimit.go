package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/patrickmn/go-cache"
)

func RateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	store := cache.New(window, 10*time.Minute)

	return func(c *gin.Context) {
		if limit <= 0 {
			c.Next()
			return
		}

		key := rateLimitKey(c)

		// Fast path for first hit in the window.
		if err := store.Add(key, 1, window); err == nil {
			c.Next()
			return
		}

		count, err := store.IncrementInt(key, 1)
		if err != nil {
			// Fallback to a safe reset if the key expired between operations
			// or had an unexpected value type.
			store.Set(key, 1, window)
			c.Next()
			return
		}

		if count > limit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests",
			})
			return
		}

		c.Next()
	}
}

func rateLimitKey(c *gin.Context) string {
	route := c.FullPath()
	if route == "" {
		route = c.Request.URL.Path
	}
	return c.ClientIP() + "|" + c.Request.Method + "|" + route
}
