'use client';

import { useState } from 'react';
import { Bell, Search, User, LogOut, Settings } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
} from '@/components/ui/Dropdown';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const notificationCount = 3;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      {/* Logo/Brand - Mobile only */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-sm font-bold">V2</span>
        </div>
        <span className="text-lg font-semibold">V2-Bucket</span>
      </div>

      {/* Search - Desktop only */}
      <div className="hidden lg:flex flex-1 max-w-md">
        <div className="relative w-full">
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

      {/* Spacer */}
      <div className="flex-1 lg:hidden" />

      {/* Desktop Right side - Hidden on mobile/tablet */}
      <div className="hidden lg:flex items-center gap-2 sm:gap-4 ml-auto">
        {/* Notifications */}
        <Dropdown
          align="end"
          trigger={
            <button className="relative rounded-md p-2 hover:bg-accent">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge
                  size="sm"
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {notificationCount}
                </Badge>
              )}
            </button>
          }
        >
          <DropdownLabel>Notifications</DropdownLabel>
          <DropdownSeparator />
          <DropdownItem>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">New bucket created</p>
              <p className="text-xs text-muted-foreground">2 minutes ago</p>
            </div>
          </DropdownItem>
          <DropdownItem>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Upload completed</p>
              <p className="text-xs text-muted-foreground">1 hour ago</p>
            </div>
          </DropdownItem>
          <DropdownItem>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Storage limit warning</p>
              <p className="text-xs text-muted-foreground">3 hours ago</p>
            </div>
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem>
            <span className="text-sm font-medium text-primary">View all notifications</span>
          </DropdownItem>
        </Dropdown>

        {/* User menu */}
        <Dropdown
          align="end"
          trigger={
            <button className="flex items-center gap-2 rounded-md p-2 hover:bg-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                A
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-muted-foreground">admin@v2bucket.com</p>
              </div>
            </button>
          }
        >
          <DropdownLabel>My Account</DropdownLabel>
          <DropdownSeparator />
          <DropdownItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownItem>
          <DropdownItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem destructive>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
