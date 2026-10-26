import { describe, it, expect } from 'vitest';
import { hasTag, addTag, removeTag, HOUSE_MAINTENANCE_TAG } from './notesTags';

describe('notesTags', () => {
  it('adds a tag to empty notes', () => {
    expect(addTag('', HOUSE_MAINTENANCE_TAG)).toBe('#house-maintenance');
  });

  it('appends a tag to existing notes with a separator', () => {
    expect(addTag('Statement import', HOUSE_MAINTENANCE_TAG)).toBe('Statement import; #house-maintenance');
  });

  it('does not double-add an already-present tag', () => {
    const once = addTag('Statement import', HOUSE_MAINTENANCE_TAG);
    expect(addTag(once, HOUSE_MAINTENANCE_TAG)).toBe(once);
  });

  it('detects a tag regardless of what else is in the notes', () => {
    expect(hasTag('Statement import; #house-maintenance', HOUSE_MAINTENANCE_TAG)).toBe(true);
    expect(hasTag('Statement import', HOUSE_MAINTENANCE_TAG)).toBe(false);
    expect(hasTag('', HOUSE_MAINTENANCE_TAG)).toBe(false);
    expect(hasTag(undefined, HOUSE_MAINTENANCE_TAG)).toBe(false);
  });

  it('removes a tag and cleans up the leftover separator', () => {
    expect(removeTag('Statement import; #house-maintenance', HOUSE_MAINTENANCE_TAG)).toBe('Statement import');
    expect(removeTag('#house-maintenance', HOUSE_MAINTENANCE_TAG)).toBe('');
  });

  it('round-trips add then remove back to the original notes', () => {
    const original = 'Statement import; Work expense #42';
    const tagged = addTag(original, HOUSE_MAINTENANCE_TAG);
    expect(removeTag(tagged, HOUSE_MAINTENANCE_TAG)).toBe(original);
  });
});
