import type { NextAuthConfig } from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"

export const authConfig: NextAuthConfig = {
  debug: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account?.provider || !account?.providerAccountId) {
        return false
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL
      if (!baseUrl) {
        return false
      }

      const syncUrl = /\/api\/v1\/?$/.test(baseUrl)
        ? `${baseUrl}/auth/sync`
        : `${baseUrl}/api/v1/auth/sync`

      try {
        const res = await fetch(syncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: account.provider,
            provider_account_id: account.providerAccountId,
            email: user.email,
            name: user.name,
            avatar_url: user.image,
          }),
        })

        if (!res.ok) {
          return false
        }

        const data = await res.json()
        if (data.code !== 0 || !data.data?.user_id) {
          return false
        }

        ;(user as { id?: string }).id = data.data.user_id
        return true
      } catch {
        return false
      }
    },
    async jwt({ token, user }) {
      if (user) {
        ;(token as { sub?: string }).sub = (user as { id?: string }).id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        ;(session.user as { id?: string }).id = token.sub
      }
      return session
    },
    authorized() {
      return true
    },
  },
}
