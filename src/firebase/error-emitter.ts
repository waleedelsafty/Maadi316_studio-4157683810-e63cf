
// A simple event emitter for cross-component communication.
// This is a minimalist implementation for our specific use case.

type Listener<T> = (event: T) => void;

class EventEmitter<TEventMap> {
  private listeners: { [K in keyof TEventMap]?: Listener<TEventMap[K]>[] } = {};

  on<K extends keyof TEventMap>(eventName: K, listener: Listener<TEventMap[K]>) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push(listener);
  }

  off<K extends keyof TEventMap>(eventName: K, listener: Listener<TEventMap[K]>) {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName] = this.listeners[eventName]!.filter(
      (l) => l !== listener
    );
  }

  emit<K extends keyof TEventMap>(eventName: K, event: TEventMap[K]) {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName]!.forEach((listener) => listener(event));
  }
}

interface AppEvents {
  'permission-error': Error;
}

export const errorEmitter = new EventEmitter<AppEvents>();
