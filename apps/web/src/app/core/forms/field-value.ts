/**
 * The current value of the field an input or change event came from (an input, a select or a
 * textarea), for templates that bind events by hand instead of through forms.
 * @example (change)="period.set(fieldValue($event))"
 */
export function fieldValue(event: Event): string {
  const field = event.target;
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLSelectElement ||
    field instanceof HTMLTextAreaElement
  ) {
    return field.value;
  }
  throw new TypeError(
    `Expected an event from an input, select or textarea, received one from ${String(field)}`,
  );
}
