import { AppSidebar } from '@/components/AppSidebar';
import { Dashboard } from '@/components/Dashboard';
import { ChatBar } from '@/components/ChatBar';
import { PresetModal } from '@/components/PresetModal';
import { HITLDrawer } from '@/components/HITLDrawer';

const Index = () => {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <Dashboard />
      <ChatBar />
      <PresetModal />
      <HITLDrawer />
    </div>
  );
};

export default Index;
