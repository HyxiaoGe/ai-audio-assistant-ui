import { GlobalWebSocketProvider } from "@/components/providers/GlobalWebSocketProvider";
import GlobalAudioPlayer from "@/components/providers/GlobalAudioPlayer";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <GlobalWebSocketProvider>
      <GlobalAudioPlayer />
      {children}
    </GlobalWebSocketProvider>
  );
};

export default MainLayout;
