export function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((component) => component.toString(16).padStart(2, "0"))
    .join("")}`;
}
