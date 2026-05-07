package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"vim_royale/backend/config"
	"vim_royale/backend/db"
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
		RedirectURL:  "http://localhost:8080/auth/google/callback",
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

	user, err := findOrCreateUser("google", userInfo["id"].(string), userInfo["email"].(string), userInfo["name"].(string), userInfo["picture"].(string))
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

	c.Header("Set-Cookie", fmt.Sprintf("token=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=%d", jwtToken, 86400*30))
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

func findOrCreateUser(provider, providerID, email, displayName, avatarURL string) (*models.User, error) {
	database, err := database.GetPostgresConnection()
	if err != nil {
		return nil, err
	}

	var user models.User
	result := database.Where("provider = ? AND provider_id = ?", provider, providerID).First(&user)

	if result.Error == nil {
		return &user, nil
	}

	user = models.User{
		Provider:    provider,
		ProviderID:  providerID,
		Email:       email,
		DisplayName: displayName,
		AvatarURL:   avatarURL,
	}

	if err := database.Create(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
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
