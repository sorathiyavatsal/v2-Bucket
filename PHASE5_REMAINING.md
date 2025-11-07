# Phase 5 Remaining Work - Implementation Guide

## Current Status: Phase 5.2 Started (1/5 hours)

**Progress**: 172/200 hours (86%)
**Completed**: Phase 5.1 (Dashboard Setup)
**In Progress**: Phase 5.2 (UI Components) - Button created
**Remaining**: 23 hours

---

## Phase 5.2: Core UI Components (4 hours remaining)

### ✅ Created
1. **Button** - `components/ui/Button.tsx` (42 lines)
   - 6 variants: default, destructive, outline, secondary, ghost, link
   - 4 sizes: default, sm, lg, icon
   - Full TypeScript support
   - Accessible with keyboard navigation

### 🔨 To Create

**Basic UI Components** (2 hours):
```typescript
// components/ui/Card.tsx
- Card container with header, content, footer
- Variants: default, bordered, elevated
- Responsive padding

// components/ui/Badge.tsx
- Inline status indicators
- Variants: default, secondary, outline, destructive
- Sizes: sm, default, lg

// components/ui/Input.tsx
- Text input with label support
- Error state styling
- Icon support (prefix/suffix)
- Disabled and readonly states

// components/ui/Table.tsx
- Responsive table component
- Sortable columns
- Row selection
- Pagination support

// components/ui/Alert.tsx
- Notification component
- Variants: info, success, warning, error
- Dismissible option
- Icon support

// components/ui/Dialog.tsx
- Modal dialog component
- Backdrop with click-outside
- Keyboard ESC to close
- Accessible (ARIA)

// components/ui/Dropdown.tsx
- Dropdown menu
- Keyboard navigation
- Multi-level support
```

**Layout Components** (2 hours):
```typescript
// components/layout/Sidebar.tsx
- Navigation sidebar
- Collapsible
- Active route highlighting
- Icons with Lucide React

// components/layout/Header.tsx
- Top navigation bar
- User profile dropdown
- Search bar
- Notifications icon

// components/layout/DashboardLayout.tsx
- Main layout wrapper
- Sidebar + Header + Content
- Responsive mobile view
```

---

## Phase 5.3: Bucket Management UI (5 hours)

### Dashboard Structure
```
app/dashboard/
├── layout.tsx (Dashboard layout with sidebar)
├── page.tsx (Overview/home)
└── buckets/
    ├── page.tsx (Bucket list)
    └── [name]/
        └── page.tsx (Bucket details)
```

### Files to Create

**1. Dashboard Layout** (`app/dashboard/layout.tsx`):
```typescript
- Wrap with DashboardLayout component
- Protected route (check auth)
- Side navigation
```

**2. Overview Page** (`app/dashboard/page.tsx`):
```typescript
- Storage usage cards
- Recent buckets
- Quick stats
- Activity feed
```

**3. Bucket List** (`app/dashboard/buckets/page.tsx`):
```typescript
- List all buckets with Card components
- Create bucket button + Dialog
- Search/filter buckets
- Delete confirmation
- Stats: object count, total size
- Use tRPC: bucket.list, bucket.create, bucket.delete
```

**4. Bucket Details** (`app/dashboard/buckets/[name]/page.tsx`):
```typescript
- Object listing with Table
- Upload button + file picker
- Download/delete actions
- Breadcrumb navigation (folders)
- Bucket settings tab
- Use tRPC: object.list, object.upload, object.delete
```

### Components to Create

```typescript
// components/buckets/BucketList.tsx
- Grid/list of bucket cards
- Empty state
- Loading skeletons

// components/buckets/BucketCard.tsx
- Bucket info display
- Quick actions
- Storage meter

// components/buckets/CreateBucketDialog.tsx
- Form with validation (Zod)
- Region selector
- Storage class selector
- ACL selector

// components/buckets/ObjectList.tsx
- Table with columns: name, size, modified
- Folder navigation
- Row actions

// components/buckets/UploadDialog.tsx
- File picker
- Upload progress
- Multiple file support

// components/buckets/BucketSettings.tsx
- Versioning toggle
- CORS configuration
- Policy editor
```

