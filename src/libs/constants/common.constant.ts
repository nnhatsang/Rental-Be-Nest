export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 20;
export const SortOrder = {
  asc: 'asc',
  desc: 'desc',
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];