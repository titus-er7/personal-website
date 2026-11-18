const sketches = Array.from(document.querySelectorAll(".sketch img"));
document.body.classList.add("drawing-pending");

Promise.all(sketches.map((image) => image.decode().catch(() => undefined))).then(() => {
  document.body.classList.remove("drawing-pending");
  document.body.classList.add("is-drawing");
});
