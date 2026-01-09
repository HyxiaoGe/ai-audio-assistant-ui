import { GlobalWebSocketProvider } from "@/components/providers/GlobalWebSocketProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import GlobalAudioPlayer from "@/components/providers/GlobalAudioPlayer";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <GlobalWebSocketProvider>
      <ToastProvider />
      <GlobalAudioPlayer />
      {children}
    </GlobalWebSocketProvider>
  );
};

export default MainLayout;
