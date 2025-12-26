export { auth as middleware } from "@/lib/auth-edge"

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*|login).*)",
  ],
}
