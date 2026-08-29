export {};

type AsymptaBridgeFeatureCollection = {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
};

type AsymptaBridgeGeoJsonSource = {
  setData(data: AsymptaBridgeFeatureCollection): void;
};

declare global {
  interface Window {
    __ASYMPTA_MAP__?: {
      on(event: string, handler: () => void): void;
      addSource(id: string, source: { type: "geojson"; data: AsymptaBridgeFeatureCollection }): void;
      addLayer(layer: Record<string, unknown>): void;
      getSource(id: string): AsymptaBridgeGeoJsonSource | undefined;
      getBounds(): { getWest(): number; getEast(): number; getSouth(): number; getNorth(): number };
      getCenter(): { lng: number; lat: number };
      setCenter(coordinates: [number, number]): void;
      flyTo(options: Record<string, unknown>): void;
      zoomIn(options?: Record<string, unknown>): void;
      zoomOut(options?: Record<string, unknown>): void;
      remove(): void;
      touchZoomRotate: { enable(): void; disableRotation(): void };
      dragRotate: { disable(): void };
      touchPitch?: { disable(): void };
    };
  }
}
