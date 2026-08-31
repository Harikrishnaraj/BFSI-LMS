export interface Page {
  page: number;
  pageSize: number;
  skip: number;
}

const DEFAULT_SIZE = 20;
const MAX_SIZE = 200;

/** Clamps caller-supplied paging so a bad ?limit can't ask for the whole table. */
export const parsePage = (query: Record<string, unknown>, defaultSize = DEFAULT_SIZE): Page => {
  const page = Math.max(1, Number(query.page) || 1);
  const requested = Number(query.limit) || defaultSize;
  const pageSize = Math.min(MAX_SIZE, Math.max(1, requested));
  return { page, pageSize, skip: (page - 1) * pageSize };
};

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
