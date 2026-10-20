// The guide's pictures live in the colony Drive and come through guide.image, one at a time as they scroll into view (two requests at once at most).
// A picture that is not there hides its place; the guide reads fine without it.
const cache = new Map();           // name -> data URL, or null when it is missing
const waiting = [];
let running = 0;

function pump(call) {
  while (running < 2 && waiting.length) {
    const job = waiting.shift();
    running += 1;
    call('guide.image', { name: job.name })
      .then((r) => `data:image/jpeg;base64,${r.jpegBase64}`, () => null)
      .then((url) => { cache.set(job.name, url); job.done(url); })
      .finally(() => { running -= 1; pump(call); });
  }
}

export function guideImage(call, name) {
  if (cache.has(name)) return Promise.resolve(cache.get(name));
  return new Promise((done) => { waiting.push({ name, done }); pump(call); });
}
