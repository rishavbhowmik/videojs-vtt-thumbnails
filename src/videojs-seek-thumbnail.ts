import { parseWebVTT, WebVTTCue } from "./vtt-parser.ts";

type SeekThumbnailsManagerOptions = {
  spriteBaseUrl?: string
}

class SeekThumbnailsManager {
  private thumbnails: {
    startTime: number;
    endTime: number;
    thumbnailURL: URL;
  }[] = [];
  constructor(cues: WebVTTCue[], options: SeekThumbnailsManagerOptions = {}) {
    this.thumbnails = cues.map((c) => {
      const { startTime, endTime, text } = c;
      let thumbnailURL: URL
      if (options.spriteBaseUrl) {
        // Legacy logic
        thumbnailURL = new URL(options.spriteBaseUrl)
        const matchXYWH = text.match(/#xywh=\d+,\d+,\d+,\d+/);
        if (matchXYWH) {
          thumbnailURL.hash = matchXYWH[0].substring(1)
        }
      } else {
        thumbnailURL = new URL(text);
      }
      return {
        startTime,
        endTime,
        thumbnailURL,
      };
    });
  }
  static openVTT(vttData: string) {
    const cues = parseWebVTT(vttData);
    return new SeekThumbnailsManager(cues);
  }
  getNearestThumbnail(t: number): URL | null {
    if (!this.thumbnails[0]) return null;
    const nearestThumbnail = this.thumbnails.reduce((nearest, thumbnail) => {
      const timeDifference = Math.abs(thumbnail.startTime - t);
      if (timeDifference < nearest.timeDifference) {
        return {
          thumbnailURL: thumbnail.thumbnailURL,
          timeDifference: timeDifference,
        };
      }
      return nearest;
    }, {
      thumbnailURL: this.thumbnails[0].thumbnailURL,
      timeDifference: Infinity,
    });
    return nearestThumbnail.thumbnailURL;
  }
}

function createThumbnailElement(document: Document, thumbnailUrl: URL) {
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.style.zIndex = "0";
  div.style.display = "block";
  div.style.pointerEvents = "none";
  div.style.backgroundImage = `url(${thumbnailUrl.toString()})`;
  div.style.height = "100%";
  div.style.backgroundSize = "auto";
  div.style.backgroundRepeat = "no-repeat";
  div.style.pointerEvents = "none";
  div.style.transform = "translateX(-50%) translateY(-100%)";

  const xywh = thumbnailUrl.hash.match(/xywh=\d+,\d+,\d+,\d+/g); // #xywh=0,0,150,84

  if (xywh?.[0]) {
    const xywhValue = xywh[0].substring("xywh=".length);
    const [x, y, w, h] = xywhValue.split(",");
    div.style.bottom = `${parseFloat(h) / 2}px`;
    div.style.backgroundPosition = `-${x}px -${y}px`;
    div.style.width = `${w}px`;
    div.style.height = `${h}px`;
    console.log(`${w},${h}`);
  }

  return div;
}

function registerPlugin(videojs: any) {
  function vttThumbnails(options: any) {
    const player: any = this;

    if (videojs.browser.IS_IOS || videojs.browser.IS_ANDROID) {
      return;
    }

    if (typeof options.vttData !== "string") throw Error("Need vttData");
    const { vttData } = options;

    const seekThumbnailManager = SeekThumbnailsManager.openVTT(vttData);

    const thumbnailContainer = document.createElement("div");
    thumbnailContainer.className = "tc";
    thumbnailContainer.style.position = "absolute";
    thumbnailContainer.style.bottom = "0px";
    thumbnailContainer.style.pointerEvents = "none";
    thumbnailContainer.style.display = "none";
    thumbnailContainer.style.zIndex = "0";
    player.el().appendChild(thumbnailContainer);

    player.controlBar.progressControl.on("mousemove", function (e) {
      const progressBar = player.controlBar.progressControl.el();
      const barRect = progressBar.getBoundingClientRect();
      const percentage = (e.clientX - barRect.left) / barRect.width;
      const time = percentage * player.duration();
      const nearestThumbnaiURL = seekThumbnailManager.getNearestThumbnail(time);
      if (nearestThumbnaiURL === null) return;
      const thumbnailElement = createThumbnailElement(
        document,
        nearestThumbnaiURL,
      );
      thumbnailContainer.style.left =
        (e.pageX - player.el().getBoundingClientRect().left) + "px";
      thumbnailContainer.style.display = "block";
      thumbnailContainer.appendChild(thumbnailElement);
    });

    player.controlBar.progressControl.on("mouseleave", function () {
      thumbnailContainer.style.display = "none";
    });
  }
  const register = videojs.registerPlugin ?? videojs.plugin;
  register("vttThumbnails", vttThumbnails);
}

(function (videojs) {
  registerPlugin(videojs);
}) // @ts-ignore
  (videojs);

// (function (videojs) {
//     var registerPlugin = videojs.registerPlugin || videojs.plugin;

//     function vttThumbnails(options) {
//         var player = this;

//         if (videojs.browser.IS_IOS || videojs.browser.IS_ANDROID) {
//             return;
//         }

//         var thumbnailContainer = document.createElement('div');
//         thumbnailContainer.className = 'thumbnail-preview';

//         player.el().appendChild(thumbnailContainer);

//         function createThumbnails(spriteUrl, vttData) {
//             if (vttData === undefined) {
//                 console.error('vttData is undefined');
//                 return;
//             }

//             if (typeof vttData === 'string') {
//                 processVttData(spriteUrl, vttData);
//             } else if (typeof vttData === 'object' && vttData.url) {
//                 fetch(vttData.url)
//                     .then(response => response.text())
//                     .then(data => processVttData(spriteUrl, data))
//                     .catch(error => console.error('Error fetching VTT data:', error));
//             } else {
//                 console.error('Invalid vttData format');
//             }
//         }

//         function processVttData(spriteUrl, vttData) {
//             console.log(vttData);
//             const lines = vttData.split('\n');
//             let index = 0;

//             while (index < lines.length) {
//                 const line = lines[index].trim();
//                 if (line !== '') {
//                     const matchTime = line.match(/(\d+:\d+:\d+[\.,]\d+) --> (\d+:\d+:\d+[\.,]\d+)/);
//                     if (matchTime) {
//                         const [, startTime, endTime] = matchTime;
//                         const xywhLine = lines[index + 1];
//                         const matchXYWH = xywhLine.match(/#xywh=(\d+),(\d+),(\d+),(\d+)/);
//                         if (matchXYWH) {
//                             const [, x, y, width, height] = matchXYWH;
//                             createThumbnail(spriteUrl, parseVttTime(startTime), x, y, width, height);
//                         }
//                     }
//                 }
//                 index += 1;
//             }
//         }

//         function createThumbnail(spriteUrl, startTime, x, y, width, height) {
//             const thumbnail = document.createElement('div');
//             thumbnail.className = 'thumbnail';
//             thumbnail.dataset.startTime = startTime;

//             thumbnail.style.backgroundImage = `url(${spriteUrl})`;
//             thumbnail.style.backgroundPosition = `-${x}px -${y}px`;
//             thumbnail.style.width = `${width}px`;
//             thumbnail.style.height = `${height}px`;
//             thumbnailContainer.appendChild(thumbnail);
//         }

//         function parseVttTime(timeString) {
//             const match = timeString.match(/(\d+:\d+:\d+[\.,]\d+)/);

//             if (match) {
//                 const [fullMatch] = match;
//                 const timeArray = fullMatch.split(':').map(parseFloat);

//                 if (Array.isArray(timeArray) && timeArray.length === 3) {
//                     const [hours, minutes, seconds] = timeArray;
//                     return hours * 3600 + minutes * 60 + seconds;
//                 } else {
//                     console.error('Error format VTT:', timeString);
//                     return 0;
//                 }
//             } else {
//                 console.error('Error format VTT:', timeString);
//                 return 0;
//             }
//         }

//         createThumbnails(options.spriteUrl, options.vttData);

//         player.controlBar.progressControl.on('mousemove', function (e) {
//             const progressBar = player.controlBar.progressControl.el();
//             const barRect = progressBar.getBoundingClientRect();
//             const percentage = (e.clientX - barRect.left) / barRect.width;
//             const time = percentage * player.duration();

//             document.querySelectorAll('.thumbnail').forEach(thumbnail => {
//                 thumbnail.style.display = 'none';
//             });

//             const closestThumbnail = findClosestThumbnail(time);
//             if (closestThumbnail) {
//                 closestThumbnail.style.display = 'block';
//             }

//             const playerRect = player.el().getBoundingClientRect();

//             thumbnailContainer.style.left = (e.pageX - playerRect.left) + 'px';
//             thumbnailContainer.style.display = 'block';
//         });

//         player.controlBar.progressControl.on('mouseleave', function () {
//             thumbnailContainer.style.display = 'none';
//         });

//         function findClosestThumbnail(time) {
//             const thumbnails = document.querySelectorAll('.thumbnail');
//             let closestThumbnail = null;
//             let minDifference = Infinity;

//             thumbnails.forEach(thumbnail => {
//                 const thumbnailTime = parseFloat(thumbnail.dataset.startTime);
//                 const difference = Math.abs(thumbnailTime - time);

//                 if (difference < minDifference) {
//                     minDifference = difference;
//                     closestThumbnail = thumbnail;
//                 }
//             });

//             return closestThumbnail;
//         }
//     }

//     registerPlugin('vttThumbnails', vttThumbnails);
// })(window.videojs);
