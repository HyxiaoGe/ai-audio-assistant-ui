/**
 * JWT Token Utility
 * Provides JWT token generation for API authentication
 */

import { SignJWT } from "jose"

// JWT configuration from backend
const JWT_SECRET = "9NwhcmWIAS1kl8zt0jNU4TYcBgw5y0LG/jhESox3H+I="
const JWT_ALGORITHM = "HS256"
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60

/**
 * Sign JWT token
 * @param userId - User ID (UUID)
 */
export async function signJWT(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN_SECONDS
  const secret = new TextEncoder().encode(JWT_SECRET)

  return await new SignJWT({ sub: userId, exp })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .sign(secret)
}

/**
 * Get or generate a JWT token
 */
export async function getAuthToken(userId: string): Promise<string> {
  return await signJWT(userId)
}
