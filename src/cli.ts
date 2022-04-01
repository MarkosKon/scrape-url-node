#! /usr/bin/env node

import { darkGray, green, red, reset, yellow } from "./colors.js";

const version = "0.1.0";
// const programName = process.argv[1];
const programName = "scrape-characters";
const verbose =
  process.argv.includes("-V") || process.argv.includes("--verbose");

const delay = 0;

const args = process.argv.slice(2);

function getUniqueCharacters(input: string) {
  return Array.from(new Set(input)).sort();
}

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

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
} else if (args.includes("--version") || args.includes("-v")) {
  console.log(version);
  process.exit(0);
} else {
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

  let url;
  try {
    url = new URL(positional[0]);
  } catch (error: unknown) {
    console.error(
      `${red}error${reset} (${programName}): "${
        positional[0]
      }" is not a valid URL. ${String(error)}`
    );
    process.exit(1);
  }

  const urlToString = String(url);
  const characters = getUniqueCharacters(urlToString);
  console.log(
    `${green}success${reset} (${programName}): You url is '${urlToString}', and the unique characters are "${characters
      .map((character) => `'${character}'`)
      .join(", ")}".`
  );

  process.exitCode = 0;
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
