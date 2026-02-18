# Pipeline Analysis: Source Image → Rendered Diamond Art

This document traces how the Paris rainy-street source image is transformed into the final diamond-art rendering by the pipeline in `diamond-art.js`.

---

## Source image (input)

- **Content:** Rainy Paris street, Eiffel Tower in the background, impressionistic oil painting.
- **Visual traits:** Thick brushstrokes (impasto), wet reflective pavement, warm lantern/shop lights, cool grey–blue sky, autumn foliage, flower pots (pinks, reds, yellows, greens), sparse figures with umbrellas. A soft watermark sits over the sky.
- **Color character:** Rich, continuous color—many shades of grey, blue, yellow, orange, and varied flower hues.

---

## Pipeline steps and their effect on this image

### 1. Downscale to grid (`createDiamondArt` → `ctx.drawImage`)

**Code:** The source is drawn onto a small canvas at `gridW × gridH` (e.g. 120×160 or 140×200).

**Effect on this scene:**

- The painting’s fine detail (brushstrokes, rain streaks, small flowers) is merged into coarse grid cells. Each cell becomes one “bead” in the output.
- The Eiffel Tower, street, and buildings keep their layout and large shapes; smaller elements (individual petals, rain lines) are averaged into local color.
- The watermark, being low-contrast and overlapping sky/buildings, is largely absorbed into those regions during downsampling rather than staying as a distinct layer.

So the first step turns the image into a **low-resolution color map** that still carries the composition and main light/dark and warm/cool structure.

---

### 2. Preprocess: contrast and saturation (`enhanceImage`)

**Code:** Per pixel, contrast is scaled around 128 with factor 1.1, then saturation is increased by 1.05 around the luminance average. Values are clamped to [0, 255].

**Effect on this scene:**

- **Lights and reflections:** Lanterns and their reflections on the wet street get slightly brighter and more separated from midtones, so “glowing” areas read more clearly in the next steps.
- **Sky and shadows:** Darker building and sky regions get a bit darker; the grey–blue sky and wet pavement gain a bit more punch.
- **Flowers and foliage:** Reds, pinks, yellows, and greens become slightly more saturated, so they stay vivid after the upcoming palette reduction.

This step prepares the image so that the limited palette and dithering still preserve strong lights, clear darks, and recognizable local color.

---

### 3. RGB → LAB and palette choice (`findNearestColorLAB`)

**Code:** Each pixel’s RGB is converted to LAB via `rgbToXyz` → `xyzToLab`. The nearest of the 9 palette colors is chosen by Euclidean distance in LAB.

**Palette (from `diamond-art.js`):** White, Black, Warm Yellow, Orange, Light Blue, Dark Blue, Leaf Green, Rose Pink, Brown.

**Effect on this scene:**

- **Sky and overcast areas:** Pale blue–greys map to **Light Blue** or **White** depending on lightness; darker cloud or building silhouettes move toward **Dark Blue** or **Black**. LAB keeps these choices aligned with how we see “same kind of grey/blue, different brightness.”
- **Street and wet reflections:** Warm street and reflection tones map to **Warm Yellow** and **Orange**; darker wet areas to **Brown**, **Dark Blue**, or **Black**. Again, similar hue and brightness in the painting become similar palette choices.
- **Lights and foliage:** Bright lantern glow and autumn leaves → **Warm Yellow** / **Orange**; greens → **Leaf Green**; flowers → **Rose Pink**, **Warm Yellow**, **Orange**, or **Brown** depending on hue and value.
- **Buildings:** Ochres and stone tones → **Brown**, **Orange**, or **Warm Yellow**; darker facades → **Dark Blue** or **Black**.

Because matching is done in LAB, the **perceptual** relationship between “sky blue,” “shadow blue,” and “reflection yellow” is preserved even when everything is forced into only nine colors. That’s why the rendered image still “feels” like the same light and mood.

---

### 4. Quantization + soft Floyd–Steinberg dithering (`applyDiamondQuantization`)

**Code:** For each pixel (in scan order), the current color is replaced by the nearest palette color. The **quantization error** `(old - new)` is scaled by **0.3** and pushed to four neighbors with weights 7/16 (right), 3/16 (bottom-left), 5/16 (bottom), 1/16 (bottom-right). Neighbor values are clamped to [0, 255].

**Effect on this scene:**

