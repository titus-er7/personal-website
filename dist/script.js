const image = document.querySelector(".panorama-image");
const canvas = document.querySelector(".panorama-canvas");
const context = canvas.getContext("2d", { alpha: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const duration = 10000;
const roughDuration = 800;
const fastBuildDuration = 4200;

document.body.classList.add("drawing-pending");

function finishWithoutAnimation() {
  image.style.opacity = "";
  document.body.classList.remove("drawing-pending", "drawing-active");
  document.body.classList.add("drawing-finished");
}

function grayscale(r, g, b, a) {
  const opacity = a / 255;
  return ((r + g + b) / 3) * opacity + 246 * (1 - opacity);
}

function randomPicker(items) {
  return () => items[Math.floor(Math.random() * items.length)];
}

function startDrawing() {
  if (reducedMotion || !context) {
    finishWithoutAnimation();
    return;
  }

  const scale = Math.min(1, 1800 / image.naturalWidth);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  canvas.width = width;
  canvas.height = height;

  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0, width, height);
  const pixels = sourceContext.getImageData(0, 0, width, height).data;

  const candidates = [];
  let minY = height;
  let maxY = 0;
  const stride = 3;
  for (let y = 2; y < height - 2; y += stride) {
    for (let x = 2; x < width - 2; x += stride) {
      const i = (y * width + x) * 4;
      const alpha = pixels[i + 3];
      const tone = grayscale(pixels[i], pixels[i + 1], pixels[i + 2], alpha);
      if (alpha < 28 || tone > 252) continue;

      const left = grayscale(pixels[i - 4], pixels[i - 3], pixels[i - 2], pixels[i - 1]);
      const right = grayscale(pixels[i + 4], pixels[i + 5], pixels[i + 6], pixels[i + 7]);
      const aboveIndex = i - width * 4;
      const belowIndex = i + width * 4;
      const above = grayscale(pixels[aboveIndex], pixels[aboveIndex + 1], pixels[aboveIndex + 2], pixels[aboveIndex + 3]);
      const below = grayscale(pixels[belowIndex], pixels[belowIndex + 1], pixels[belowIndex + 2], pixels[belowIndex + 3]);
      const angle = Math.atan2(below - above, right - left) + Math.PI / 2;

      candidates.push({ x, y, angle });
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (!candidates.length) {
    finishWithoutAnimation();
    return;
  }

  const spanY = maxY - minY || height;
  const background = candidates.filter((p) => p.y < minY + spanY * .68);
  const foreground = candidates.filter((p) => p.y > minY + spanY * .34);
  const pickAny = randomPicker(candidates);
  const pickBackground = randomPicker(background.length ? background : candidates);
  const pickForeground = randomPicker(foreground.length ? foreground : candidates);

  function strokeFrom(point, rough, progress, detail = false) {
    const angle = point.angle + (Math.random() - .5) * (rough ? 1.15 : detail ? .3 : .48);
    const length = rough ? 28 + Math.random() * 86 : detail ? 5 + Math.random() * 25 : 7 + Math.random() * 42;
    const thickness = rough ? 1.4 + Math.random() * 2.2 : detail ? .55 + Math.random() * 1.1 : .65 + Math.random() * 1.35;
    const bend = (Math.random() - .5) * (rough ? 13 : detail ? 3 : 5);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const steps = 5;
    const upper = [];
    const lower = [];

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const wobble = Math.sin(t * Math.PI) * bend + (Math.random() - .5) * (rough ? 2.5 : detail ? .65 : 1.1);
      const cx = point.x + dx * length * (t - .5) + nx * wobble;
      const cy = point.y + dy * length * (t - .5) + ny * wobble;
      const widthAtPoint = thickness * (.62 + Math.sin(t * Math.PI) * .38);
      upper.push([cx + nx * widthAtPoint / 2, cy + ny * widthAtPoint / 2]);
      lower.push([cx - nx * widthAtPoint / 2, cy - ny * widthAtPoint / 2]);
    }

    const points = upper.concat(lower.reverse());
    const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p[0])) - 2));
    const minStrokeY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1])) - 2));
    const maxX = Math.min(width, Math.ceil(Math.max(...points.map((p) => p[0])) + 2));
    const maxStrokeY = Math.min(height, Math.ceil(Math.max(...points.map((p) => p[1])) + 2));
    if (maxX <= minX || maxStrokeY <= minStrokeY) return;

    context.save();
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let p = 1; p < points.length; p++) context.lineTo(points[p][0], points[p][1]);
    context.closePath();
    context.clip();
    context.globalAlpha = rough ? .62 : detail ? .55 + progress * .4 : .5 + progress * .35;
    context.drawImage(source, minX, minStrokeY, maxX - minX, maxStrokeY - minStrokeY, minX, minStrokeY, maxX - minX, maxStrokeY - minStrokeY);
    context.restore();
  }

  document.body.classList.remove("drawing-pending");
  document.body.classList.add("drawing-active");
  context.clearRect(0, 0, width, height);
  const began = performance.now();

  function frame(now) {
    const elapsed = now - began;
    if (elapsed >= duration) {
      finishWithoutAnimation();
      return;
    }

    if (elapsed < roughDuration) {
      for (let i = 0; i < 28; i++) strokeFrom(pickBackground(), true, elapsed / roughDuration);
    } else if (elapsed < fastBuildDuration) {
      const buildProgress = (elapsed - roughDuration) / (fastBuildDuration - roughDuration);
      for (let i = 0; i < 68; i++) {
        const point = Math.random() < .48 ? pickForeground() : pickAny();
        strokeFrom(point, false, buildProgress);
      }
    } else {
      const detailProgress = Math.min(1, (elapsed - fastBuildDuration) / (duration - fastBuildDuration));
      // Front-load the broad sketch, then taper the stroke rate through the slower detail pass.
      const strokeCount = Math.round(42 - detailProgress * 31);
      const underlayProgress = Math.min(1, detailProgress * 1.04);
      image.style.opacity = String(.96 * (1 - Math.pow(1 - underlayProgress, 2)));
      for (let i = 0; i < strokeCount; i++) {
        const point = Math.random() < .68 ? pickForeground() : pickAny();
        strokeFrom(point, false, detailProgress, true);
      }
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

image.decode().then(startDrawing).catch(finishWithoutAnimation);
