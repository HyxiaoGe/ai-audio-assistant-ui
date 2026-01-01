"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import LoginModal from "@/components/auth/LoginModal"

export default function LoginPage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <LoginModal
      isOpen={open}
      onClose={() => {
        setOpen(false)
        router.push("/")
      }}
      callbackUrl="/tasks"
    />
  )
}
