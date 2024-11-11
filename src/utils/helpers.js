import { google } from "googleapis";
import { AppConfig } from "../config.js";
var service = google.youtube("v3");

// Main middleware-like functions
export async function DetermineChannelID(browser, url, folder) {
  const urlObject = new URL(String(url), "https://youtube.com");

  let identificator = null;

  if (!urlObject.pathname.substring(1))
    throw "Invalid url provided: path empty";

  const prefix =
    urlObject.pathname.indexOf("/", 1) > 0
      ? urlObject.pathname.substring(1, urlObject.pathname.indexOf("/", 1))
      : "";

  if (prefix === "channel") {
    identificator = urlObject.pathname.substring(9);
  } else {
    const ID = await YTGetID(browser, String(url));
    console.log(ID, "URLDeterminantID");
    if (ID) identificator = ID;
    else throw "Invalid url or timeout";
  }

  console.log("Identificator determination: SUCCESS", "ChannelTypeMiddleware");

  return identificator;
}

export async function GetMainInfo(
  channelID,
  { skipMedia, browserContext } = {}
) {
    const key = AppConfig().getYoutubeApiKey();

  return await Promise.allSettled([
    YTGetChannelInfo(
      String(channelID),
      ["id", "snippet", "contentDetails", "statistics"],
      key
    ),
    YTScrapeLinks(browserContext, channelID, skipMedia),
    YTLastVideo(channelID, ["snippet"], key),
  ])
    .then((results) => {
      if (
        results[0].status === "fulfilled" &&
        results[1].status === "fulfilled" &&
        results[2].status === "fulfilled"
      ) {
        const channels = results[0].value.data.items;
        const lastVideo = results[2].value.data.items[0];
        if (!channels) throw "No channel found.";

        const { title, description, country, defaultLanguage, publishedAt } =
          channels[0].snippet;
        const { subscriberCount, viewCount, videoCount } =
          channels[0].statistics;

        const emailInMainDescription = EmailFinder(
          description,
          "channel description"
        );
        const emailInLastVideoDescription = EmailFinder(
          lastVideo?.snippet.description,
          "last video description"
        );

        return {
          id: channels[0].id,
          title,
          description,
          email: emailInMainDescription || emailInLastVideoDescription,
          url: `https://youtube.com/channel/${channels[0].id}`,
          country,
          defaultLanguage: defaultLanguage || "",
          subscriberCount,
          viewCount,
          videoCount,
          socialLinks: JSON.stringify(results[1].value),
          lastVideoPublishedAt: lastVideo?.snippet.publishedAt,
          publishedAt,
        };
      } else {
        throw `Youtube API calls error: ${
          results[0].status === "rejected"
            ? "Maininfo"
            : results[1].status === "rejected"
            ? "Social links"
            : results[2].status === "rejected"
            ? "Last video"
            : "undefined"
        }`;
      }
    })
    .catch((error) => {
      throw error;
    });
}

