'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Database,
  Users,
  Key,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { name: 'Buckets', href: '/app/buckets', icon: Database },
  { name: 'Users', href: '/app/users', icon: Users },
  { name: 'Access Keys', href: '/app/access-keys', icon: Key },
  { name: 'Analytics', href: '/app/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/app/settings', icon: Settings },
];

export interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => {
    onCollapsedChange?.(!collapsed);
  };

  const toggleMobile = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Database className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold">V2-Bucket</span>
            </div>
          )}

          {/* Desktop collapse button */}
          <button
            onClick={toggleCollapse}
            className="rounded-md p-2 hover:bg-accent"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navigation.map((item) => {
            // Special handling for dashboard home page - only exact match
            const isActive = item.href === '/app'
              ? pathname === '/app'
              : pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <div
            className={cn(
              'flex items-center gap-3',
              collapsed && 'justify-center'
            )}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              A
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">Admin User</p>
                <p className="truncate text-xs text-muted-foreground">
                  admin@v2bucket.com
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
