---
name: halftone-comparison-app
overview: Single-page browser app to compare three halftone rendering algorithms side-by-side from an uploaded image, with interactive controls and SVG export.
todos:
  - id: ui-structure
    content: Build index.html skeleton with controls, canvases, labels, and basic responsive CSS layout.
    status: completed
  - id: image-preprocess
    content: Implement image upload handling, downscaling to max 1000px, and grayscale buffer creation using luminance formula.
    status: completed
  - id: controls-logic
    content: Wire sliders and invert toggle to shared state and requestAnimationFrame-driven rendering loop.
    status: completed
  - id: render-type1
    content: Implement Type 1 fixed-grid variable-size halftone computation and rendering.
    status: completed
  - id: render-type2
    content: Implement Type 2 fixed-size variable-density halftone computation with jittered positions and rendering.
    status: completed
  - id: render-type3
    content: Implement Type 3 variable-size variable-position halftone using Poisson-disc-style sampling and rendering.
    status: completed
  - id: svg-export
    content: Implement reusable dot computation and per-type SVG export using vector circles.
    status: completed
  - id: performance-tune
    content: Tune parameters and bounds for performance on large images while preserving visual quality.
    status: completed
isProject: false
---

# Halftone Comparison App Plan

## Overview

- **Goal**: Build a single self-contained `index.html` with embedded CSS and vanilla JS that loads an image, downscales it, converts to grayscale, and renders three halftone styles side-by-side on canvases with interactive controls and SVG export.
- **Key features**: Image upload, sliders (grid spacing, min/max dot size, contrast multiplier, randomness seed), invert toggle, three labeled canvases, responsive rerendering via `requestAnimationFrame`, and per-type SVG export.

## File Structure

- `**index.html**`: Single HTML document containing:
  - `<style>` block for layout and theming.
  - `<body>` with controls panel, three labeled canvas panels, and export buttons.
  - `<script>` block implementing image handling, grayscale preprocessing, three rendering algorithms, and SVG export logic.

## UI Layout

- **Top control bar**
  - File input: `input[type="file"]` accepting `image/*`.
  - Sliders with labels and live value readouts:
    - `Grid spacing` (e.g. 4–40px, default ~12).
    - `Min dot size` (e.g. 0–4px, default ~0.5).
    - `Max dot size` (e.g. 2–16px, default ~8).
    - `Contrast multiplier` (e.g. 0.5–2.0, step 0.1).
    - `Randomness seed` (integer 1–9999).
  - Checkbox: **Invert brightness**.
- **Main canvas area**
  - Use flex or CSS grid to arrange three panels side-by-side, wrapping on narrow screens.
  - Each panel contains:
    - Heading label text per requirements:
      - `Type 1 – Fixed Grid + Variable Size`
      - `Type 2 – Fixed Size + Variable Density`
      - `Type 3 – Variable Size + Variable Position`
    - A `canvas` element.
    - An `Export SVG` button for that type.
- **Responsiveness & styling**
  - Use a constrained content width (e.g. `max-width: 1200px; margin: 0 auto;`).
  - Use `display: flex; gap: 1rem; flex-wrap: wrap;` for the canvases container.
  - Set canvases to `max-width: 100%; height: auto;` while keeping their internal pixel resolution tied to the processed image size.

## Core Data Flow & State

- **Image loading & downscaling**
  - On file selection:
    - Read file via `FileReader` → create `Image` object.
    - Once loaded, compute scale factor: `scale = min(1000 / img.width, 1000 / img.height, 1)`.
    - Create an offscreen `canvas` with `scaledWidth`, `scaledHeight`.
    - Draw image scaled using `drawImage`.
    - Call `getImageData` once to obtain RGBA pixels.
- **Grayscale buffer**
  - Allocate a `Float32Array` or standard array of size `width * height`.
  - For each pixel, compute luminance via `brightness = 0.299 * R + 0.587 * G + 0.114 * B`.
  - Normalize to `[0, 1]` by dividing by 255.
  - Store in `gray[i]`.
  - Maintain global state object:
    - `imageWidth`, `imageHeight`.
    - `grayBuffer` (base, non-inverted, non-contrast-adjusted).
    - Current UI parameter values.
- **Derived brightness access**
  - Provide helper `getBrightness(x, y)`:
    - Sample from `grayBuffer` with bounds checking.
    - Apply invert flag: `b = invert ? 1 - b : b`.
    - Apply contrast multiplier function, e.g. center-based stretch: `b' = 0.5 + (b - 0.5) * contrast`; clamp to `[0, 1]`.

