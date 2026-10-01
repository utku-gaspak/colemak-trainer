import { describe, expect, it } from 'vitest';
import { resolvePhysicalKey } from '../input/keyMapping';

describe('resolvePhysicalKey', () => {
  it('remaps QWERTY positions to Colemak-DH in positional mode', () => {
    expect(resolvePhysicalKey('KeyF', 'positional')?.char).toBe('t');
    expect(resolvePhysicalKey('KeyS', 'positional')?.char).toBe('r');
    expect(resolvePhysicalKey('Semicolon', 'positional')?.char).toBe('o');
    expect(resolvePhysicalKey('KeyM', 'positional')?.char).toBe('h');
    expect(resolvePhysicalKey('KeyV', 'positional')?.char).toBe('d');
    expect(resolvePhysicalKey('Space', 'positional')?.char).toBe(' ');
  });

  it('reads codes as already-Colemak in firmware mode, keeping physical metadata', () => {
    const t = resolvePhysicalKey('KeyT', 'firmware');
    expect(t?.char).toBe('t');
    expect(t?.code).toBe('KeyF'); // physical position of "t"
    expect(t?.finger).toBe('index');
    expect(t?.hand).toBe('left');
  });

  it('ignores unmapped codes', () => {
    expect(resolvePhysicalKey('Digit1', 'positional')).toBeUndefined();
    expect(resolvePhysicalKey('Quote', 'firmware')).toBeUndefined();
  });
});
