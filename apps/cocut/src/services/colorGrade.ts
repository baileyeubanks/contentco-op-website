/**
 * Color Grading Engine — Lumetri-style color correction.
 *
 * Phase 1: CSS filter generation (immediate, no WebGL required)
 * Phase 3: WebGL fragment shader pipeline (real-time, GPU-accelerated)
 *
 * Parameters modeled after Adobe Premiere Pro's Lumetri Color panel:
 * - Basic: Exposure, Contrast, Highlights, Shadows, Temperature, Tint, Saturation, Vibrance
 * - Creative: Lift (shadows), Gamma (midtones), Gain (highlights) color wheels
 * - Curves: RGB per-channel curves
 * - LUT: 3D LUT application via .cube files
 *
 * Reference: trevorvanhoof/ColorGrading (MIT), Tim Severien's WebGL Color Correction,
 * filmicworlds.com minimal color grading, ACES Academy Color Science.
 */

export interface ColorGradeSettings {
  // Basic corrections (-100 to 100)
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number; // Cool (-100) to Warm (100)
  tint: number; // Green (-100) to Magenta (100)
  saturation: number;
  vibrance: number;

  // Lift/Gamma/Gain (color wheels — each channel -1 to 1)
  lift: [number, number, number]; // RGB for shadows
  gamma: [number, number, number]; // RGB for midtones
  gain: [number, number, number]; // RGB for highlights

  // Vignette
  vignetteAmount: number; // 0 to 100
  vignetteSize: number; // 0 to 100

  // LUT
  lutEnabled: boolean;
  lutIntensity: number; // 0 to 100
}

export const DEFAULT_GRADE: ColorGradeSettings = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  lift: [0, 0, 0],
  gamma: [0, 0, 0],
  gain: [0, 0, 0],
  vignetteAmount: 0,
  vignetteSize: 50,
  lutEnabled: false,
  lutIntensity: 100,
};

/**
 * Phase 1: Generate a CSS `filter` string from grade settings.
 * This is an approximation — real Lumetri uses per-pixel math that CSS can't do.
 * Good enough for preview; WebGL version handles the full pipeline.
 */
