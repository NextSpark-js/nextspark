"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from '../../ui/table';
import { cn } from '../../../lib/utils';

export interface SortState<K extends string = string> {
  key: K;
  order: 'asc' | 'desc';
}

/**
 * The sort a click on the header of `key` asks for: the same column flips its direction, another column starts in its
 * natural one (dates newest first, names A to Z).
 */
export function nextSort<K extends string>(current: SortState<K>, key: K, firstOrder: 'asc' | 'desc' = 'asc'): SortState<K> {
  return current.key === key ? { key, order: current.order === 'asc' ? 'desc' : 'asc' } : { key, order: firstOrder };
}

/** A column header that sorts the list by `sortKey` when it is clicked (the server sorts). */
export function SortableHead<K extends string>({ label, sortKey, sort, onSort, firstOrder = 'asc', className }: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  firstOrder?: 'asc' | 'desc';
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={cn("-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground")}
        onClick={() => onSort(nextSort(sort, sortKey, firstOrder))}
        data-cy={`sort-${sortKey}`}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}
