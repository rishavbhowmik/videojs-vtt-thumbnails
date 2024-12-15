"use strict";
(() => {
  // src/vtt-parser.ts
  var CUE_TIME_LINE_REGEXP = /(?:^|\n) *(?:\d+:[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?|[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?) +--> +(?:\d+:[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?|[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?)/;
  var TIMESTAMP_REGEXP = /(?:\d+:[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?|[0-5]\d:[0-5]\d(?:(?:\.|,)\d+)?)/g;
  function parseWebVTT(input) {
    const continuousChunks = input.replace(/\r\n|\r|\n/g, "\n").replace(/\n\n+/g, "\n\n").split("\n\n");
    console.log({ continuousChunks });
    const cueChunks = continuousChunks.filter(
      (chunk) => CUE_TIME_LINE_REGEXP.test(chunk)
    );
    console.log({ continuousChunks });
    return cueChunks.map(parseCue);
  }
  function parseCue(data) {
    const cueLines = data.split("\n");
    const indexOfLineWithTimestamp = cueLines.findIndex((line) => CUE_TIME_LINE_REGEXP.test(line));
    const timestampLine = cueLines[indexOfLineWithTimestamp];
    const [startTime, endTime] = timestampLine.split("-->").map((s) => s.match(TIMESTAMP_REGEXP)).map((t) => {
      if (!t?.[0]) throw Error("Error");
      else {
        return parseTimestamp(t[0]);
      }
    });
    const settings = parseCueSettings(
      timestampLine.replace(CUE_TIME_LINE_REGEXP, "")
    );
    const textLines = [];
    for (let i = indexOfLineWithTimestamp + 1; i < cueLines.length; i++) {
      textLines.push(cueLines[i]);
    }
    const text = textLines.join("\n");
    return {
      startTime,
      endTime,
      settings,
      text
    };
  }
  function parseTimestamp(timestamp) {
    const match = timestamp.match(TIMESTAMP_REGEXP);
    if (!match?.[0]) throw Error("Error while parsing timestamp" + timestamp);
    const [seconds, minutes, hours] = match[0].split(":").reverse();
    return (hours ? parseInt(hours, 10) * 3600 : 0) + parseInt(minutes, 10) * 60 + parseFloat(seconds.replace(",", "."));
  }
  function parseCueSettings(settingsString) {
    return settingsString.split(" ").filter((part) => part.includes(":")).reduce((settings, part) => {
      const [key, value] = part.split(":");
      if (key && value) settings[key] = value;
      return settings;
    }, {});
  }

  // src/videojs-seek-thumbnail.ts
  var SeekThumbnailsManager = class _SeekThumbnailsManager {
    constructor(cues) {
      this.thumbnails = [];
      this.thumbnails = cues.map((c) => {
        const { startTime, endTime, text } = c;
        const thumbnailURL = new URL(text);
        return {
          startTime,
          endTime,
          thumbnailURL
        };
      });
    }
    static openVTT(vttData) {
      const cues = parseWebVTT(vttData);
      return new _SeekThumbnailsManager(cues);
    }
    getNearestThumbnail(t) {
      if (!this.thumbnails[0]) return null;
      const nearestThumbnail = this.thumbnails.reduce((nearest, thumbnail) => {
        const timeDifference = Math.abs(thumbnail.startTime - t);
        if (timeDifference < nearest.timeDifference) {
          return {
            thumbnailURL: thumbnail.thumbnailURL,
            timeDifference
          };
        }
        return nearest;
      }, {
        thumbnailURL: this.thumbnails[0].thumbnailURL,
        timeDifference: Infinity
      });
      return nearestThumbnail.thumbnailURL;
    }
  };
  function createThumbnailElement(document2, thumbnailUrl) {
    const div = document2.createElement("div");
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
    const xywh = thumbnailUrl.hash.match(/xywh=\d+,\d+,\d+,\d+/g);
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
  function registerPlugin(videojs2) {
    function vttThumbnails(options) {
      const player = this;
      if (videojs2.browser.IS_IOS || videojs2.browser.IS_ANDROID) {
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
      player.controlBar.progressControl.on("mousemove", function(e) {
        const progressBar = player.controlBar.progressControl.el();
        const barRect = progressBar.getBoundingClientRect();
        const percentage = (e.clientX - barRect.left) / barRect.width;
        const time = percentage * player.duration();
        const nearestThumbnaiURL = seekThumbnailManager.getNearestThumbnail(time);
        if (nearestThumbnaiURL === null) return;
        const thumbnailElement = createThumbnailElement(
          document,
          nearestThumbnaiURL
        );
        thumbnailContainer.style.left = e.pageX - player.el().getBoundingClientRect().left + "px";
        thumbnailContainer.style.display = "block";
        thumbnailContainer.appendChild(thumbnailElement);
      });
      player.controlBar.progressControl.on("mouseleave", function() {
        thumbnailContainer.style.display = "none";
      });
    }
    const register = videojs2.registerPlugin ?? videojs2.plugin;
    register("vttThumbnails", vttThumbnails);
  }
  (function(videojs2) {
    registerPlugin(videojs2);
  })(videojs);
})();
