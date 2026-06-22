import { GlobalWebSocketProvider } from "@/components/providers/GlobalWebSocketProvider";
import GlobalAudioPlayer from "@/components/providers/GlobalAudioPlayer";
import AppShell from "@/components/layout/AppShell";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <GlobalWebSocketProvider>
      <GlobalAudioPlayer />
      <AppShell>{children}</AppShell>
    </GlobalWebSocketProvider>
  );
};

export default MainLayout;
