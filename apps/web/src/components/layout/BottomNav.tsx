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
  MoreHorizontal,
} from 'lucide-react';
import { BottomSheet } from './BottomSheet';

const mainNavigation = [
  { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
  { name: 'Buckets', href: '/app/buckets', icon: Database },
  { name: 'Users', href: '/app/users', icon: Users },
  { name: 'Keys', href: '/app/access-keys', icon: Key },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card lg:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {mainNavigation.map((item) => {
            const isActive = item.href === '/app'
              ? pathname === '/app'
              : pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'fill-primary/20')} />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground min-w-[64px]"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet for More Options */}
      <BottomSheet open={isMoreOpen} onOpenChange={setIsMoreOpen} />
    </>
  );
}
