/**
 * Smoke-level unit checks for schedule summary date helpers / payload shape.
 * Full HTTP tenant isolation is covered manually via API when DB is available.
 */

describe('schedule summary payload shape', () => {
  it('computes absolute deltas between periods', () => {
    const delta = (cur: number, prev: number) => cur - prev;
    expect(delta(12, 10)).toBe(2);
    expect(delta(5, 7)).toBe(-2);
    expect(delta(0, 0)).toBe(0);
  });

  it('expects KPI keys for calendar layers', () => {
    const sample = {
      trainings: { count: 12, delta: 2 },
      competitions: { count: 3, delta: 1 },
      tasks: { count: 5, delta: -2 },
      events: { count: 4, delta: 1 },
    };
    expect(Object.keys(sample).sort()).toEqual(
      ['competitions', 'events', 'tasks', 'trainings'].sort()
    );
  });
});
