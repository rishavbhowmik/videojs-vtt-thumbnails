import { SeekThumbnailsManager } from "./videojs-seek-thumbnail.ts";
import { parseWebVTT } from "./vtt-parser.ts";

const vttSampleData = await Deno.readFile(
  "/Users/rishavbhowmik/Desktop/projects/videojs-vtt-thumbnails/examples/parser.vtt",
);
const decoder = new TextDecoder("utf-8");

// const result = parseWebVTT(decoder.decode(vttSampleData));

// console.log(result);

console.log(
  SeekThumbnailsManager.openVTT(
    `
  00:00:00.000 --> 00:00:01.000
  https://ik.imagekit.io/seek-thumbnail-sprite.jpg#xywh=0,0,150,0

  00:00:01.000 --> 00:00:02.000
  https://ik.imagekit.io/seek-thumbnail-sprite.jpg#xywh=0,0,150,100

  00:00:02.000 --> 00:00:03.000
  https://ik.imagekit.io/seek-thumbnail-sprite.jpg#xywh=0,0,150,200
  `,
  ).getNearestThumbnail(2.2),
);
