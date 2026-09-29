// WebGL Chroma Key Shader Program

export interface ChromaKeyParams {
  keyColor: [number, number, number]; // [R, G, B] normalized 0..1
  similarity: number; // 0..1 (YCbCr distance threshold)
  smoothness: number; // 0..1
  spill: number; // 0..1
  brightness: number; // 0.5..1.5
  contrast: number; // 0.5..1.5
}

export const DEFAULT_CHROMA_PARAMS: ChromaKeyParams = {
  keyColor: [0.35, 0.59, 0.29], // Actual studio green sampled from AGM videos
  similarity: 0.10, // Optimal cutoff in YCbCr space (suit is ~0.18, green is ~0.00)
  smoothness: 0.05,
  spill: 0.50,
  brightness: 1.0,
  contrast: 1.0,
};

export const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

export const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;

uniform vec3 u_keyColor;
uniform float u_similarity;
uniform float u_smoothness;
uniform float u_spill;
uniform float u_brightness;
uniform float u_contrast;

// Convert RGB to YCbCr
vec3 rgbToYCbCr(vec3 rgb) {
  float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  float cb = 0.564 * (rgb.b - y);
  float cr = 0.713 * (rgb.r - y);
  return vec3(y, cb, cr);
}

void main() {
  vec4 color = texture2D(u_image, v_texCoord);
  
  // Calculate chroma distance in YCbCr space (chroma Cb, Cr only)
  vec3 keyYCbCr = rgbToYCbCr(u_keyColor);
  vec3 pixelYCbCr = rgbToYCbCr(color.rgb);
  
  float chromaDist = distance(pixelYCbCr.yz, keyYCbCr.yz);
  
  // Smooth alpha mask: 0 when near green, 1 when presenter
  float alpha = smoothstep(u_similarity, u_similarity + u_smoothness, chromaDist);
  
  // Despill algorithm: suppress reflected green on edges/suit
  vec3 despilled = color.rgb;
  float maxNonGreen = max(despilled.r, despilled.b);
  if (despilled.g > maxNonGreen) {
    despilled.g = mix(despilled.g, maxNonGreen, u_spill);
  }
  
  // Contrast & brightness adjustment
  despilled = (despilled - 0.5) * u_contrast + 0.5;
  despilled = despilled * u_brightness;
  
  gl_FragColor = vec4(despilled * alpha, alpha);
}
`;

export class WebGLChromaKeyer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private posBuffer: WebGLBuffer | null = null;
  private texBuffer: WebGLBuffer | null = null;

  private aPosLoc: number = -1;
  private aTexLoc: number = -1;

  // Uniform locations
  private uImageLoc: WebGLUniformLocation | null = null;
  private uKeyColorLoc: WebGLUniformLocation | null = null;
  private uSimilarityLoc: WebGLUniformLocation | null = null;
  private uSmoothnessLoc: WebGLUniformLocation | null = null;
  private uSpillLoc: WebGLUniformLocation | null = null;
  private uBrightnessLoc: WebGLUniformLocation | null = null;
  private uContrastLoc: WebGLUniformLocation | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: true,
      alpha: true,
      antialias: true,
    });
    if (!gl) {
      console.warn('WebGL not supported');
      return;
    }
    this.gl = gl;
    this.init();
  }

  private init() {
    const gl = this.gl!;

    const vs = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    this.program = program;
    gl.useProgram(program);

    // Quad geometry (2 triangles covering full clip space)
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    this.aPosLoc = gl.getAttribLocation(program, 'a_position');

    // Texture coords (flip Y for standard WebGL video texture orientation)
    this.texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0.0, 1.0,
        1.0, 1.0,
        0.0, 0.0,
        0.0, 0.0,
        1.0, 1.0,
        1.0, 0.0,
      ]),
      gl.STATIC_DRAW
    );

    this.aTexLoc = gl.getAttribLocation(program, 'a_texCoord');

    // Texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Uniform locations
    this.uImageLoc = gl.getUniformLocation(program, 'u_image');
    this.uKeyColorLoc = gl.getUniformLocation(program, 'u_keyColor');
    this.uSimilarityLoc = gl.getUniformLocation(program, 'u_similarity');
    this.uSmoothnessLoc = gl.getUniformLocation(program, 'u_smoothness');
    this.uSpillLoc = gl.getUniformLocation(program, 'u_spill');
    this.uBrightnessLoc = gl.getUniformLocation(program, 'u_brightness');
    this.uContrastLoc = gl.getUniformLocation(program, 'u_contrast');

    // Default sampler uniform
    gl.uniform1i(this.uImageLoc, 0);
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  public render(video: HTMLVideoElement, params: ChromaKeyParams = DEFAULT_CHROMA_PARAMS) {
    const gl = this.gl;
    if (!gl || !this.program || !this.texture) return;

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Bind vertex buffers and set attribute pointers
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(this.aPosLoc);
    gl.vertexAttribPointer(this.aPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.enableVertexAttribArray(this.aTexLoc);
    gl.vertexAttribPointer(this.aTexLoc, 2, gl.FLOAT, false, 0, 0);

    // Update uniforms
    gl.uniform1i(this.uImageLoc, 0);
    gl.uniform3fv(this.uKeyColorLoc, params.keyColor);
    gl.uniform1f(this.uSimilarityLoc, params.similarity);
    gl.uniform1f(this.uSmoothnessLoc, params.smoothness);
    gl.uniform1f(this.uSpillLoc, params.spill);
    gl.uniform1f(this.uBrightnessLoc, params.brightness);
    gl.uniform1f(this.uContrastLoc, params.contrast);

    // Upload current video frame to texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public destroy() {
    if (!this.gl) return;
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.posBuffer) gl.deleteBuffer(this.posBuffer);
    if (this.texBuffer) gl.deleteBuffer(this.texBuffer);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
  }
}
