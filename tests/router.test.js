import { describe, it, expect } from 'vitest';
import { parse } from '../src/router.js';

describe('hash router', () => {
  it('parses routes and params', () => {
    expect(parse('')).toEqual({ name: 'home', params: {} });
    expect(parse('#/')).toEqual({ name: 'home', params: {} });
    expect(parse('#/map')).toEqual({ name: 'map', params: {} });
    expect(parse('#/map/beginner')).toEqual({ name: 'map', params: { focus: 'beginner' } });
    expect(parse('#/lesson/noob-09')).toEqual({ name: 'lesson', params: { id: 'noob-09' } });
    expect(parse('#/songs')).toEqual({ name: 'songs', params: {} });
    expect(parse('#/nope')).toEqual({ name: 'home', params: {} });
  });
});