export function gradeToCSSFilter(grade: ColorGradeSettings): string {
  const filters: string[] = [];

  // Exposure → brightness (0 = no change, maps to CSS brightness 1.0)
  if (grade.exposure !== 0) {
    const brightness = 1 + grade.exposure / 100;
    filters.push(`brightness(${brightness.toFixed(3)})`);
  }

  // Contrast (0 = no change, maps to CSS contrast 1.0)
  if (grade.contrast !== 0) {
    const contrast = 1 + grade.contrast / 100;
    filters.push(`contrast(${contrast.toFixed(3)})`);
  }

  // Saturation
  if (grade.saturation !== 0) {
    const saturate = 1 + grade.saturation / 100;
    filters.push(`saturate(${saturate.toFixed(3)})`);
  }

  // Temperature → approximate via hue-rotate + sepia
  if (grade.temperature !== 0) {
    if (grade.temperature > 0) {
      // Warm: slight sepia + orange hue
      const sepia = (grade.temperature / 100) * 0.3;
      filters.push(`sepia(${sepia.toFixed(3)})`);
    } else {
      // Cool: slight blue hue rotation
      const hue = (grade.temperature / 100) * 30; // -30 to 0 degrees
      filters.push(`hue-rotate(${hue.toFixed(1)}deg)`);
    }
  }

  // Tint → approximate via hue-rotate
  if (grade.tint !== 0) {
    const hue = (grade.tint / 100) * 15; // -15 to 15 degrees
    filters.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  }

  // Highlights → approximate via brightness on upper range (limited in CSS)
  // Shadows → approximate via brightness reduction (limited in CSS)
  // These are very rough — WebGL version does proper per-pixel shadows/highlights

  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Check if a grade has been modified from defaults.
 */
export function isGradeModified(grade: ColorGradeSettings): boolean {
  return (
    grade.exposure !== 0 ||
    grade.contrast !== 0 ||
    grade.highlights !== 0 ||
    grade.shadows !== 0 ||
    grade.temperature !== 0 ||
    grade.tint !== 0 ||
    grade.saturation !== 0 ||
    grade.vibrance !== 0 ||
    grade.lift.some((v) => v !== 0) ||
    grade.gamma.some((v) => v !== 0) ||
    grade.gain.some((v) => v !== 0) ||
    grade.vignetteAmount !== 0 ||
    grade.lutEnabled
  );
}

// ============================================================
// WebGL Fragment Shader — for Phase 3 real-time color grading
// ============================================================

export const COLOR_GRADE_VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * Complete Lumetri-style color grading fragment shader.
 * References:
 * - trevorvanhoof/ColorGrading (lift/gamma/gain formula)
 * - Tim Severien's WebGL Color Correction (brightness/contrast/saturation)
 * - Shadertoy Color Temperature (black-body radiation curve)
 * - WCAG luminosity standards (saturation weights)
 */
export const COLOR_GRADE_FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform sampler2D u_lut;      // 512x512 LUT atlas
uniform bool u_lutEnabled;
uniform float u_lutIntensity;

// Basic corrections
uniform float u_exposure;     // -1.0 to 1.0
uniform float u_contrast;     // -1.0 to 1.0
uniform float u_highlights;   // -1.0 to 1.0
uniform float u_shadows;      // -1.0 to 1.0
uniform float u_temperature;  // -1.0 to 1.0
uniform float u_tint;         // -1.0 to 1.0
uniform float u_saturation;   // -1.0 to 1.0
uniform float u_vibrance;     // -1.0 to 1.0

// Lift / Gamma / Gain (3-way color corrector)
uniform vec3 u_lift;
uniform vec3 u_gamma;
uniform vec3 u_gain;

// Vignette
uniform float u_vignetteAmount;
uniform float u_vignetteSize;

// WCAG standard luminosity weights
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 adjustExposure(vec3 color, float exposure) {
  return color * (1.0 + exposure);
}

vec3 adjustContrast(vec3 color, float contrast) {
  return 0.5 + (1.0 + contrast) * (color - 0.5);
}

vec3 adjustSaturation(vec3 color, float saturation) {
  float luma = dot(color, LUMA);
  return mix(vec3(luma), color, 1.0 + saturation);
}

vec3 adjustVibrance(vec3 color, float vibrance) {
  float luma = dot(color, LUMA);
  float maxChannel = max(color.r, max(color.g, color.b));
  float minChannel = min(color.r, min(color.g, color.b));
  float saturation = maxChannel - minChannel;
  // Vibrance boosts less-saturated pixels more
  float boost = vibrance * (1.0 - saturation);
  return mix(vec3(luma), color, 1.0 + boost);
}

vec3 adjustHighlights(vec3 color, float highlights) {
  float luma = dot(color, LUMA);
  float highlightMask = smoothstep(0.5, 1.0, luma);
  return color + highlights * highlightMask * 0.5;
}

vec3 adjustShadows(vec3 color, float shadows) {
  float luma = dot(color, LUMA);
  float shadowMask = 1.0 - smoothstep(0.0, 0.5, luma);
  return color + shadows * shadowMask * 0.5;
}

// Color temperature approximation (Kelvin to RGB shift)
vec3 adjustTemperature(vec3 color, float temp) {
  // Warm = boost red+green, reduce blue
  // Cool = boost blue, reduce red
  color.r += temp * 0.1;
  color.g += temp * 0.05;
  color.b -= temp * 0.1;
  return color;
}

vec3 adjustTint(vec3 color, float tint) {
  color.g -= tint * 0.1;
  color.r += tint * 0.03;
  color.b += tint * 0.03;
  return color;
}

// Lift/Gamma/Gain — trevorvanhoof/ColorGrading formula
vec3 applyLiftGammaGain(vec3 color, vec3 lift, vec3 gamma, vec3 gain) {
  vec3 liftedColor = max(vec3(0.0), color * (vec3(1.0) + gain - lift) + lift);
  vec3 gammaAdj = max(vec3(0.001), vec3(1.0) - gamma);
  return pow(liftedColor, gammaAdj);
}

// 3D LUT application via 2D atlas texture
// Based on glsl-lut by Matt DesLauriers / frost.kiwi
vec3 applyLUT(vec3 color) {
  float blueColor = color.b * 63.0;
  vec2 quad1;
  quad1.y = floor(floor(blueColor) / 8.0);
  quad1.x = floor(blueColor) - (quad1.y * 8.0);
  vec2 quad2;
  quad2.y = floor(ceil(blueColor) / 8.0);
  quad2.x = ceil(blueColor) - (quad2.y * 8.0);

  vec2 texPos1 = quad1 * 0.125 + 0.5/512.0 + (0.125 - 1.0/512.0) * color.rg;
  vec2 texPos2 = quad2 * 0.125 + 0.5/512.0 + (0.125 - 1.0/512.0) * color.rg;

  vec3 newColor1 = texture2D(u_lut, texPos1).rgb;
  vec3 newColor2 = texture2D(u_lut, texPos2).rgb;

  return mix(newColor1, newColor2, fract(blueColor));
}

// Vignette
vec3 applyVignette(vec3 color, vec2 uv, float amount, float size) {
  float dist = distance(uv, vec2(0.5));
  float vig = smoothstep(size * 0.01, size * 0.01 * 0.5, dist);
  return color * mix(1.0, vig, amount);
}

void main() {
  vec4 texColor = texture2D(u_image, v_texCoord);
  vec3 color = texColor.rgb;

  // Pipeline order matches Lumetri
  color = adjustExposure(color, u_exposure);
  color = adjustTemperature(color, u_temperature);
  color = adjustTint(color, u_tint);
  color = adjustContrast(color, u_contrast);
  color = adjustHighlights(color, u_highlights);
  color = adjustShadows(color, u_shadows);
  color = adjustSaturation(color, u_saturation);
  color = adjustVibrance(color, u_vibrance);
  color = applyLiftGammaGain(color, u_lift, u_gamma, u_gain);

  // Apply LUT if enabled
  if (u_lutEnabled) {
    vec3 lutColor = applyLUT(clamp(color, 0.0, 1.0));
    color = mix(color, lutColor, u_lutIntensity);
  }

  // Vignette
  color = applyVignette(color, v_texCoord, u_vignetteAmount, u_vignetteSize);

  // Clamp output
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
}
`;
