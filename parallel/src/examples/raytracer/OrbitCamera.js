export const homeView = Object.freeze({ yaw: 0, pitch: Math.atan2(2.1, 8.8) });

export function orbitView(view, dx, dy) {
  const yaw = view.yaw - dx * 0.006;
  return {
    yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
    pitch: Math.max(0.09, Math.min(1.1, view.pitch + dy * 0.005)),
  };
}

export function cameraPosition(view) {
  // Preserve the approved composition exactly, including after Reset view.
  if (view.yaw === homeView.yaw && view.pitch === homeView.pitch) return [0, 3.05, 8.8];
  const radius = Math.hypot(2.1, 8.8), horizontal = radius * Math.cos(view.pitch);
  return [horizontal * Math.sin(view.yaw), 0.95 + radius * Math.sin(view.pitch), horizontal * Math.cos(view.yaw)];
}
