import { Firestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from './firebase';

class SyncTracker {
  private count = parseInt(localStorage.getItem('sync_pending_count') || '0', 10);
  private listeners: ((count: number) => void)[] = [];

  get pendingCount() {
    return this.count;
  }

  increment() {
    this.count++;
    localStorage.setItem('sync_pending_count', this.count.toString());
    this.notify();
  }

  decrement() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      localStorage.removeItem('sync_pending_count');
    } else {
      localStorage.setItem('sync_pending_count', this.count.toString());
    }
    this.notify();
  }

  subscribe(listener: (count: number) => void) {
    this.listeners.push(listener);
    // Initial notify for new subscribers
    listener(this.count);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.count));
  }

  track<T>(promise: Promise<T>): Promise<T> {
    this.increment();
    return promise.finally(() => {
      this.decrement();
    });
  }

  async forceSync() {
    try {
      // Toggle network to force Firestore to reconnect and flush pending writes
      await disableNetwork(db);
      await enableNetwork(db);
    } catch (err) {
      console.error("Error forcing sync:", err);
    }
  }

  // Helper to reset if we know we are fully synced (e.g., online and no recent activity)
  resetCount() {
    this.count = 0;
    localStorage.removeItem('sync_pending_count');
    this.notify();
  }
}

export const syncTracker = new SyncTracker();
