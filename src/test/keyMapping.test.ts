import { describe, expect, it } from 'vitest';
import { buildChordMap, describeChord, guideFor, resolveChord, resolvePhysicalKey } from '../input/keyMapping';

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

describe('umlaut chords', () => {
  it('defaults to AltGr + the physical key of the base letter', () => {
    const pos = buildChordMap('positional', {});
    expect(resolveChord(pos, { code: 'KeyA', altGr: true })).toBe('ä');
    expect(resolveChord(pos, { code: 'Semicolon', altGr: true })).toBe('ö'); // o lives on Semicolon
    expect(resolveChord(pos, { code: 'KeyI', altGr: true })).toBe('ü'); // u lives on KeyI
    expect(resolveChord(pos, { code: 'KeyD', altGr: true })).toBe('ß'); // s lives on KeyD
    expect(resolveChord(pos, { code: 'KeyA', altGr: false })).toBeUndefined();
  });

  it('uses the base letter code in firmware mode', () => {
    const fw = buildChordMap('firmware', {});
    expect(resolveChord(fw, { code: 'KeyO', altGr: true })).toBe('ö');
    expect(resolveChord(fw, { code: 'KeyS', altGr: true })).toBe('ß');
  });

  it('honours rebinding, including unmodified keys outside the layout', () => {
    const map = buildChordMap('positional', { 'ä': { code: 'Quote', altGr: false } });
    expect(resolveChord(map, { code: 'Quote', altGr: false })).toBe('ä');
    expect(resolveChord(map, { code: 'KeyA', altGr: true })).toBeUndefined();
  });

  it('describes chords by what the key types', () => {
    expect(describeChord({ code: 'KeyI', altGr: true }, 'positional')).toBe('AltGr + u');
    expect(guideFor('ö', 'positional', {})).toMatchObject({ altGr: true, label: 'AltGr + o', key: { code: 'Semicolon' } });
    expect(guideFor('t', 'positional', {})).toMatchObject({ altGr: false, key: { code: 'KeyF' } });
  });
});
