import { GlobalWebSocketProvider } from "@/components/providers/GlobalWebSocketProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <GlobalWebSocketProvider>
      <ToastProvider />
      {children}
    </GlobalWebSocketProvider>
  );
};

export default MainLayout;
