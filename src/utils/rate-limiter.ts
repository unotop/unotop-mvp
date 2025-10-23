/**
 * Rate limiter for projection submissions
 * Tracks submissions in localStorage and enforces limits
 */

const STORAGE_KEY = 'unotop:submission-tracker';
const MAX_SUBMISSIONS_PER_MONTH = 2;

interface SubmissionTracker {
  count: number;
  resetDate: string; // ISO date when counter resets
  lastSubmission: string; // ISO timestamp of last submission
}

/**
 * Get current submission tracker from localStorage
 */
function getTracker(): SubmissionTracker {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return createNewTracker();
    }

    const tracker: SubmissionTracker = JSON.parse(stored);
    
    // Check if reset date has passed
    const resetDate = new Date(tracker.resetDate);
    const now = new Date();
    
    if (now >= resetDate) {
      // Month has passed, reset counter
      return createNewTracker();
    }

    return tracker;
  } catch (error) {
    console.error('[RateLimiter] Error reading tracker:', error);
    return createNewTracker();
  }
}

/**
 * Create new tracker with reset date set to next month
 */
function createNewTracker(): SubmissionTracker {
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1); // First day of next month
  nextMonth.setHours(0, 0, 0, 0);

  return {
    count: 0,
    resetDate: nextMonth.toISOString(),
    lastSubmission: '',
  };
}

/**
 * Save tracker to localStorage
 */
function saveTracker(tracker: SubmissionTracker): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracker));
  } catch (error) {
    console.error('[RateLimiter] Error saving tracker:', error);
  }
}

/**
 * Check if user can submit (has attempts left)
 */
export function canSubmit(): boolean {
  const tracker = getTracker();
  return tracker.count < MAX_SUBMISSIONS_PER_MONTH;
}

/**
 * Get remaining submissions count
 */
export function getRemainingSubmissions(): number {
  const tracker = getTracker();
  return Math.max(0, MAX_SUBMISSIONS_PER_MONTH - tracker.count);
}

/**
 * Get human-readable reset date
 */
export function getResetDate(): string {
  const tracker = getTracker();
  const resetDate = new Date(tracker.resetDate);
  return resetDate.toLocaleDateString('sk-SK', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

/**
 * Record a successful submission
 */
export function recordSubmission(): void {
  const tracker = getTracker();
  tracker.count += 1;
  tracker.lastSubmission = new Date().toISOString();
  saveTracker(tracker);
  
  console.log(`[RateLimiter] Submission recorded. Count: ${tracker.count}/${MAX_SUBMISSIONS_PER_MONTH}`);
}

/**
 * Get submission info for UI display
 */
export function getSubmissionInfo() {
  const tracker = getTracker();
  const remaining = getRemainingSubmissions();
  const resetDate = getResetDate();
  
  return {
    count: tracker.count,
    max: MAX_SUBMISSIONS_PER_MONTH,
    remaining,
    resetDate,
    canSubmit: remaining > 0,
    lastSubmission: tracker.lastSubmission ? new Date(tracker.lastSubmission) : null,
  };
}

/**
 * Reset tracker (for testing/admin purposes)
 */
export function resetTracker(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[RateLimiter] Tracker reset');
}
