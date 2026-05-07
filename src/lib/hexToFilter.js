/**
 * Converts a hex color to a CSS filter string that colorizes a white PNG to the target color.
 * Uses the SPSA optimization algorithm to find filter values.
 * Based on https://codepen.io/sosuke/pen/Pjoqqp by Sosuke Hanamura (MIT).
 *
 * Usage: apply `filter: brightness(0) saturate(100%) ${hexToFilter(hex)}` to a white/black PNG.
 */

class Color {
  constructor(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
  set(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
  hueRotate(angle = 0) {
    angle = (angle / 180) * Math.PI;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    this.multiply([
      0.213 + cos * 0.787 - sin * 0.213,
      0.715 - cos * 0.715 - sin * 0.715,
      0.072 - cos * 0.072 + sin * 0.928,
      0.213 - cos * 0.213 + sin * 0.143,
      0.715 + cos * 0.285 + sin * 0.14,
      0.072 - cos * 0.072 - sin * 0.283,
      0.213 - cos * 0.213 - sin * 0.787,
      0.715 - cos * 0.715 + sin * 0.715,
      0.072 + cos * 0.928 + sin * 0.072,
    ]);
  }
  sepia(value = 1) {
    this.multiply([
      0.393 + 0.607 * (1 - value),
      0.769 - 0.769 * (1 - value),
      0.189 - 0.189 * (1 - value),
      0.349 - 0.349 * (1 - value),
      0.686 + 0.314 * (1 - value),
      0.168 - 0.168 * (1 - value),
      0.272 - 0.272 * (1 - value),
      0.534 - 0.534 * (1 - value),
      0.131 + 0.869 * (1 - value),
    ]);
  }
  saturate(value = 1) {
    this.multiply([
      0.213 + 0.787 * value,
      0.715 - 0.715 * value,
      0.072 - 0.072 * value,
      0.213 - 0.213 * value,
      0.715 + 0.285 * value,
      0.072 - 0.072 * value,
      0.213 - 0.213 * value,
      0.715 - 0.715 * value,
      0.072 + 0.928 * value,
    ]);
  }
  multiply(matrix) {
    const r = this.clamp(this.r * matrix[0] + this.g * matrix[1] + this.b * matrix[2]);
    const g = this.clamp(this.r * matrix[3] + this.g * matrix[4] + this.b * matrix[5]);
    const b = this.clamp(this.r * matrix[6] + this.g * matrix[7] + this.b * matrix[8]);
    this.r = r;
    this.g = g;
    this.b = b;
  }
  brightness(value = 1) {
    this.linear(value);
  }
  contrast(value = 1) {
    this.linear(value, -(0.5 * value) + 0.5);
  }
  linear(slope = 1, intercept = 0) {
    this.r = this.clamp(this.r * slope + intercept * 255);
    this.g = this.clamp(this.g * slope + intercept * 255);
    this.b = this.clamp(this.b * slope + intercept * 255);
  }
  invert(value = 1) {
    this.r = this.clamp((value + (this.r / 255) * (1 - 2 * value)) * 255);
    this.g = this.clamp((value + (this.g / 255) * (1 - 2 * value)) * 255);
    this.b = this.clamp((value + (this.b / 255) * (1 - 2 * value)) * 255);
  }
  hsl() {
    const r = this.r / 255;
    const g = this.g / 255;
    const b = this.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 100, s: s * 100, l: l * 100 };
  }
  clamp(value) {
    return Math.max(0, Math.min(255, value));
  }
}

class Solver {
  constructor(target) {
    this.target = target;
    this.targetHSL = target.hsl();
    this.reusedColor = new Color(0, 0, 0);
  }
  solve() {
    const result = this.solveNarrow(this.solveWide());
    return { filter: this.css(result.values), loss: result.loss };
  }
  solveWide() {
    const A = 5;
    const c = 15;
    const a = [60, 180, 18000, 600, 1.2, 1.2];
    let best = { loss: Infinity };
    for (let i = 0; best.loss > 25 && i < 3; i++) {
      const initial = [50, 20, 3750, 50, 100, 100];
      const result = this.spsa(A, a, c, initial, 1000);
      if (result.loss < best.loss) best = result;
    }
    return best;
  }
  solveNarrow(wide) {
    const A = wide.loss;
    const c = 2;
    const A1 = A + 1;
    const a = [0.25 * A1, 0.25 * A1, A1, 0.25 * A1, 0.2 * A1, 0.2 * A1];
    return this.spsa(A, a, c, wide.values, 500);
  }
  spsa(A, a, c, values, iters) {
    const alpha = 1;
    const gamma = 0.16667;
    let best = null;
    let bestLoss = Infinity;
    const deltas = new Array(6);
    const highArgs = new Array(6);
    const lowArgs = new Array(6);
    for (let k = 0; k < iters; k++) {
      const ck = c / Math.pow(k + 1, gamma);
      for (let i = 0; i < 6; i++) deltas[i] = Math.random() > 0.5 ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        highArgs[i] = values[i] + ck * deltas[i];
        lowArgs[i] = values[i] - ck * deltas[i];
      }
      const lossDiff = this.loss(highArgs) - this.loss(lowArgs);
      for (let i = 0; i < 6; i++) {
        const g = (lossDiff / (2 * ck)) * deltas[i];
        const ak = a[i] / Math.pow(A + k + 1, alpha);
        values[i] = this.fix(values[i] - ak * g, i);
      }
      const loss = this.loss(values);
      if (loss < bestLoss) {
        best = values.slice(0);
        bestLoss = loss;
      }
    }
    return { values: best, loss: bestLoss };
  }
  loss(filters) {
    const color = this.reusedColor;
    color.set(0, 0, 0);
    color.invert(filters[0] / 100);
    color.sepia(filters[1] / 100);
    color.saturate(filters[2] / 100);
    color.hueRotate(filters[3] * 3.6);
    color.brightness(filters[4] / 100);
    color.contrast(filters[5] / 100);
    const colorHSL = color.hsl();
    return (
      Math.abs(color.r - this.target.r) +
      Math.abs(color.g - this.target.g) +
      Math.abs(color.b - this.target.b) +
      Math.abs(colorHSL.h - this.targetHSL.h) +
      Math.abs(colorHSL.s - this.targetHSL.s) +
      Math.abs(colorHSL.l - this.targetHSL.l)
    );
  }
  fix(value, idx) {
    let max = 100;
    if (idx === 2) max = 7500;
    else if (idx === 4 || idx === 5) max = 200;
    if (idx === 3) {
      if (value > 100) value %= 100;
      else if (value < 0) { value %= 100; value += 100; }
    } else if (value < 0) {
      value = 0;
    } else if (value > max) {
      value = max;
    }
    return value;
  }
  css(filters) {
    const fmt = (idx, multiplier = 1) => Math.round(filters[idx] * multiplier);
    return `invert(${fmt(0)}%) sepia(${fmt(1)}%) saturate(${fmt(2)}%) hue-rotate(${fmt(3, 3.6)}deg) brightness(${fmt(4)}%) contrast(${fmt(5)}%)`;
  }
}

// Cache to avoid recomputing the same hex value repeatedly (solver uses randomness so we cache)
const filterCache = new Map();

/**
 * Converts a #RRGGBB hex color to a CSS filter string that turns a white PNG into that color.
 * Prepend `brightness(0) saturate(100%)` to the result when applying to a white PNG.
 * Result is cached per hex value for performance.
 *
 * @param {string} hex  e.g. "#ff6600"
 * @returns {string}    CSS filter value (without brightness(0) prefix)
 */
export function hexToFilter(hex) {
  if (!hex || hex.length < 7) return "";
  const key = hex.toLowerCase();
  if (filterCache.has(key)) return filterCache.get(key);

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const solver = new Solver(new Color(r, g, b));
  const result = solver.solve();
  filterCache.set(key, result.filter);
  return result.filter;
}
