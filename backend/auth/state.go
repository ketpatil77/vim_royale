package auth

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const oauthStateCookieName = "oauth_state"

func issueOAuthState(c *gin.Context) (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	state := base64.RawURLEncoding.EncodeToString(buf)
	secure := isSecureRequest(c)
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(oauthStateCookieName, state, 600, "/", "", secure, true)
	return state, nil
}

func verifyAndClearOAuthState(c *gin.Context) bool {
	expected, err := c.Cookie(oauthStateCookieName)
	if err != nil || strings.TrimSpace(expected) == "" {
		return false
	}

	actual := strings.TrimSpace(c.Query("state"))
	secure := isSecureRequest(c)
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(oauthStateCookieName, "", -1, "/", "", secure, true)
	return actual != "" && expected == actual
}

func isSecureRequest(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")), "https")
}
