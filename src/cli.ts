#! /usr/bin/env node

import fetch from "node-fetch";
import type { Response } from "node-fetch";
import cheerio from "cheerio";

import { darkGray, green, red, reset, yellow } from "./colors.js";

const version = "0.1.0";
const programName = "scrape-characters";
const verbose =
  process.argv.includes("-V") || process.argv.includes("--verbose");
// TODO Examine if a not found error in fetch stops the script execution. Meaning after the initial root URL.
// TODO maybe two verbose levels. The first will print the "Sleeping for" message,
// and the second the "back to it" + is ValidHrefErrors.

// TODO parse those program options as option parameters from the user.
const delay = 5000;
const maxIterations = 150;
const ignoreUrlsWithHashes = true;
let exitNow = false;

process.on("SIGINT", function onInterruptSignal() {
  console.warn(
    `${yellow}warning${reset} (${programName}): Caught interrupt signal and will try to exit as soon as possible. I will also print the results so far. Please wait.`
  );

  process.exitCode = 1;
  exitNow = true;
});

const args = process.argv.slice(2);

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

function difference<T>(setA: Set<T>, setB: Set<T>) {
  const setDifference = new Set(setA);
  // eslint-disable-next-line no-restricted-syntax
  for (const element of setB) {
    setDifference.delete(element);
  }
  return setDifference;
}

async function sleepFor(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function wrapInQuotes(input: string) {
  return `'${input}'`;
}

function setToWrappedString(set: Set<string>) {
  return Array.from(set).sort().map(wrapInQuotes).join(", ");
}

const checkStatus = (response: Response) => {
  if (response.ok) return response;

  throw new Error(response.statusText);
};

class ValidHrefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidHrefError";
  }
}

function isValidHref(href: string, baseUrl: string) {
  try {
    const candidate = new URL(href, baseUrl);
    if (!/^https?/.test(candidate.href))
      throw new ValidHrefError(
        `The URL ${candidate.href} is not an http/https URL. The program will ignore it.`
      );
    if (!candidate.href.startsWith(baseUrl))
      throw new ValidHrefError(
        `The url '${candidate.href}' is not from the same origin as '${baseUrl}'. The program will ignore it.`
      );
    if (ignoreUrlsWithHashes && candidate.hash.length > 0)
      throw new ValidHrefError(
        `The url has hashes, and the program is setup to ignore urls with hashes, to avoid unnecessary requests => '${candidate.href}'.`
      );
    return candidate.href;
  } catch (error: unknown) {
    if (error instanceof ValidHrefError) {
      if (verbose)
        console.warn(
          `${yellow}warning${darkGray} ${error.name} (${programName}): ${error.message}${reset}`
        );
    } else if (error instanceof Error) {
      if (verbose)
        console.warn(
          `${yellow}warning${darkGray} ${error.name} (${programName}): ${error.message}${reset}`
        );
    } else throw error;

    return false;
  }
}

type State = {
  iterations: number;
  visitedHrefs: Set<string>;
  legitHrefs: Set<string>;
  invalidHrefs: Set<string>;
  characters: Set<string>;
};

