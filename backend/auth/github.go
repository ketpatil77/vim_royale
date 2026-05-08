package auth

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	database "vim_royale/backend/db"
	"vim_royale/backend/config"

	"github.com/gin-gonic/gin"
)

var gitHubOAuthConfig = &oauth2Config{
	ClientID:     config.GitHubClientID,
	ClientSecret: config.GitHubClientSecret,
	Scopes:       []string{"user:email"},
	AuthURL:      "https://github.com/login/oauth/authorize",
	TokenURL:     "https://github.com/login/oauth/access_token",
}

type oauth2Config struct {
	ClientID     string
	ClientSecret string
	Scopes       []string
	AuthURL      string
	TokenURL     string
}

func (c *oauth2Config) AuthCodeURL(state string) string {
	scopes := ""
	for i, s := range c.Scopes {
		if i > 0 {
			scopes += "+"
		}
		scopes += s
	}
	return c.AuthURL + "?client_id=" + c.ClientID + "&scope=" + scopes + "&state=" + state
}

func GitHubLogin(c *gin.Context) {
	url := gitHubOAuthConfig.AuthCodeURL("state")
	c.Redirect(http.StatusFound, url)
}

func GitHubCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
		return
	}

	token, err := exchangeGitHubToken(code)
	if err != nil {
		log.Printf("GitHub token exchange error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to exchange code"})
		return
	}

	userInfo, err := getGitHubUserInfo(token)
	if err != nil {
		log.Printf("GitHub user info error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user info"})
		return
	}

	email := userInfo["email"].(string)
	if email == "" {
		email = userInfo["login"].(string) + "@github.local"
	}

	user, err := database.FindOrCreateUser("github", userInfo["id"].(string), email, userInfo["name"].(string), userInfo["avatar_url"].(string))
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

func exchangeGitHubToken(code string) (string, error) {
	resp, err := http.PostForm(gitHubOAuthConfig.TokenURL, map[string][]string{
		"client_id":     {gitHubOAuthConfig.ClientID},
		"client_secret": {gitHubOAuthConfig.ClientSecret},
		"code":          {code},
	})
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.AccessToken, nil
}

func getGitHubUserInfo(accessToken string) (map[string]interface{}, error) {
	req, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var userInfo map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	emailResp, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err == nil {
		emailResp.Header.Set("Authorization", "Bearer "+accessToken)
		emailResp.Header.Set("Accept", "application/vnd.github.v3+json")
		emailResp.Header.Set("User-Agent", "vim-royale")

		emailResult, err := http.DefaultClient.Do(emailResp)
		if err == nil {
			defer emailResult.Body.Close()
			var emails []struct {
				Email   string `json:"email"`
				Primary bool   `json:"primary"`
			}
			if json.NewDecoder(emailResult.Body).Decode(&emails) == nil {
				for _, e := range emails {
					if e.Primary && e.Email != "" {
						userInfo["email"] = e.Email
						break
					}
				}
			}
		}
	}

	return userInfo, nil
}
