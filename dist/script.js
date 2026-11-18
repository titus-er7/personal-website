const image = document.querySelector(".panorama-image");
const canvas = document.querySelector(".panorama-canvas");
const context = canvas.getContext("2d", { alpha: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const duration = 10000;
const roughDuration = 1750;

document.body.classList.add("drawing-pending");

function finishWithoutAnimation() {
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

  function strokeFrom(point, rough, progress) {
    const angle = point.angle + (Math.random() - .5) * (rough ? 1.15 : .48);
    const length = rough ? 28 + Math.random() * 86 : 7 + Math.random() * 42;
    const thickness = rough ? 1.4 + Math.random() * 2.2 : .65 + Math.random() * 1.35;
    const bend = (Math.random() - .5) * (rough ? 13 : 5);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const steps = 5;
    const upper = [];
    const lower = [];

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const wobble = Math.sin(t * Math.PI) * bend + (Math.random() - .5) * (rough ? 2.5 : 1.1);
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
    context.globalAlpha = rough ? .62 : .42 + progress * .48;
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
      for (let i = 0; i < 22; i++) strokeFrom(pickBackground(), true, elapsed / roughDuration);
    } else {
      const detailProgress = Math.min(1, (elapsed - roughDuration) / (duration - roughDuration));
      for (let i = 0; i < 44; i++) {
        const point = Math.random() < .58 ? pickForeground() : pickAny();
        strokeFrom(point, false, detailProgress);
      }
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

image.decode().then(startDrawing).catch(finishWithoutAnimation);