## Rendering Coordination

- **Animation frame loop**
  - Maintain `needsRender` flag. On slider/toggle changes or new image, set `needsRender = true`.
  - Start a single `requestAnimationFrame` loop that:
    - Checks `needsRender`. If false, schedules next frame and returns quickly.
    - If true and `grayBuffer` is available:
      - Clears and resizes all three visible canvases to `imageWidth`/`imageHeight`.
      - Calls `renderType1`, `renderType2`, `renderType3` in sequence with a shared parameter object and a seeded RNG instance per type.
      - Sets `needsRender = false`.
- **Parameter object**
  - Pass an object `{ width, height, grayBuffer, getBrightness, gridSpacing, minDot, maxDot, contrast, invert, seed }` into each render function.
  - Within each render, create a separate seeded RNG based on base seed plus type offset for reproducible but independent jitter.

## Random Number Generation

- **Seeded RNG implementation**
  - Implement a small pure JS PRNG such as `mulberry32` or `xorshift32` that takes an integer seed and returns a closure `rand()` yielding `[0, 1)`.
  - Derive seeds: `seed1 = baseSeed`, `seed2 = baseSeed * 1103515245 + 12345`, `seed3 = baseSeed * 362437 + 521288629`.
  - Use RNG for:
    - Type 2: dot placement probability decision and within-cell jitter.
    - Type 3: candidate point positions and rejection sampling.

## Algorithm Implementation Details

### Type 1 – Fixed Grid + Variable Size

- **Grid traversal**
  - Compute `cellSize = gridSpacing` from slider.
  - Loop `y` from 0 to `height` in steps of `cellSize`; similarly for `x`.
  - For each cell, compute average brightness:
    - For performance, sample a small fixed number of pixels within the cell (e.g. cell center plus 3–4 points) instead of iterating over all pixels, or use center-only sampling to keep it simple.
  - Map brightness to radius:
    - Use `t = 1 - brightness` (dark → large, light → small).
    - Radius `r = minDot + t * (maxDot - minDot)`.
  - Dot position:
    - Fixed at cell center: `(cx, cy) = (x + cellSize / 2, y + cellSize / 2)`.
  - Rendering:
    - On canvas, clear with white background.
    - Use `ctx.beginPath()` / `ctx.arc(cx, cy, r, 0, 2 * Math.PI)` and `ctx.fill()` with black fill.

### Type 2 – Fixed Size + Variable Density

- **Grid and fixed radius**
  - Use same `cellSize = gridSpacing`.
  - Fixed radius derived from `minDot`/`maxDot`, e.g. `r = (minDot + maxDot) / 2` or a separate function; document choice in comments.
- **Dot probability per cell**
  - For each cell center `(cx, cy)`:
    - Obtain brightness at center via `getBrightness(cx, cy)`.
    - Compute probability `p = 1 - brightness` (dark → higher probability).
    - Optionally raise to power with contrast multiplier for more distinction: `p = Math.pow(p, contrast)`.
    - Draw dot if `rand() < p`.
- **Jittered position inside cell**
  - When drawing a dot, jitter around the center to avoid a rigid grid look:
    - `jx = (rand() - 0.5) * jitterFactor * cellSize` (e.g. `jitterFactor` ~ 0.8).
    - `jy` similarly, and clamp positions to image bounds.
  - Render circles same as Type 1.

### Type 3 – Variable Size + Variable Position

- **Overall strategy**
  - Use a Poisson-disc-style sampling with a minimum distance that depends on brightness.
  - Generate candidate points using dart-throwing with a spatial hash grid to avoid O(N²) distance checks.
- **Brightness-dependent parameters**
  - At each accepted point, compute brightness `b` at that location.
  - Map to radius: `t = 1 - b`; `r = minDot + t * (maxDot - minDot)`.
  - Map to minimum distance `dMin`:
    - For darker areas, want more & bigger dots → distance smaller for dark, larger for light.
    - E.g. `dMin = r * mixFactor` where `mixFactor` blends between a lower and higher multiple based on brightness.
- **Spatial hash / grid**
  - Precompute `cell = maxDot * 2` or similar for the spatial grid resolution.
  - Maintain a 2D array (or map keyed by `ix,iy`) storing arrays of point indices per cell.
  - For each candidate point `(x, y)`:
    - Compute its grid cell indices.
    - Check neighboring cells (3×3 area) for existing points; for each, compute Euclidean distance; reject if less than `dMin` (can use brightness at candidate to derive distance).
