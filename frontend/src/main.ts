import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/**
 * After `ng serve` recompiles, an open tab may still reference removed lazy-chunk URLs → 404.
 * One automatic reload recovers without a manual hard-refresh (dev and post-deploy).
 */
let chunkReloadAttempted = false;
function isChunkLoadFailure(reason: unknown): boolean {
  const msg =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : typeof reason === 'string'
        ? reason
        : String(reason ?? '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('ChunkLoadError')
  );
}
window.addEventListener('unhandledrejection', (event) => {
  if (chunkReloadAttempted || !isChunkLoadFailure(event.reason)) {
    return;
  }
  chunkReloadAttempted = true;
  event.preventDefault();
  window.location.reload();
});

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
