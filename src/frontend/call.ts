import { invoke } from '@forge/bridge';

/** Call a resolver and unwrap the body whether or not Forge adds metadata. */
export async function call<T>(name: string, payload?: Record<string, unknown>): Promise<T> {
  const res = (await invoke(name, payload)) as unknown;
  if (res && typeof res === 'object' && 'body' in res && 'metadata' in res) return (res as { body: T }).body;
  return res as T;
}
