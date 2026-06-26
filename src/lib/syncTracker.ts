import { Firestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { db } from './firebase';

class SyncTracker {
  private count = 0;
  private listeners: ((count: number) => void)[] = [];

  get pendingCount() {
    return this.count;
  }

  increment() {
    this.count++;
    this.notify();
  }

  decrement() {
    this.count = Math.max(0, this.count - 1);
    this.notify();
  }

  subscribe(listener: (count: number) => void) {
    this.listeners.push(listener);
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
}

export const syncTracker = new SyncTracker();
