#! /usr/bin/env node

import fetch from "node-fetch";
import type { Response } from "node-fetch";
import cheerio from "cheerio";

import { darkGray, green, red, reset, yellow } from "./colors.js";

const version = "0.1.0";
// const programName = process.argv[1];
const programName = "scrape-characters";
const verbose =
  process.argv.includes("-V") || process.argv.includes("--verbose");

const delay = 0;

const args = process.argv.slice(2);

function wrapInQuotes(input: string) {
  return `'${input}'`;
}

function setToWrappedString(set: Set<string>) {
  return Array.from(set).sort().map(wrapInQuotes).join(", ");
}

const checkStatus = (response: Response) => {
  // response.ok = (response.status >= 200 && response.status < 300)
  if (response.ok) return response;

  throw new Error(response.statusText);
};

function printHelp() {
  console.log(`Usage: ${programName} [OPTION].. <URL>

Get unique page characters from the URL and its linked pages that are under the same domain.

Options:
  -V, --verbose              : Show additional information during execution.
  -v, --version              : Show the version number.
  -h, --help                 : Show this help menu.

Examples:
  1) ${programName} --pwd
  2) ${programName} -h

Made by Markos Konstantopoulos (https://markoskon.com).
For bugs and feature requests, please open an issue at https://github.com/your_username/your_repo/issues.
`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  } else if (args.includes("--version") || args.includes("-v")) {
    console.log(version);
    process.exit(0);
  } else {
    // 1. GET POSITIONAL ARGUMENTS
    const positional = args.filter((_argument) => !_argument.startsWith("-"));
    if (positional.length === 0) {
      printHelp();
      console.error(
        `${red}error${reset} (${programName}): Please provide a URL.`
      );
      process.exit(1);
    }

    if (positional.length > 1) {
      console.warn(
        `${yellow}warning${reset} (${programName}): You provided ${positional.length} URLs, but the program accepts only 1 at them moment.`
      );
    }

    // 2. GET URL
    let rootUrl: URL;
    try {
      rootUrl = new URL(positional[0]);
    } catch (error: unknown) {
      console.error(
        `${red}error${reset} (${programName}): '${
          positional[0]
        }' is not a valid URL. ${String(error)}`
      );
      process.exit(1);
    }

    // 3. FETCH HTML STRING
    let body;
    try {
      const response = await fetch(rootUrl.href);
      body = await checkStatus(response).text();
    } catch (error: unknown) {
      console.error(`${red}error${reset} (${programName}): ${String(error)}`);
      process.exit(1);
    }

    // 4. PARSE HTML STRING
    const $ = cheerio.load(body);

    // 5. GET LEGIT AND FAILING URLs
    const hrefs = $("a")
      .map((_index, element) => $(element).attr("href"))
      .get();

    const invalidHrefs: Set<string> = new Set();
    const legitHrefs: Set<string> = new Set();
    // eslint-disable-next-line no-restricted-syntax
    for (const href of hrefs) {
      try {
        legitHrefs.add(new URL(href, rootUrl).href);
      } catch {
        invalidHrefs.add(href);
      }
    }

    // 6. GET UNIQUE CHARACTERS
    const bodyText = $("body").text();
    const characters = new Set(bodyText);

    // 7. PRINT RESULTS
    const uniqueCharacterString = setToWrappedString(characters);
    const goodUrlString = setToWrappedString(legitHrefs);
    const badUrlString = setToWrappedString(invalidHrefs);
    const badUrlOutput =
      badUrlString.length > 0
        ? `${yellow}your bad URLs (${invalidHrefs.size}) are => ${badUrlString}${reset}, `
        : "";

    console.log(
      `${green}success${reset} (${programName}): Your ${green}root url is '${rootUrl.href}'${reset}, the ${green}good URLs (${legitHrefs.size}) are =>${reset} ${goodUrlString}, ${badUrlOutput}and the ${green}unique characters (${characters.size}) are =>${reset} ${uniqueCharacterString}.`
    );

    if (process.exitCode === undefined) {
      process.exitCode = 0;
    }
  }

  process.on("exit", function onExit() {
    if (process.exitCode !== undefined && process.exitCode !== 0) {
      console.warn(
        `${yellow}warning${reset} (${programName}): Program exited with errors.`
      );
    } else if (process.exitCode === 0 && verbose) {
      console.info(
        `${darkGray}info (${programName}): Program exited successfully.${reset}`
      );
    }
  });
})();
