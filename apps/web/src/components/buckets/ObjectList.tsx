'use client';

import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Folder,
  File,
  Download,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown';
import { formatBytes } from '@/lib/utils';

export interface ObjectData {
  key: string;
  size: number;
  lastModified: Date;
  isFolder?: boolean;
  etag?: string;
}

export interface ObjectListProps {
  objects: ObjectData[];
  onDownload?: (key: string) => void;
  onDelete?: (key: string) => void;
  onNavigate?: (key: string) => void;
}

export function ObjectList({ objects, onDownload, onDelete, onNavigate }: ObjectListProps) {
  const [selectedObjects, setSelectedObjects] = useState<Set<string>>(new Set());

  const toggleSelection = (key: string) => {
    const newSelection = new Set(selectedObjects);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedObjects(newSelection);
  };

  const handleRowClick = (obj: ObjectData) => {
    if (obj.isFolder) {
      onNavigate?.(obj.key);
    }
  };

  return (
    <div className="space-y-4">
      {selectedObjects.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted p-4">
          <span className="text-sm font-medium">
            {selectedObjects.size} object{selectedObjects.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedObjects(new Set())}
            >
              Clear Selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`Delete ${selectedObjects.size} object(s)?`)) {
                  selectedObjects.forEach(key => onDelete?.(key));
                  setSelectedObjects(new Set());
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={selectedObjects.size === objects.length && objects.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedObjects(new Set(objects.map(o => o.key)));
                  } else {
                    setSelectedObjects(new Set());
                  }
                }}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Last Modified</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {objects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                No objects found
              </TableCell>
            </TableRow>
          ) : (
            objects.map((obj) => (
              <TableRow
                key={obj.key}
                className={obj.isFolder ? 'cursor-pointer' : ''}
                onClick={() => handleRowClick(obj)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={selectedObjects.has(obj.key)}
                    onChange={() => toggleSelection(obj.key)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {obj.isFolder ? (
                      <Folder className="h-4 w-4 text-blue-500" />
                    ) : (
                      <File className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{obj.key}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {obj.isFolder ? '-' : formatBytes(obj.size)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {obj.lastModified.toLocaleString()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {!obj.isFolder && (
                    <Dropdown
                      align="end"
                      trigger={
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      }
                    >
                      <DropdownItem onClick={() => onDownload?.(obj.key)}>
                        <Download className="mr-2 h-4 w-4" />
                        <span>Download</span>
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem
                        destructive
                        onClick={() => {
                          if (confirm(`Delete "${obj.key}"?`)) {
                            onDelete?.(obj.key);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownItem>
                    </Dropdown>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
