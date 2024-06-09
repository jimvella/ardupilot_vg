export class ExponentialFilter {
  smoothingFactor: number;
  lastValue: number | undefined = undefined;

  constructor(smoothingFactor: number) {
    this.smoothingFactor = smoothingFactor;
  }

  apply(i: number): number {
    if (this.lastValue != undefined) {
      const result =
        this.smoothingFactor * i + (1 - this.smoothingFactor) * this.lastValue;
      this.lastValue = result;
      return result;
    } else {
      this.lastValue = i;
      return this.lastValue;
    }
  }

  // Convinience function
  applyArray(array: { x: number; y: number }[]): { x: number; y: number }[] {
    return array.map((i) => {
      return { x: i.x, y: this.apply(i.y) };
    });
  }
}

export class OrderedExponentialFilter {
  filters: ExponentialFilter[];

  constructor(smoothingFactor: number, order: number) {
    this.filters = Array(order)
      .fill()
      .map((i) => new ExponentialFilter(smoothingFactor));
  }

  apply(i: number): number {
    let result = i;
    this.filters.forEach((f) => {
      result = f.apply(result);
    });
    return result;
  }

  // Convinience function
  applyArray(array: { x: number; y: number }[]): { x: number; y: number }[] {
    return array.map((i) => {
      return { x: i.x, y: this.apply(i.y) };
    });
  }
}
