package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

const authCookieName = "token"

func setAuthCookie(c *gin.Context, token string) {
	secure := isSecureRequest(c)
	if secure {
		c.SetSameSite(http.SameSiteNoneMode)
	} else {
		c.SetSameSite(http.SameSiteLaxMode)
	}
	c.SetCookie(authCookieName, token, 86400*30, "/", "", secure, true)
}

func clearAuthCookie(c *gin.Context) {
	secure := isSecureRequest(c)
	if secure {
		c.SetSameSite(http.SameSiteNoneMode)
	} else {
		c.SetSameSite(http.SameSiteLaxMode)
	}
	c.SetCookie(authCookieName, "", -1, "/", "", secure, true)
}

func ClearAuthCookie(c *gin.Context) {
	clearAuthCookie(c)
}
