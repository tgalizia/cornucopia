# Privacy policy for Cornucopia

Cornucopia is a browser extension that inspects the page you are looking at. It does not collect, transmit, or sell personal data.

## What stays on your machine

- Font styles, element boxes, and pixel colors are read in the tab to draw the overlay. They are not sent anywhere.
- Colors you save are stored in Chrome session storage. They are removed when the browser quits, when you clear the palette, or when the extension is reloaded.
- The window size from before a viewport resize is stored in Chrome session storage for that browser session, so Restore can put the window back.
- If you start Clear site data, a confirmation is stored in Chrome local storage for up to two minutes and then deleted. That record identifies the tab you asked to clear. It is not sent anywhere.
- On Google Docs, a script runs in the page when a document loads and asks the editor to keep text positions so Typography can read them. Those positions stay in the tab.

## Site data you ask to delete

Clear site data runs only after you choose it. The first time, Chrome asks you to allow deletion of browsing data. Cornucopia then deletes cookies for that site's domain and the HTTP cache and Cache Storage for that origin, and reloads the tab. It does not read the contents of those cookies. It does not clear other sites, history, or passwords.

## What Cornucopia does not do

There is no account, no analytics, and no remote server. The extension makes no network request of its own.

## Contact

Questions about this policy can be opened as an issue on https://github.com/tgalizia/cornucopia.
