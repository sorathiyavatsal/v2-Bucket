'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  BarChart3,
  Settings,
  User,
  LogOut,
  X,
  Bell,
  Search,
} from 'lucide-react';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const moreOptions = [
  { name: 'Analytics', href: '/app/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/app/settings', icon: Settings },
];

const notifications = [
  {
    id: '1',
    title: 'New bucket created',
    time: '2 minutes ago',
  },
  {
    id: '2',
    title: 'Upload completed',
    time: '1 hour ago',
  },
  {
    id: '3',
    title: 'Storage limit warning',
    time: '3 hours ago',
  },
];

export function BottomSheet({ open, onOpenChange }: BottomSheetProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');

  // Prevent body scroll when bottom sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 lg:hidden"
        onClick={() => onOpenChange(false)}
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-lg transition-transform duration-300 lg:hidden',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 border-b">
          <h2 className="text-lg font-semibold">More Options</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-2 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search buckets, objects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>

          {/* Notifications Section */}
          <div className="space-y-1 mb-6">
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Notifications
              </p>
              <Badge size="sm" variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {notifications.length}
              </Badge>
            </div>
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex flex-col gap-1 rounded-lg px-3 py-3 hover:bg-accent cursor-pointer transition-colors"
              >
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="text-xs text-muted-foreground">{notification.time}</p>
              </div>
            ))}
            <button className="w-full text-center rounded-lg px-3 py-3 text-sm font-medium text-primary hover:bg-accent transition-colors">
              View all notifications
            </button>
          </div>

          {/* Navigation Options */}
          <div className="space-y-1 mb-6 pt-4 border-t">
            <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
              More
            </p>
            {moreOptions.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Account Section */}
          <div className="space-y-1 pt-4 border-t">
            <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
              Account
            </p>

            {/* User Profile */}
            <div className="flex items-center gap-3 rounded-lg px-3 py-3 bg-muted/50">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                A
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-muted-foreground truncate">
                  admin@v2bucket.com
                </p>
              </div>
            </div>

            {/* Profile Link */}
            <Link
              href="/app/profile"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span>Profile</span>
            </Link>

            {/* Logout */}
            <button
              onClick={() => {
                onOpenChange(false);
                // TODO: Implement logout
                console.log('Logout clicked');
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* Safe area for mobile devices */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </>
  );
}
