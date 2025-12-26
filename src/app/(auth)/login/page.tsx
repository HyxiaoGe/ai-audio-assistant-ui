"use client";

import { useRouter } from "next/navigation";
import LoginModal from "@/components/auth/LoginModal";

const LoginPage = () => {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <LoginModal 
        isOpen
        onClose={() => router.push("/")}
        onLogin={() => {}}
      />
    </div>
  );
};

export default LoginPage;