// This method has try/catch because, if you think about it,
// it's the main method. The only reason it's in a different
// function, it's because of the recursion.
async function getResults(rootHref: string) {
  const initialState: State = {
    iterations: 0,
    visitedHrefs: new Set(),
    legitHrefs: new Set([rootHref]),
    invalidHrefs: new Set(),
    characters: new Set(),
  };

  async function getResultsInner(
    currentRootHref: string,
    state: State
  ): Promise<State> {
    async function whatToDoNext(newState: State) {
      const remainingHrefs = Array.from(
        difference(newState.legitHrefs, newState.visitedHrefs)
      );

      performance.mark("get-results-inner-end");
      const { duration: executionTime } = performance.measure(
        "get-results-inner",
        "get-results-inner-start",
        "get-results-inner-end"
      );

      const timeToSleep = delay - executionTime;
      if (verbose) {
        console.info(
          `${darkGray}info (${programName}): Sleeping for ${Number(
            timeToSleep
          ).toFixed(0)} milliseconds to avoid server bans.${reset}`
        );
      }
      await sleepFor(timeToSleep);
      if (verbose) {
        console.info(
          `${darkGray}info (${programName}): Well, back to it! Those URLs ain't going to download themselves, huha!${reset}`
        );
      }

      if (
        exitNow ||
        newState.iterations === maxIterations ||
        remainingHrefs.length === 0
      )
        return newState;

      return getResultsInner(remainingHrefs[0], newState);
    }

    performance.mark("get-results-inner-start");
    let newState: State = state;
    try {
      // 1. FETCH HTML STRING
      state.visitedHrefs.add(currentRootHref);
      const response = await fetch(currentRootHref, {
        headers: {
          Accept: "text/html",
        },
      });
      const responseOk = checkStatus(response);

      const contentType = responseOk.headers.get("content-type");
      if (typeof contentType !== "string")
        throw new Error(
          `Checked the content-type header and got back null for the url '${currentRootHref}'. The program will ignore this URL.`
        );
      if (!contentType.includes("text/html"))
        throw new Error(
          `The content-type header for url '${currentRootHref}' is '${contentType}'. The program accepts only text/html as content-type in the response.`
        );

      const body = await responseOk.text();

      // 2. PARSE HTML STRING
      const $ = cheerio.load(body);

      // 3. GET LEGIT AND FAILING URLs
      const hrefs = $("a")
        .map((_index, element) => $(element).attr("href"))
        .get();
      // eslint-disable-next-line no-restricted-syntax
      for (const href of hrefs) {
        const candidate = isValidHref(href, rootHref); // isValidHref doesn't throw, by the way, unless the error is not an instance of Error.
        if (candidate === false) {
          state.invalidHrefs.add(href);
        } else {
          state.legitHrefs.add(candidate);
        }
      }

      // 4. GET UNIQUE CHARACTERS
      const bodyText = $("body").text();
      const newCharacters = new Set(bodyText);
      const characters = new Set([...state.characters, ...newCharacters]);

      newState = {
        iterations: state.iterations + 1,
        visitedHrefs: state.visitedHrefs,
        legitHrefs: state.legitHrefs,
        invalidHrefs: state.invalidHrefs,
        characters,
      };
    } catch (error: unknown) {
      console.error(
        `${red}error${reset} getResults (${programName}): Processed the url '${currentRootHref}' with errors => ${String(
          error
        )}`
      );
      process.exitCode = 1;
      return await whatToDoNext(newState);
    }
    console.info(
      `${green}success${reset} (${programName}): Processed successfully the url (${newState.visitedHrefs.size}/${newState.legitHrefs.size}) '${currentRootHref}'.`
    );
    return whatToDoNext(newState);
  }

  return getResultsInner(rootHref, initialState);
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
    const rootHref = isValidHref(positional[0], positional[0]);
    if (rootHref === false) {
      console.error(
        `${red}error${reset} (${programName}): '${positional[0]}' is not a valid URL. `
      );
      process.exit(1);
    }

    try {
      // 3. GET ALL THE RESULTS
      const { legitHrefs, invalidHrefs, characters, iterations, visitedHrefs } =
        await getResults(rootHref);

      // 4. PRINT RESULTS
      const uniqueCharacterString = Array.from(characters)
        // If the compare function is omitted, the array elements are converted to strings,
        // and then sorted according to each character's Unicode code point value.
        // That's exactly what we want, so that's why we sort first.
        .sort()
        .map((character) => {
          const codePoint = character.codePointAt(0);
          if (codePoint === undefined) {
            console.warn(
              `${yellow}warning${reset} (${programName}): Could not infer a codepoint for character '${character}'.`
            );
            process.exitCode = 1;
          }
          return codePoint;
        })
        .map((codePoint) => codePoint?.toString(16))
        .join(" ");
      const goodUrlString = setToWrappedString(legitHrefs);
      const badUrlString = setToWrappedString(invalidHrefs);
      const badUrlOutput =
        badUrlString.length > 0
          ? `${yellow}your bad URLs (${invalidHrefs.size}) are => ${badUrlString}${reset}, `
          : "";

      console.log(
        `${green}success${reset} (${programName}): Visited ${green}${visitedHrefs.size}${reset} URLs in ${green}${iterations}${reset} iterations. Your ${green}root url is '${rootHref}'${reset}, the ${green}good URLs (${legitHrefs.size}) are =>${reset} ${goodUrlString}, ${badUrlOutput}and the ${green}unique characters (${characters.size}) in hex are =>${reset} '${uniqueCharacterString}'.`
      );
    } catch (error: unknown) {
      console.error(
        `${red}error${reset} general (${programName}): ${String(error)}`
      );
      process.exit(1);
    }

    if (process.exitCode === undefined) {
      process.exitCode = 0;
    }
  }

  process.on("exit", function onExit() {
    if (process.exitCode !== undefined && process.exitCode !== 0) {
      console.warn(
        `${yellow}warning${reset} (${programName}): Program exited with errors.`
      );
    } else if (process.exitCode === 0) {
      console.info(
        `${green}success${reset} (${programName}): Program exited successfully without errors.`
      );
    }
  });
})();
