export function choose<T>(items: readonly T[], count: number): T[][] {
  if (count <= 0 || count > items.length) {
    return [];
  }

  const result: T[][] = [];
  const current: T[] = [];

  function backtrack(start: number): void {
    if (current.length === count) {
      result.push([...current]);
      return;
    }

    for (let i = start; i <= items.length - (count - current.length); i += 1) {
      current.push(items[i]);
      backtrack(i + 1);
      current.pop();
    }
  }

  backtrack(0);
  return result;
}
