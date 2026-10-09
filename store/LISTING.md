# Chrome Web Store listing

Upload `release/cornucopia-<version>.zip` from `npm run package`. The dashboard still needs the text below, at least one screenshot (1280×800 or 640×400), and a developer account.

Privacy policy URL, after this repository is public:

https://github.com/tgalizia/cornucopia/blob/main/PRIVACY.md

## Single purpose

Inspect the page in front of you: typography, color, measurement, a baseline grid, and the viewport. Optionally clear that site's cookies and cache. Everything runs locally in the browser.

## Detailed description

Cornucopia is a local developer extension. Click the toolbar icon, pick a tool, and inspect the page you are looking at. Nothing is uploaded. There is no account and no analytics.

- Typography reads the font under the pointer. Click to pin the card and copy CSS.
- Color reads a pixel, saves it to a session palette, and shows contrast for the two newest colors.
- Measure outlines an element or a rectangle you drag.
- Grid draws a baseline grid you can resize.
- Viewport resizes the window to a common width, or a custom size, and can restore it.
- Clear site data deletes cookies and cache for the current site after you confirm, then reloads the tab.

Page tools work on http and https pages. chrome:// pages and the Chrome Web Store cannot be inspected.

## Category

Developer tools

## Language

English

## Permission justifications

Paste one block per permission in the dashboard.

**activeTab.** Inject the inspection overlay into the tab just opened from the toolbar icon.

**scripting.** Insert that overlay script into the same tab.

**storage.** Keep the session color palette, the window size to restore, and a clear-site confirmation for up to two minutes. None of this leaves the browser.

**windows.** Resize and restore the browser window for viewport sizes.

**Host permission `https://docs.google.com/*`.** When a Google Doc loads, run a page script that asks the editor to keep text positions so Typography can read fonts. The positions stay in the tab.

**Optional permission `browsingData`.** Requested only after you choose Clear site data, and only to delete cookies and cache for that site.

**Optional host permissions `http://*/*` and `https://*/*`.** Requested together with Clear site data, because Chrome deletes browsing data only for origins the extension may access. Cornucopia does not use these permissions to read page content.

## Data use

In the privacy questionnaire, answer that the extension does not collect user data, does not sell data, and does not use data for purposes unrelated to the tool the user opened.

## Before you upload

`docs-annotate.js` is included in the package. It runs in the page when a Google Doc loads so the editor keeps text positions for Typography. Use the host-permission justification above if the review asks about it.

## Screenshot

Upload `store/screenshot-menu.png`. It is 1280×800, which is the size the dashboard requires, and it shows the menu on a page.
