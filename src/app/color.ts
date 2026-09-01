export function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((component) => component.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([\da-f]{6})$/i.exec(hex);
  if (!match) return null;

  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}
