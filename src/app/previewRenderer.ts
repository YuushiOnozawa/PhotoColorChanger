import { hexToRgb } from "./color";
import { replaceSimilarColors } from "./colorReplacement";
import { fitImageDimensions } from "./imageLoader";

export type RgbColor = readonly [number, number, number];
export type PreviewRendererKind = "webgl2" | "webgl" | "2d";

export interface PreviewRenderOptions {
  source: CanvasImageSource;
  width: number;
  height: number;
  targetColor: RgbColor | null;
  replacementColor: RgbColor;
  tolerance: number;
}

export interface PreviewRenderer {
  readonly kind: PreviewRendererKind;
  render(options: PreviewRenderOptions): void;
  pick(x: number, y: number): RgbColor | null;
  dispose(): void;
}

const DESKTOP_PREVIEW_MAX_EDGE = 4096;
const MOBILE_PREVIEW_MAX_EDGE = 2048;

const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
varying vec2 v_texcoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texcoord = a_texcoord;
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_image;
uniform vec3 u_target;
uniform vec3 u_replacement;
uniform float u_tolerance;
uniform bool u_hasTarget;
varying vec2 v_texcoord;

void main() {
  vec4 source = texture2D(u_image, v_texcoord);
  float colorDistance = distance(source.rgb, u_target);
  gl_FragColor = u_hasTarget && colorDistance <= u_tolerance
    ? vec4(u_replacement, source.a)
    : source;
}
`;

export function getPreviewMaxEdge(viewportWidth: number): number {
  return viewportWidth <= 640 ? MOBILE_PREVIEW_MAX_EDGE : DESKTOP_PREVIEW_MAX_EDGE;
}

function getPreviewDimensions(width: number, height: number, maxEdge: number) {
  return fitImageDimensions(width, height, maxEdge);
}

function createSourceCanvas(): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is unavailable");
  return { canvas, context };
}

function createShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader creation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext | WebGL2RenderingContext): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL program creation failed");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "unknown program error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function createWebGLRenderer(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  kind: "webgl" | "webgl2",
  maxPreviewEdge: number,
): PreviewRenderer {
  const program = createProgram(gl);
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
  const imageLocation = gl.getUniformLocation(program, "u_image");
  const targetLocation = gl.getUniformLocation(program, "u_target");
  const replacementLocation = gl.getUniformLocation(program, "u_replacement");
  const toleranceLocation = gl.getUniformLocation(program, "u_tolerance");
  const hasTargetLocation = gl.getUniformLocation(program, "u_hasTarget");
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (
    positionLocation < 0 ||
    texcoordLocation < 0 ||
    !imageLocation ||
    !targetLocation ||
    !replacementLocation ||
    !toleranceLocation ||
    !hasTargetLocation ||
    !buffer ||
    !texture
  ) {
    throw new Error("WebGL resource creation failed");
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(texcoordLocation);
  gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 16, 8);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(imageLocation, 0);

  const sourceData = createSourceCanvas();
  let source: CanvasImageSource | null = null;
  let sourceWidth = 0;
  let sourceHeight = 0;

  const ensureSource = (options: PreviewRenderOptions) => {
    const dimensions = getPreviewDimensions(options.width, options.height, maxPreviewEdge);
    if (
      source !== options.source ||
      sourceWidth !== dimensions.width ||
      sourceHeight !== dimensions.height
    ) {
      sourceData.canvas.width = dimensions.width;
      sourceData.canvas.height = dimensions.height;
      sourceData.context.drawImage(options.source, 0, 0, dimensions.width, dimensions.height);
      source = options.source;
      sourceWidth = dimensions.width;
      sourceHeight = dimensions.height;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceData.canvas);
    }
    return dimensions;
  };

  return {
    kind,
    render(options) {
      const dimensions = getPreviewDimensions(options.width, options.height, maxPreviewEdge);
      if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
      }
      ensureSource(options);
      gl.viewport(0, 0, dimensions.width, dimensions.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(texcoordLocation);
      gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 16, 8);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const targetColor = options.targetColor ?? [0, 0, 0];
      gl.uniform3fv(
        targetLocation,
        targetColor.map((component) => component / 255),
      );
      gl.uniform3fv(
        replacementLocation,
        options.replacementColor.map((component) => component / 255),
      );
      gl.uniform1f(
        toleranceLocation,
        (Math.max(0, Math.min(100, options.tolerance)) / 100) * Math.sqrt(3) + Math.sqrt(3) / 255,
      );
      gl.uniform1i(hasTargetLocation, options.targetColor ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    pick(x, y) {
      if (x < 0 || y < 0 || x >= sourceData.canvas.width || y >= sourceData.canvas.height) {
        return null;
      }
      const [red, green, blue] = sourceData.context.getImageData(x, y, 1, 1).data;
      return [red, green, blue];
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

function create2DRenderer(canvas: HTMLCanvasElement, maxPreviewEdge: number): PreviewRenderer {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is unavailable");
  const sourceData = createSourceCanvas();
  let source: CanvasImageSource | null = null;
  let sourceWidth = 0;
  let sourceHeight = 0;

  const ensureSource = (options: PreviewRenderOptions) => {
    const dimensions = getPreviewDimensions(options.width, options.height, maxPreviewEdge);
    if (
      source !== options.source ||
      sourceWidth !== dimensions.width ||
      sourceHeight !== dimensions.height
    ) {
      sourceData.canvas.width = dimensions.width;
      sourceData.canvas.height = dimensions.height;
      sourceData.context.drawImage(options.source, 0, 0, dimensions.width, dimensions.height);
      source = options.source;
      sourceWidth = dimensions.width;
      sourceHeight = dimensions.height;
    }
    return dimensions;
  };

  return {
    kind: "2d",
    render(options) {
      const dimensions = ensureSource(options);
      if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
      }
      context.clearRect(0, 0, dimensions.width, dimensions.height);
      context.drawImage(sourceData.canvas, 0, 0);
      if (!options.targetColor) return;

      const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);
      imageData.data.set(
        replaceSimilarColors(
          imageData.data,
          options.targetColor,
          options.replacementColor,
          options.tolerance,
        ),
      );
      context.putImageData(imageData, 0, 0);
    },
    pick(x, y) {
      if (x < 0 || y < 0 || x >= sourceData.canvas.width || y >= sourceData.canvas.height) {
        return null;
      }
      const [red, green, blue] = sourceData.context.getImageData(x, y, 1, 1).data;
      return [red, green, blue];
    },
    dispose() {},
  };
}

export function createPreviewRenderer(
  canvas: HTMLCanvasElement,
  maxPreviewEdge: number,
): PreviewRenderer {
  const webgl2 = canvas.getContext("webgl2");
  if (webgl2) return createWebGLRenderer(canvas, webgl2, "webgl2", maxPreviewEdge);

  const webgl = canvas.getContext("webgl");
  if (webgl) return createWebGLRenderer(canvas, webgl, "webgl", maxPreviewEdge);

  return create2DRenderer(canvas, maxPreviewEdge);
}

export function replacementColorFromHex(hex: string): RgbColor {
  return hexToRgb(hex) ?? [255, 255, 255];
}
