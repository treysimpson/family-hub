// Generic convention for attaching a lightweight, cross-category marker to a
// transaction's free-text Notes field (column F of Transactions) without
// touching the sheet schema -- same spirit as the existing "Statement
// import" / "Order ..." notes the Apps Script already writes there. A tag is
// appended as "#tag-name"; multiple notes/tags on one row are joined with
// "; " the same way "Statement import; Work expense match" already is.
//
// Added for T-32 (house-maintenance tag, 2026-10-26): HVAC service calls,
// repairs and contractor work span both "household" (routine upkeep) and
// "one-time" (a big job like a full HVAC replacement), so a tag works
// better than a new category -- it layers a filter/total on top of
// whatever category a transaction already has, same way the Fixed Bills
// "Fixed" badge layers on top without changing a transaction's category.

export const HOUSE_MAINTENANCE_TAG = 'house-maintenance';

function tagPattern(tag) {
  return new RegExp(`#${tag}\\b`, 'i');
}

export function hasTag(notes, tag) {
  return tagPattern(tag).test(notes || '');
}

export function addTag(notes, tag) {
  if (hasTag(notes, tag)) return notes || '';
  const token = `#${tag}`;
  return notes ? `${notes}; ${token}` : token;
}

export function removeTag(notes, tag) {
  return (notes || '')
    .replace(new RegExp(`\\s*;?\\s*#${tag}\\b`, 'i'), '')
    .replace(/^;\s*/, '')
    .trim();
}
