import assert from "node:assert/strict";
import test from "node:test";

import { getYouTubeVideoId, normalizeYouTubeUrl } from "./external-video";

test("reads supported YouTube URLs", () => {
  assert.equal(getYouTubeVideoId("https://www.youtube.com/watch?v=abcdefghijk"), "abcdefghijk");
  assert.equal(getYouTubeVideoId("https://youtu.be/abcdefghijk"), "abcdefghijk");
  assert.equal(getYouTubeVideoId("https://youtube.com/live/abcdefghijk"), "abcdefghijk");
});

test("normalizes and rejects external URLs", () => {
  assert.equal(normalizeYouTubeUrl("https://youtu.be/abcdefghijk"), "https://www.youtube.com/watch?v=abcdefghijk");
  assert.throws(() => normalizeYouTubeUrl("https://example.com/video"), /valid YouTube/);
});
