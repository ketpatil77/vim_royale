package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"vim_royale/backend/config"
	database "vim_royale/backend/db"
	"vim_royale/backend/middleware"
	"vim_royale/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var googleOAuthConfig *oauth2.Config

func initGoogleOAuth() {
	googleOAuthConfig = &oauth2.Config{
		ClientID:     config.GoogleClientID,
		ClientSecret: config.GoogleClientSecret,
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
		RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
	}
}

func GoogleLogin(c *gin.Context) {
	if googleOAuthConfig == nil {
		initGoogleOAuth()
	}

	url := googleOAuthConfig.AuthCodeURL("state", oauth2.AccessTypeOffline)
	c.Redirect(http.StatusFound, url)
}

func GoogleCallback(c *gin.Context) {
	if googleOAuthConfig == nil {
		initGoogleOAuth()
	}

	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
		return
	}

	token, err := googleOAuthConfig.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("Google token exchange error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to exchange code"})
		return
	}

	userInfo, err := getGoogleUserInfo(token.AccessToken)
	if err != nil {
		log.Printf("Google user info error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info"})
		return
	}

	user, err := database.FindOrCreateUser("google", userInfo["id"].(string), userInfo["email"].(string), userInfo["name"].(string), userInfo["picture"].(string))
	if err != nil {
		log.Printf("User creation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	jwtToken, err := generateJWT(user)
	if err != nil {
		log.Printf("JWT generation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.Header("Set-Cookie", fmt.Sprintf(
		"token=%s; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=%d",
		jwtToken,
		86400*30,
	))
	c.Redirect(http.StatusFound, config.FrontendURL)
}

type GoogleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func getGoogleUserInfo(accessToken string) (map[string]interface{}, error) {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var userInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	return userInfo, nil
}

func generateJWT(user *models.User) (string, error) {
	claims := &middleware.Claims{
		UserID:     user.ID,
		Provider:   user.Provider,
		ProviderID: user.ProviderID,
		Email:      user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.JWTSecret))
}
