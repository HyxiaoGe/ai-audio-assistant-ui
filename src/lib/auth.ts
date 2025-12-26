import { ProxyAgent, setGlobalDispatcher } from "undici"
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth-config"

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl))
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
