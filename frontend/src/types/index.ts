export interface UserProfile {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string | null
  rating: number
  matches: number
  won: number
  lost: number
  lastActive: string
  githubId?: string | null
  twitterId?: string | null
  discordId?: string | null
}

export interface LeaderboardEntry {
  user_id: number
  displayName: string | null
  rating: number
  username: string
  avatarUrl: string | null
}

export type EditableProfileFields = Pick<UserProfile, "displayName" | "avatarUrl" | "githubId" | "twitterId" | "discordId">;

export interface UserLiveStatus {
  isLive: boolean
  liveMatchId: string | null
  liveMode: string | null
}
