import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { feedImageVersion, toFeedJpeg } from "./feedImages";

/** Run with `pnpm test:meta-feed`. */

describe("Meta feed photos: JPEG copy", () => {
  it("turns a transparent WebP into a JPEG on white", async () => {
    const webp = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } },
    })
      .webp()
      .toBuffer();
    const jpeg = await toFeedJpeg(webp);
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 600);
    assert.equal(meta.height, 600);
    assert.equal(meta.hasAlpha, false);
    const { data } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
    // Fully transparent pixels come out white, not black or red.
    assert.ok(data[0] > 245 && data[1] > 245 && data[2] > 245);
  });

  it("shrinks very large photos to 2048 px and never enlarges small ones", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#336699" } })
      .png()
      .toBuffer();
    const bigMeta = await sharp(await toFeedJpeg(big)).metadata();
    assert.equal(bigMeta.width, 2048);
    assert.equal(bigMeta.height, 1536);

    const small = await sharp({ create: { width: 520, height: 510, channels: 3, background: "#ffffff" } })
      .png()
      .toBuffer();
    const smallMeta = await sharp(await toFeedJpeg(small)).metadata();
    assert.equal(smallMeta.width, 520);
  });

  it("changes the version (ETag) only when the photo changes", () => {
    const row = { id: "img1", image_id: "abc", image_extension: "webp", externalUrl: null };
    assert.equal(feedImageVersion(row), feedImageVersion({ ...row }));
    assert.notEqual(feedImageVersion(row), feedImageVersion({ ...row, image_id: "def" }));
  });
});
