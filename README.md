# Scrape URLs

A node script that scrapes from an initial URL linked URLs, under the same origin, recursively. It then reports in the console:

- The unique characters from the HTML pages it visited.
- The URLs it discovered and visited. In other words, you get a list with all the linked pages under the same origin.
- A list of URLs it discovered and not visited because they are not from the same origin. In other words, you get a list with all the URLs you link to (this list also includes URLs with hashes and non http/https, though).

## Usage

```txt
scrape-characters-node [option..] <url>
```

## Future updates

There's a (small) chance to extend it to search for other information, not only URL lists and characters. This is because the ability to recursively discover URLs from a root URL seems useful (I'm sure there are many programs that already do this, but, oh well). I could implement this by parsing additional options in the CLI, or even with a callback, if I export a function that you then can import in your code.

For the time being, I'm _not_ considering to execute JavaScript with a tool like Puppeteer, because the information I want doesn't require it.
