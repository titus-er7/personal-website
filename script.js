const sketches = Array.from(document.querySelectorAll(".sketch img"));

Promise.all(sketches.map((image) => image.decode().catch(() => undefined))).then(() => {
  document.body.classList.add("is-drawing");
});
