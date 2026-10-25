# Chrome Web Store listing

Upload `release/cornucopia-<version>.zip` from `npm run package`. The dashboard still needs the text below, at least one screenshot (1280×800 or 640×400), and a developer account.

Official URL:

https://github.com/tgalizia/cornucopia

Privacy policy URL, after this repository is public:

https://github.com/tgalizia/cornucopia/blob/main/PRIVACY.md

## Single purpose

Inspect the page in front of you: typography, color, measurement, a baseline grid, and the viewport. Optionally rename that tab, or clear that site's cookies and cache. Everything runs locally in the browser.

## Summary

Paste this into the dashboard summary. On an update the dashboard often keeps the old summary, so paste it even though `manifest.json` already has the same line. It must stay within 132 characters.

Open-source developer extension: color picker, font picker, measure, viewport, and clear site cache. Local only.

## Detailed description

Cornucopia is an open-source developer extension for Chrome. It includes a color picker and a font picker, and it can measure the page, draw a baseline grid, resize the viewport, and clear this site's cache. Click the toolbar icon, pick a tool, and inspect the page you are looking at. Nothing is uploaded. There is no account and no analytics.

Source code: https://github.com/tgalizia/cornucopia

- Font picker. Typography reads the font under the pointer. Click to pin the card and copy CSS.
- Color picker. Color reads a pixel, saves it to a session palette, and shows contrast for the two newest colors.
- Measure outlines an element or a rectangle you drag.
- Grid draws a baseline grid you can resize.
- Viewport resizes the window to a common width, or a custom size, and can restore it.
- Rename tab gives the current tab a name that stays after a refresh or a browser restart, until the tab is closed or the name is cleared.
- Clear site data deletes cookies and cache for the current site after you confirm, then reloads the tab.

## Category

Developer tools

## Language

English

## Permission justifications

Paste one block per permission in the dashboard.

**activeTab.** Inject the inspection overlay into the tab just opened from the toolbar icon.

**tabs.** Read the address of each tab so the toolbar icon can be turned off on pages that cannot be inspected. The address is not stored or sent anywhere.

**scripting.** Insert that overlay script into the same tab.

**storage.** Keep the session color palette, the window size to restore, a clear-site confirmation for up to two minutes, and a custom tab name until that tab is closed. None of this leaves the browser.

**windows.** Resize and restore the browser window for viewport sizes.

**Host permission `https://docs.google.com/*`.** When a Google Doc loads, run a page script that asks the editor to keep text positions so Typography can read fonts. The positions stay in the tab.

**Optional permission `browsingData`.** Requested only after you choose Clear site data, and only to delete cookies and cache for that site.

**Optional host permissions `http://*/*` and `https://*/*`.** Requested from Clear site data, because Chrome deletes browsing data only for origins the extension may access, and from Rename tab, so a custom name can be put back when the tab loads again. Cornucopia does not use these permissions to read page content.

## Data use

In the privacy questionnaire, answer that the extension does not collect user data, does not sell data, and does not use data for purposes unrelated to the tool the user opened.

## Before you upload

`docs-annotate.js` is included in the package. It runs in the page when a Google Doc loads so the editor keeps text positions for Typography. Use the host-permission justification above if the review asks about it.

## Screenshot

Upload `store/screenshot-menu.png`. It is 1280×800, which is the size the dashboard requires, and it shows the menu on a page.
