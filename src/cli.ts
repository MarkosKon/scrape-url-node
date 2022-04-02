#! /usr/bin/env node

import fetch from "node-fetch";
import type { Response } from "node-fetch";
import cheerio from "cheerio";

import { darkGray, green, red, reset, yellow } from "./colors.js";

const version = "0.1.0";
const programName = "scrape-characters";
const verbose =
  process.argv.includes("-V") || process.argv.includes("--verbose");
const delay = 0;

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

function isValidHref(href: string, baseUrl: string) {
  try {
    const candidate = new URL(href, baseUrl).href;
    if (!/^https?/.test(candidate))
      throw new Error("Only interested in http urls");
    if (!candidate.startsWith(baseUrl))
      throw new Error("The url is not from the same origin.");
    return candidate;
  } catch {
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

async function getResults(rootHref: string, maxIterations = 1) {
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
    // 1. FETCH HTML STRING
    const response = await fetch(currentRootHref);
    const body = await checkStatus(response).text();
    state.visitedHrefs.add(currentRootHref);

    // 2. PARSE HTML STRING
    const $ = cheerio.load(body);

    // 3. GET LEGIT AND FAILING URLs
    const hrefs = $("a")
      .map((_index, element) => $(element).attr("href"))
      .get();
    // eslint-disable-next-line no-restricted-syntax
    for (const href of hrefs) {
      const candidate = isValidHref(href, rootHref);
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

    const newState = {
      iterations: state.iterations + 1,
      visitedHrefs: state.visitedHrefs,
      legitHrefs: state.legitHrefs,
      invalidHrefs: state.invalidHrefs,
      characters,
    };

    const remainingHrefs = Array.from(
      difference(newState.legitHrefs, newState.visitedHrefs)
    );
    console.log({ remainingHrefs });
    if (newState.iterations === maxIterations || remainingHrefs.length === 0)
      return newState;
    // TODO: Add delay into the mix because you might get blocked by the server.
    // do it with setTimeout(getResultInner(...), delay);
    // TODO: Right now, with a single error inside this method, we don't return anything.
    // If you think about it, this is the main method that should try/catch.
    // The only reason it's in a different function, it's because of the recursion.

    // 5. RETURN RESULTS
    return getResultsInner(remainingHrefs[0], newState);
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
      const uniqueCharacterString = setToWrappedString(characters);
      const goodUrlString = setToWrappedString(legitHrefs);
      const badUrlString = setToWrappedString(invalidHrefs);
      const badUrlOutput =
        badUrlString.length > 0
          ? `${yellow}your bad URLs (${invalidHrefs.size}) are => ${badUrlString}${reset}, `
          : "";

      console.log(
        `${green}success${reset} (${programName}): Visited ${green}${visitedHrefs.size}${reset} URLs in ${green}${iterations}${reset} iterations. Your ${green}root url is '${rootHref}'${reset}, the ${green}good URLs (${legitHrefs.size}) are =>${reset} ${goodUrlString}, ${badUrlOutput}and the ${green}unique characters (${characters.size}) are =>${reset} ${uniqueCharacterString}.`
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
    } else if (process.exitCode === 0 && verbose) {
      console.info(
        `${darkGray}info (${programName}): Program exited successfully.${reset}`
      );
    }
  });
})();
