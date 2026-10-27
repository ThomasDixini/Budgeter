import { IdGenerator } from './id-generator';

/** Test double that hands out predictable ids: `id-1`, `id-2`… */
export class SequentialIdGenerator extends IdGenerator {
  private count = 0;

  override next(): string {
    this.count += 1;
    return `id-${this.count}`;
  }
}
