import { fieldValue } from './field-value';

/** An event dispatched from the element, so its target is that element. */
function eventFrom(element: HTMLElement): Event {
  let caught: Event | undefined;
  element.addEventListener('input', (event) => (caught = event));
  element.dispatchEvent(new Event('input'));
  if (caught === undefined) {
    throw new Error('Expected the input event to be dispatched, found none');
  }
  return caught;
}

describe('fieldValue', () => {
  it('reads the value of an input', () => {
    const input = document.createElement('input');
    input.value = 'Languages';

    expect(fieldValue(eventFrom(input))).toBe('Languages');
  });

  it('reads the value of a select', () => {
    const select = document.createElement('select');
    select.append(new Option('Study', 'study', true, true));

    expect(fieldValue(eventFrom(select))).toBe('study');
  });

  it('rejects an event that does not come from a field', () => {
    expect(() => fieldValue(eventFrom(document.createElement('div')))).toThrow('HTMLDivElement');
  });
});
