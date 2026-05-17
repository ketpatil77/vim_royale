package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/patrickmn/go-cache"
)

type visitor struct {
	Count int
}

func RateLimitMiddleware(limit int, window time.Duration) gin.HandlerFunc {
	store := cache.New(window, 10*time.Minute)

	return func(c *gin.Context) {
		ip := c.ClientIP()

		v, found := store.Get(ip)

		if !found {
			store.Set(ip, &visitor{Count: 1}, window)
			c.Next()
			return
		}

		visitor := v.(*visitor)

		if visitor.Count >= limit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests",
			})
			return
		}

		visitor.Count++

		c.Next()
	}
}
