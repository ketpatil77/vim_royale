1. user:
    a. user_id: UUID
    b. github_id: string
    c. discord_id: string
    d. twitter_id: string
    e. username: string
    f. matches_played: integer
    g. wins: integer
    h. losses: integer
    i. created_at: timestamp
    j. last_active: timestamp

2. match:
    a. match_id: UUID
    b. player_a_id: UUID
    c. player_b_id: UUID
    d. winner_id: UUID
    e. created_at: timestamp
    f. updated_at: timestamp
    g. finished_at: timestamp
    