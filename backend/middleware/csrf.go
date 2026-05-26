package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

func CSRFMiddleware(frontendURL string) gin.HandlerFunc {
	frontendOrigin := normalizeOrigin(frontendURL)

	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		default:
			c.Next()
			return
		}

		reqOrigin := requestOrigin(c.Request)

		origin := normalizeOrigin(c.GetHeader("Origin"))
		if origin != "" {
			if isAllowedOrigin(origin, frontendOrigin, reqOrigin) {
				c.Next()
				return
			}
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "origin not allowed"})
			return
		}

		referer := normalizeOrigin(c.GetHeader("Referer"))
		if referer != "" {
			if isAllowedOrigin(referer, frontendOrigin, reqOrigin) {
				c.Next()
				return
			}
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "referer not allowed"})
			return
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "missing csrf origin"})
	}
}

func isAllowedOrigin(origin, frontendOrigin, requestOrigin string) bool {
	if origin == "" {
		return false
	}
	if requestOrigin != "" && origin == requestOrigin {
		return true
	}
	if frontendOrigin != "" && origin == frontendOrigin {
		return true
	}
	return false
}

func normalizeOrigin(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	u, err := url.Parse(trimmed)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return strings.ToLower(u.Scheme) + "://" + strings.ToLower(u.Host)
}

func requestOrigin(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	} else if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https") {
		scheme = "https"
	}

	host := strings.TrimSpace(r.Host)
	if host == "" {
		return ""
	}
	return strings.ToLower(scheme) + "://" + strings.ToLower(host)
}
