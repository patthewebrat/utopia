// Tiny typed event emitter — the UI subscribes here; engine.advance() emits
// everything the sim queued on state.pendingEvents.

import type { EngineEvent } from './types';

export type EngineEventType = EngineEvent['type'];

type HandlerFor<T extends EngineEventType> = (e: Extract<EngineEvent, { type: T }>) => void;
type AnyHandler = (e: EngineEvent) => void;

export class EventEmitter {
  private handlers = new Map<string, Set<AnyHandler>>();

  on<T extends EngineEventType>(type: T, fn: HandlerFor<T>): () => void;
  on(type: '*', fn: AnyHandler): () => void;
  on(type: string, fn: AnyHandler): () => void {
    let set = this.handlers.get(type);
    if (!set) { set = new Set(); this.handlers.set(type, set); }
    set.add(fn);
    return () => set.delete(fn);
  }

  off(type: string, fn: AnyHandler): void {
    this.handlers.get(type)?.delete(fn);
  }

  emit(e: EngineEvent): void {
    this.handlers.get(e.type)?.forEach((fn) => fn(e));
    this.handlers.get('*')?.forEach((fn) => fn(e));
  }
}

/** the global engine event bus (UI/main subscribe to this) */
export const events = new EventEmitter();
