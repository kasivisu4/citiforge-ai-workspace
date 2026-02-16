import { AppSidebar } from '@/components/AppSidebar';
import { Canvas } from '@/components/Canvas';
import { PresetModal } from '@/components/PresetModal';
import { HITLDrawer } from '@/components/HITLDrawer';

const Index = () => {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <Canvas />
      <PresetModal />
      <HITLDrawer />
    </div>
  );
};

export default Index;
