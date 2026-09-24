import { bucketWeeklySignups } from '../../src/modules/platform-stats/platform-stats.util';

describe('bucketWeeklySignups', () => {
  const now = new Date('2026-09-24T12:00:00.000Z'); // a Thursday

  it('returns `weeks` empty buckets for no signups', () => {
    const result = bucketWeeklySignups([], [], 4, now);
    expect(result).toHaveLength(4);
    expect(result.every((b) => b.users === 0 && b.organisations === 0)).toBe(true);
  });

  it('tallies a date into the bucket for its week', () => {
    // 2026-09-21 is the Monday of the week containing `now`.
    const result = bucketWeeklySignups([new Date('2026-09-23T08:00:00.000Z')], [], 2, now);
    expect(result[1]).toEqual({
      weekStart: '2026-09-21T00:00:00.000Z',
      users: 1,
      organisations: 0,
    });
    expect(result[0].users).toBe(0);
  });

  it('drops dates outside the requested window', () => {
    const result = bucketWeeklySignups([], [new Date('2020-01-01T00:00:00.000Z')], 2, now);
    expect(result.reduce((sum, b) => sum + b.organisations, 0)).toBe(0);
  });

  it('tallies users and organisations independently in the same week', () => {
    const result = bucketWeeklySignups(
      [new Date('2026-09-22T00:00:00.000Z'), new Date('2026-09-23T00:00:00.000Z')],
      [new Date('2026-09-22T00:00:00.000Z')],
      1,
      now,
    );
    expect(result).toEqual([{ weekStart: '2026-09-21T00:00:00.000Z', users: 2, organisations: 1 }]);
  });
});