- **Sky and rain:** The sky wants to be a smooth gradient from pale to darker grey–blue. Pure replacement would give visible bands. Dithering turns that into a **textured mix** of Light Blue, White, and Dark Blue cells, so the sky looks like soft, rainy atmosphere instead of strips. The 0.3 factor keeps the dither moderate—visible grain but not harsh.
- **Wet street and reflections:** Gradients from bright reflection to dark pavement are expressed as **patterns of Warm Yellow, Orange, Brown, Dark Blue, Black**. The direction of error spread (down and right) helps suggest flow and shimmer without adding random noise.
- **Flowers and foliage:** Fine color variation in petals and leaves becomes small clusters and edges of Rose Pink, Warm Yellow, Orange, Leaf Green. The dither keeps edges from looking like hard blocks.
- **Buildings and lamp glow:** Transitions from lit to shadow stay readable because error is distributed instead of snapped; you still get “glow” and “structure” rather than flat posterization.

So the combination of **LAB nearest-color + soft Floyd–Steinberg** is what gives the render “smooth gradients” and “clean lamp glow” even with only nine colors.

---

### 5. Noise cleanup (`cleanupIsolatedPixels`)

**Code:** For each interior pixel, the four cardinal neighbors are considered. If **at most 1** neighbor has the same RGB as the center, the center is replaced by the **majority color** among those four neighbors.

**Effect on this scene:**

- **Dither “speckles”:** Isolated cells that ended up the “wrong” color in the middle of a uniform region (e.g. a single Orange in a patch of Warm Yellow, or a stray Dark Blue in the sky) are overwritten by what their neighbors mostly are. So large areas (sky, building facades, big reflection patches) look **solid and coherent**.
- **Edges and detail:** Where two regions meet (e.g. tree vs sky, flower vs street), the majority rule usually keeps the edge and only removes true one-off pixels. So you keep “strong structure in buildings” and “detailed foliage/flowers” while losing **random-looking** dots.

That’s why the final image has “no random noise” and reads as clean diamond art rather than noisy quantization.

---

### 6. Diamond-style grid rendering (`renderDiamondGrid`)

**Code:** The quantized grid is read from the small canvas. For each cell, a large square of size `scale × scale` is drawn with that cell’s RGB. Then:

- A **bevel highlight:** `rgba(255,255,255,0.15)` over the top third of the square.
- A **bevel shadow:** `rgba(0,0,0,0.15)` over the bottom third.

**Effect on this scene:**

- Every palette cell becomes a **visible “diamond”**: same base color, but with a light strip on top and a dark strip on the bottom. That gives the uniform grid a **faceted, glossy** look and makes the whole image read as bead/diamond art.
- The previous steps only decided **which** of the nine colors each cell gets. This step decides **how** each cell is drawn—flat fill + highlight + shadow—so the “real diamond tile effect” comes entirely from here.

---

## End-to-end flow (this image)

```
Paris rainy-street painting (full resolution, many colors)
    → Downscale to grid (e.g. 120×160)
        Composition and main light/dark and warm/cool structure preserved; fine detail merged.
    → enhanceImage (contrast 1.1, saturation 1.05)
        Lights and flowers pop; darks and sky a bit stronger.
    → applyDiamondQuantization (LAB nearest of 9 colors + 0.3× Floyd–Steinberg)
        Only 9 colors, but sky/street/lights/flowers still read naturally; gradients become dithered patterns.
    → cleanupIsolatedPixels (replace isolated cells by majority of 4 neighbors)
        Speckles and one-off errors removed; large areas and edges stay clear.
    → renderDiamondGrid (scale up, add top highlight + bottom shadow per cell)
        Grid of “diamonds” with consistent bevel, ready for print or display.
```

---

## Why the render matches the goals

- **“Smooth gradients like the sky”** → LAB + soft dithering (and cleanup that doesn’t wipe out gradient texture).
- **“Clean lamp glow”** → Preprocess + LAB matching + dither so warm tones read as glow, then cleanup removes stray dark/light pixels inside the glow.
- **“Strong structure in buildings”** → Downscale keeps major edges; LAB keeps value relationships; cleanup keeps facades and roofs coherent.
- **“No random noise”** → `cleanupIsolatedPixels` targets exactly the kind of single-pixel mistakes dithering can create.
- **“Real diamond tile effect”** → `renderDiamondGrid` turns each quantized cell into a small faceted block with highlight and shadow.

The pipeline is the same for any image; the **analysis above** is how that pipeline behaves on this particular Paris street scene from brushstroke painting to final diamond-art grid.
