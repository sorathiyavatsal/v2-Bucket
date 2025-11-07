'use client';

import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);

    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar - Hidden on mobile/tablet */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      </div>

      {/* Main content area */}
      <div
        className="flex flex-1 flex-col overflow-hidden transition-all duration-300 w-full"
        style={{
          marginLeft: isDesktop && !sidebarCollapsed ? '16rem' : isDesktop && sidebarCollapsed ? '4rem' : '0',
        }}
      >
        {/* Header */}
        <Header />

        {/* Page content - Add bottom padding for mobile nav */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile/Tablet Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
