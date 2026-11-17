const degrees = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

const formatDegrees = (value: number) => `${degrees.format(value).replace("-", "−")}°`;

export const ROTATION_SPHERE_COPY = {
  label: "Camera rotation",
  roleDescription: "rotation sphere",
  axes: { rotateX: "X", rotateY: "Y", rotateZ: "Z" },
  valueText: (x: number, y: number, z: number) =>
    `X ${formatDegrees(x)}, Y ${formatDegrees(y)}, Z ${formatDegrees(z)}`,
  instructions:
    "Drag the sphere to turn, drag the ring to roll, hold Shift to snap to 15°. Arrow keys turn, [ and ] roll. Double-click to reset.",
};
