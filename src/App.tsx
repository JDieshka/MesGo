import { AppProvider } from './store/AppContext';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CallOverlay from './components/CallOverlay';

export default function App() {
  return (
    <AppProvider>
      <div className="h-screen w-screen flex overflow-hidden bg-gray-950 text-white">
        <Sidebar />
        <ChatWindow />
        <CallOverlay />
      </div>
    </AppProvider>
  );
}
