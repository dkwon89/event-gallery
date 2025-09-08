// Lightweight cache for gallery listings
interface CachedListing {
  files: Array<{
    name: string;
    id: string;
    created_at: string;
    size: number;
  }>;
  timestamp: number;
  eventCode: string;
}

// Module-level cache
const cache = new Map<string, CachedListing>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const EMPTY_REVALIDATION_INTERVAL = 15 * 1000; // 15 seconds

// Cache management
export function getCachedListing(eventCode: string): CachedListing | null {
  const cached = cache.get(eventCode);
  if (!cached) return null;
  
  // Check if cache is still valid
  const now = Date.now();
  if (now - cached.timestamp > CACHE_DURATION) {
    cache.delete(eventCode);
    return null;
  }
  
  return cached;
}

export function setCachedListing(eventCode: string, files: CachedListing['files']): void {
  cache.set(eventCode, {
    files,
    timestamp: Date.now(),
    eventCode
  });
}

export function invalidateCache(eventCode: string): void {
  cache.delete(eventCode);
}

export function clearCache(): void {
  cache.clear();
}

// Debounce utility
export function createDebouncedFunction<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

// Interval management for empty galleries
const intervals = new Map<string, NodeJS.Timeout>();

export function startEmptyGalleryRevalidation(
  eventCode: string,
  revalidateCallback: () => void
): void {
  // Clear existing interval if any
  stopEmptyGalleryRevalidation(eventCode);
  
  const interval = setInterval(revalidateCallback, EMPTY_REVALIDATION_INTERVAL);
  intervals.set(eventCode, interval);
}

export function stopEmptyGalleryRevalidation(eventCode: string): void {
  const interval = intervals.get(eventCode);
  if (interval) {
    clearInterval(interval);
    intervals.delete(eventCode);
  }
}

export function cleanupAllIntervals(): void {
  intervals.forEach(interval => clearInterval(interval));
  intervals.clear();
}
