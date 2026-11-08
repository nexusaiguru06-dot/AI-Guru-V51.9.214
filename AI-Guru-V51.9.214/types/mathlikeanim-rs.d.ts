declare module '@mathlikeanim-rs/mathlikeanim-rs' {
  const init: () => Promise<unknown>;
  export default init;
  export const VectorObjectBuilder: any;
}

declare module '@mathlikeanim-rs/renderer' {
  export const SVGScene: any;
  export const CanvasScene: any;
}
