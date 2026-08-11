/**
 * Lets `node --experimental-strip-types` run the engine tests directly: the
 * source uses bundler-style extensionless imports, which Node's resolver
 * rejects. No test framework, no dependency — just the resolution rule Vite
 * already applies.
 */
import { register } from 'node:module';

// Already a file: URL — re-running it through pathToFileURL would double the
// drive letter on Windows.
register(new URL('./ts-resolve.mjs', import.meta.url).href);
