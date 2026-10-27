/** A one-off to-do for today, optionally tied to a category. */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
  readonly categoryId?: string;
}
