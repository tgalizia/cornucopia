// Google Docs only exposes canvas text positions to an allow-listed extension id.
// This id is the one Yomitan uses for the same hook. It has to be set in the page
// world before the Docs editor starts, which is why this file is a document_start script.
window._docs_annotate_canvas_by_ext = 'ogmnaimimemjmbakcfefmnahgdfhfami'