// Helper functions
export async function YTGetID(browser, url) {
  let id = null;

  try {
    const page = await browser.newPage();
    // Enable request interception
    await page.setRequestInterception(true);

    // Intercept requests and block certain resource types
    page.on("request", (req) => {
      if (
        req.resourceType() === "stylesheet" ||
        req.resourceType() === "font" ||
        req.resourceType() === "image"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.goto(url, {
      waitForFunction: () =>
        window.ytInitialData.metadata.channelMetadataRenderer.rssUrl,
      timeout: 0,
    });

    console.log("Waiting for page load", "IDScraper");

    const current_URL = await page.evaluate(() => {
      return document.URL;
    });

    console.log(current_URL, "RejectButton");

    const isOtherPage = current_URL !== url;

    if (isOtherPage) {
      // There is a cookies page, so click "Reject all" button
      await page.waitForSelector("[aria-label='Reject all']", {
        timeout: 3000,
      });

      await page.evaluate(() => {
        const button = document.querySelector("[aria-label='Reject all']");
        button.click();
      });

      await page.waitForTimeout(2000);
    }

    if (isOtherPage)
      await page.goto(url, {
        waitForFunction: () =>
          window.ytInitialData.metadata.channelMetadataRenderer.rssUrl,
        timeout: 0,
      });

    id = await page.evaluate(() => {
      const searchParam = new URL(
        window.ytInitialData.metadata.channelMetadataRenderer.rssUrl
      ).searchParams;
      return searchParam.get("channel_id");
    });
  } catch (e) {
    console.log(e, "YTScrapeID");
  } finally {
    return id;
  }
}
export async function YTScrapeLinks(browser, identificator, skip = false) {
  if (skip) return;

  let links = null;

  try {
    const page = await browser.newPage();
    // Enable request interception
    await page.setRequestInterception(true);

    // Intercept requests and block certain resource types
    page.on("request", (req) => {
      if (
        req.resourceType() === "stylesheet" ||
        req.resourceType() === "font" ||
        req.resourceType() === "image"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.goto(`https://www.youtube.com/channel/${identificator}/about`, {
      waitUntil: "load",
      timeout: 0,
    });
    console.log("Waiting for selector", "LinksScraper");

    await page.waitForSelector("#links-section");
    
    links = await page.evaluate(function () {
      return Array.from(document.querySelectorAll("#links-section a")).map(
        (el) =>
          new URLSearchParams(decodeURIComponent(el.getAttribute("href"))).get(
            "q"
          )
      );
    });
    console.log('Social links', links);
    return links;
  } catch (e) {
    console.log(e, "YTScrapeLinks");
    return;
  }
}
export async function YTCheckEmailCaptcha(browser, identificator) {
  let captchaExists;
  let recaptcha = null;

  try {
    const page = await browser.newPage();
    // Enable request interception
    await page.setRequestInterception(true);

    // Intercept requests and block certain resource types
    page.on("request", (req) => {
      if (
        req.resourceType() === "stylesheet" ||
        req.resourceType() === "font" ||
        req.resourceType() === "image"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.goto(`https://www.youtube.com/channel/${identificator}/about`, {
      waitUntil: "load",
      timeout: 0,
    });

    console.log("Waiting for email selector", "EmailCaptchaScraper");

    try {
      await page.waitForSelector("#recaptcha", { timeout: 5000 });

      captchaExists = await page.evaluate(() => {
        const parentElement =
          document.querySelector("#recaptcha").parentElement
            .previousElementSibling.previousElementSibling;
        return !parentElement.hidden;
      });

      console.log(recaptcha, "EmailCaptchaScraper");
    } catch (error) {
      // Ignore
      Logger.error(
        "Error while scraping email captcha: " + error,
        "EmailCaptchaScraper"
      );
    }

    console.log(`Captcha with email: ${captchaExists}`, "EmailCaptchaScraper");
  } catch (e) {
    console.log(e, "YTScrapeLinks");
  } finally {
    return captchaExists;
  }
}
export function YTGetChannelInfo(id, part, key) {
  console.log("Youtube API call " + key, "ChannelInfo");
  return service.channels.list({
    part,
    id: [id],
    key: key,
  });
}
export function YTLastVideo(id, part, key) {
  console.log("Youtube API call", "PlaylistInfo");
  return service.playlistItems.list({
    part,
    playlistId: `UU` + id.substring(2),
    maxResults: 1,
    key: key,
  });
}
export function EmailFinder(text, context) {
  const matches = text.match(
    /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi
  );

  console.log(
    `Email ${matches ? "found" : "not found"} in ${
      context || "the given context"
    }`,
    "EmailFinder"
  );

  return matches ? matches[0] : null;
}

export function getRootFolderName(path) {
  const rootDir = path.match(/[^/\\]+/) || [null];
  return rootDir[0];
}
export function CSVToArray(strData, strDelimiter) {
  // Check to see if the delimiter is defined. If not,
  // then default to comma.
  strDelimiter = strDelimiter || ",";

  // Create a regular expression to parse the CSV values.
  var objPattern = new RegExp(
    // Delimiters.
    "(\\" +
      strDelimiter +
      "|\\r?\\n|\\r|^)" +
      // Quoted fields.
      '(?:"([^"]*(?:""[^"]*)*)"|' +
      // Standard fields.
      '([^"\\' +
      strDelimiter +
      "\\r\\n]*))",
    "gi"
  );

  // Create an array to hold our data. Give the array
  // a default empty first row.
  var arrData = [[]];

  // Create an array to hold our individual pattern
  // matching groups.
  var arrMatches = null;

  // Keep looping over the regular expression matches
  // until we can no longer find a match.
  while ((arrMatches = objPattern.exec(strData))) {
    // Get the delimiter that was found.
    var strMatchedDelimiter = arrMatches[1];

    // Check to see if the given delimiter has a length
    // (is not the start of string) and if it matches
    // field delimiter. If id does not, then we know
    // that this delimiter is a row delimiter.
    if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
      // Since we have reached a new row of data,
      // add an empty row to our data array.
      arrData.push([]);
    }

    var strMatchedValue;

    // Now that we have our delimiter out of the way,
    // let's check to see which kind of value we
    // captured (quoted or unquoted).
    if (arrMatches[2]) {
      // We found a quoted value. When we capture
      // this value, unescape any double quotes.
      strMatchedValue = arrMatches[2].replace(new RegExp('""', "g"), '"');
    } else {
      // We found a non-quoted value.
      strMatchedValue = arrMatches[3];
    }

    // Now that we have our value string, let's add
    // it to the data array.
    arrData[arrData.length - 1].push(strMatchedValue);
  }

  // Return the parsed data.
  return arrData;
}