/** Loaded globally via `angular.json` scripts (pannellum build). */
interface PannellumViewerInstance {
  destroy(): void;
}

declare const pannellum: {
  viewer: (
    container: string | HTMLElement,
    config: Record<string, unknown>
  ) => PannellumViewerInstance;
};