- **Point generation loop**
  - Decide a max attempts heuristic based on image size, e.g. `maxAttempts = width * height / (cellArea * factor)` or a simple large constant like `20000` for performance.
  - In each attempt:
    - `x = rand() * width`, `y = rand() * height`.
    - Look up brightness and corresponding `r` and `dMin`.
    - If passes minimum distance check using the grid, add to list of points and to grid.
  - Stop when `attempts >= maxAttempts` to keep runtime bounded.
- **Rendering**
  - For each accepted point, draw a filled circle with radius `r` on the canvas.
  - Use `ctx.beginPath()` / `ctx.arc()` / `ctx.fill()` similarly to other types.

## SVG Export Implementation

- **Common circle generation**
  - To avoid duplicating logic, factor each algorithm into two stages:
    - A **dot computation** function per type (e.g. `computeDotsType1(params, rng)`) returning an array of `{ x, y, r }` (and optionally color).
    - A **render function** for canvas that takes the dots array and draws them.
  - During normal rendering, `renderTypeN` will:
    - Call `computeDotsTypeN`.
    - Store the dot array in a global cache per type (`dotsCache[1|2|3]`).
    - Draw to the corresponding canvas.
- **Export workflow**
  - When user clicks `Export SVG` for type N:
    - If no image is loaded, ignore.
    - Ensure we have a recent `dotsCache[N]`; if not, call `computeDotsTypeN` once with a seeded RNG.
    - Create an SVG string:
      - `<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H">`.
      - Optional white background rect: `<rect width="100%" height="100%" fill="white"/>`.
      - For each dot: `<circle cx="x" cy="y" r="r" fill="black" />`.
      - Close `</svg>`.
    - Create a `Blob` from the string with MIME `image/svg+xml`.
    - Create an object URL and trigger a temporary `<a>` download with filename like `halftone-type1.svg`.

## Performance Considerations

- **Downscaling limit**
  - Ensure max dimension is 1000px to cap pixel count and algorithm workload.
- **Loop efficiency**
  - Use simple `for` loops and precomputed lengths; avoid allocations inside hot loops where feasible.
  - Reuse arrays where possible (e.g. global grayscale buffer, reusable dots arrays that get length reset between runs).
- **Type 3 bounding**
  - Tune `maxAttempts` and `dMin` mapping to balance detail vs speed; add comments and possibly a hard cap on number of dots (e.g. stop when `dots.length > 12000`).
- **Rendering batching**
  - Use `beginPath` batching: accumulate many arcs into a single path before `fill()` to reduce draw calls per type.

## Modularity & Comments

- **Function structure**
  - Separate concerns clearly:
    - `handleFileInput`, `loadImage`, `prepareGrayscale`.
    - `setupControls`, `onControlChange`.
    - `startRenderLoop`, `renderAllTypes`.
    - `computeDotsType1/2/3`, `drawDotsToCanvas`, `exportSvgForType`.
  - Each algorithm block will have a descriptive comment header explaining the concept and how it relates to the spec (mechanical grid, stochastic screening, artistic Poisson-disc style).
- **In-code documentation**
  - Comment non-obvious math (brightness mapping, contrast curve, distance calculations, PRNG) and key design decisions for readability.

## Testing & Tuning

- **Functional checks**
  - Verify:
    - Uploading various images (light, dark, high contrast) works and renders three panels.
    - Sliders and invert toggle immediately update all three canvases.
    - Changing the randomness seed produces different but stable patterns (same seed → same render) for Type 2 and Type 3.
    - SVG files open correctly in a vector viewer with distinct circles.
  - Tune default slider values for visually pleasing results across typical images.

## Todos

- **ui-structure**: Build `index.html` skeleton with controls, canvases, and basic CSS layout.
- **image-preprocess**: Implement image upload, downscaling to max 1000px, and grayscale buffer creation.
- **controls-logic**: Wire sliders and invert toggle to shared parameter state and rendering loop.
- **render-type1**: Implement Type 1 dot computation and canvas rendering using fixed grid and variable radius.
- **render-type2**: Implement Type 2 dot computation and canvas rendering with fixed radius and probabilistic density plus jitter.
- **render-type3**: Implement Type 3 dot computation and canvas rendering using Poisson-disc-style sampling and brightness-dependent radius/distance.
- **svg-export**: Implement shared dot computation reuse and SVG export for each type.
- **performance-tune**: Profile behavior on large images and tweak grid spacing defaults, Type 3 attempt limits, and contrast mapping for smooth interaction.
