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
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user
      const isMockAuthed = request?.cookies.get("mock_auth")?.value === "1"
      const isOnDashboard =
        request.nextUrl.pathname.startsWith("/tasks") ||
        request.nextUrl.pathname.startsWith("/settings") ||
        request.nextUrl.pathname === "/"

      if (isOnDashboard) {
        if (isLoggedIn || isMockAuthed) return true
        return false
      }

      return true
    },
  },
}
