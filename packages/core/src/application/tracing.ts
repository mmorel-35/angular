/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {InjectionToken} from '../di/injection_token';
import {EnvironmentProviders} from '../di/interface/provider';
import {makeEnvironmentProviders} from '../di/provider_collection';
import {Type} from '../interface/type';

/**
 * Actions that can be traced by the tracing framework.
 *
 * @publicApi
 */
export enum TracingAction {
  CHANGE_DETECTION,
  AFTER_NEXT_RENDER,
}

/**
 * Represents a single tracing snapshot captured at a particular point in time.
 *
 * A `TracingSnapshot` records the tracing context when it is created and can later
 * execute work within that original context via `run()`. Each snapshot must be
 * disposed of exactly once via `dispose()`.
 *
 * @publicApi
 */
export interface TracingSnapshot {
  /**
   * Executes `fn` within the tracing context captured by this snapshot.
   * @param action The type of operation being traced.
   * @param fn The function to run in the original context.
   */
  run<T>(action: TracingAction, fn: () => T): T;

  /**
   * Releases resources held by this snapshot.
   * Must be called exactly once per `TracingSnapshot` instance.
   */
  dispose(): void;
}

/**
 * Injection token for a `TracingService`.
 *
 * Provide this token with an implementation of {@link TracingService} to enable
 * Angular's built-in tracing hooks. When not provided, all tracing is a no-op.
 *
 * @usageNotes
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideTracing(MyTracingService)],
 * });
 * ```
 *
 * @publicApi
 */
export const TracingService = new InjectionToken<TracingService<TracingSnapshot>>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'TracingService' : '',
);

/**
 * Tracing mechanism which associates causes (snapshots) with subsequent
 * framework-scheduled operations such as change detection, after-render hooks,
 * component creation, DOM event listeners, and HTTP callbacks.
 *
 * Angular calls the methods of this service at well-defined lifecycle points so
 * that a concrete implementation (e.g. an OpenTelemetry adapter) can correlate
 * asynchronous work back to the user interaction or signal change that originally
 * triggered it.
 *
 * Implement this interface and provide it with {@link provideTracing} to enable
 * end-to-end tracing throughout an Angular application.
 *
 * @publicApi
 */
export interface TracingService<T extends TracingSnapshot> {
  /**
   * Take a snapshot of the current tracing context.
   *
   * Angular stores the returned snapshot and uses it when the work that was
   * scheduled in this context is eventually executed (e.g. change detection or
   * an after-render hook).
   *
   * @param linkedSnapshot An existing snapshot to link to (its disposal is
   *   transferred to the new snapshot). Pass `null` when there is no prior snapshot.
   * @return The new snapshot. The caller is responsible for disposing of it.
   */
  snapshot(linkedSnapshot: T | null): T;

  /**
   * Returns a version of `fn` that, when called, runs in the tracing context
   * that was active when `propagate()` was invoked.
   *
   * Use this to maintain context continuity across async boundaries such as XHR
   * or Fetch response callbacks.
   *
   * @param fn The function whose context should be captured.
   * @return A wrapped function that propagates the captured context.
   */
  propagate?<T extends Function>(fn: T): T;

  /**
   * Wraps a DOM event listener registered by the framework so that when the
   * listener fires it runs in the tracing context active at registration time.
   *
   * @param element The element on which the event is bound.
   * @param eventName The name of the event (e.g. `'click'`).
   * @param handler The original event handler.
   * @return A wrapped handler to use in place of the original.
   */
  wrapEventListener?<T extends Function>(element: HTMLElement, eventName: string, handler: T): T;

  /**
   * Traces the instantiation of a component.
   *
   * Angular calls this method when creating a new component instance and wraps
   * the construction inside the provided `fn` callback.
   *
   * @param className Name of the component class, or `null` for anonymous classes.
   * @param fn A function that creates and returns the component instance.
   * @return The return value of `fn`.
   */
  componentCreate?<T>(className: string | null, fn: () => T): T;
}

/**
 * Configures Angular's tracing integration with a custom `TracingService`
 * implementation.
 *
 * Call this function in the `providers` array of `bootstrapApplication()` (or
 * in the providers of an `NgModule`) to wire up your tracing backend. Angular
 * will automatically call into the service at key lifecycle points: change
 * detection, after-render hooks, component creation, DOM event listeners, and
 * HTTP callbacks.
 *
 * @usageNotes
 * ```ts
 * import {Injectable} from '@angular/core';
 * import {provideTracing, TracingService, TracingSnapshot} from '@angular/core';
 *
 * @Injectable()
 * class MyTracingService implements TracingService<TracingSnapshot> {
 *   snapshot(linkedSnapshot: TracingSnapshot | null): TracingSnapshot { ... }
 * }
 *
 * bootstrapApplication(AppComponent, {
 *   providers: [provideTracing(MyTracingService)],
 * });
 * ```
 *
 * @param service A class (injectable) that implements `TracingService`.
 * @returns Providers to include in the application configuration.
 *
 * @publicApi
 */
export function provideTracing<T extends TracingSnapshot>(
  service: Type<TracingService<T>>,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    service,
    {provide: TracingService, useExisting: service},
  ]);
}