---

## Phase 5.4: User & Access Key Management (5 hours)

### Routes
```
app/dashboard/
├── users/
│   └── page.tsx
└── access-keys/
    └── page.tsx
```

### Files to Create

**1. Users Page** (`app/dashboard/users/page.tsx`):
```typescript
- User table with filters
- Create/edit user dialog
- Quota management
- Role assignment
- Use tRPC: user.list, user.create, user.update
```

**2. Access Keys** (`app/dashboard/access-keys/page.tsx`):
```typescript
- Access key table
- Generate key dialog
- Show secret only once
- Revoke/delete keys
- Usage statistics
- Use tRPC: accessKey.list, accessKey.create, accessKey.revoke
```

### Components

```typescript
// components/users/UserList.tsx
// components/users/CreateUserDialog.tsx
// components/users/EditUserDialog.tsx
// components/access-keys/KeyList.tsx
// components/access-keys/GenerateKeyDialog.tsx
```

---

## Phase 5.5: Analytics Dashboard (5 hours)

### Routes
```
app/dashboard/
└── analytics/
    └── page.tsx
```

### Files to Create

**1. Analytics Page**:
```typescript
- Storage usage chart (Recharts)
- Object count trends
- API request metrics
- Bandwidth usage
- Top buckets by size
- Recent activity log
```

### Components

```typescript
// components/dashboard/StatsCard.tsx
- Metric display with icon
- Trend indicator
- Sparkline mini-chart

// components/dashboard/StorageChart.tsx
- Line/area chart (Recharts)
- Time range selector
- Export data button

// components/dashboard/ActivityFeed.tsx
- Recent actions list
- User avatars
- Timestamps

// components/analytics/UsageChart.tsx
// components/analytics/RequestChart.tsx
```

---

## Quick Implementation Checklist

### Phase 5.2 Remaining
- [ ] Card component
- [ ] Badge component
- [ ] Input component
- [ ] Table component
- [ ] Alert component
- [ ] Dialog component
- [ ] Dropdown component
- [ ] Sidebar component
- [ ] Header component
- [ ] DashboardLayout component

### Phase 5.3
- [ ] Dashboard layout.tsx
- [ ] Overview page
- [ ] Buckets list page
- [ ] Bucket details page
- [ ] All bucket components (6 files)

### Phase 5.4
- [ ] Users page
- [ ] Access keys page
- [ ] User components (3 files)
- [ ] Access key components (2 files)

### Phase 5.5
- [ ] Analytics page
- [ ] Dashboard components (3 files)
- [ ] Analytics components (2 files)

---

## Code Patterns to Follow

### tRPC Usage
```typescript
const { data, isLoading } = trpc.bucket.list.useQuery();
const createMutation = trpc.bucket.create.useMutation();
```

### Component Structure
```typescript
'use client'; // For interactive components

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/Button';

export function ComponentName() {
  // tRPC hooks
  // State
  // Handlers
  // Render
}
```

### File Organization
- UI components in `components/ui/`
- Feature components in `components/{feature}/`
- Pages in `app/dashboard/{feature}/`
- Use barrel exports (index.ts) for cleaner imports

---

## Testing Strategy

1. **Manual Testing**
   - Test each page in browser
   - Verify mobile responsiveness
   - Check dark mode
   - Test all CRUD operations

2. **Type Safety**
   - Run `pnpm type-check`
   - Ensure no TypeScript errors

3. **Build**
   - Run `pnpm build`
   - Verify no build errors

---

## Next Session Starter

1. Complete UI components (Card, Badge, Input, Table, Alert, Dialog, Dropdown)
2. Build layout components (Sidebar, Header, DashboardLayout)
3. Test the application runs: `cd apps/web && pnpm dev`
4. Continue with Phase 5.3

**Total Remaining**: 23 hours across 4 sub-phases
