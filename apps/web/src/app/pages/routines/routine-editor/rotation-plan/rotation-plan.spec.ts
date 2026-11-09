import { ErrorHandler } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Clock } from '../../../../core/calendar/clock';
import { FixedClock } from '../../../../core/calendar/fixed-clock';
import { FakeRoutineRotationGateway } from '../../../../core/routines/fake-routine-rotation-gateway';
import {
  FakeRoutinesGateway,
  provideFakeRoutinesGateways,
} from '../../../../core/routines/fake-routines-gateways';
import { Routine } from '../../../../core/routines/routine';
import { RoutineRotation } from '../../../../core/routines/routine-rotation';
import { SAMPLE_ROUTINES } from '../../../../core/routines/sample-routines';
import { RotationPlan } from './rotation-plan';

/** Swallows the rejected saves these tests provoke on purpose. */
class SilentErrorHandler extends ErrorHandler {
  override handleError(): void {
    // Expected failures; the card's own message is what the tests check.
  }
}

/** Wednesday, November 18, 2026: the third week of a cycle started on November 2. */
const NOW = new Date(2026, 10, 18, 10, 0);
const INTENSE: Routine = { ...SAMPLE_ROUTINES[0], id: 'intense', name: 'Intense' };
const ROUTINES = [SAMPLE_ROUTINES[0], INTENSE];
const PLAN: RoutineRotation = {
  startsOn: '2026-11-02',
  steps: [
    { routineId: 'weekdays', weeks: 2 },
    { routineId: 'intense', weeks: 1 },
  ],
};

function createCard(
  rotation = new FakeRoutineRotationGateway(),
  routines: readonly Routine[] = ROUTINES,
): ComponentFixture<RotationPlan> {
  TestBed.configureTestingModule({
    providers: [
      ...provideFakeRoutinesGateways(
        undefined,
        undefined,
        new FakeRoutinesGateway(routines),
        undefined,
        undefined,
        rotation,
      ),
      { provide: Clock, useValue: new FixedClock(NOW) },
      { provide: ErrorHandler, useValue: new SilentErrorHandler() },
    ],
  });
  const fixture = TestBed.createComponent(RotationPlan);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<RotationPlan>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function click(fixture: ComponentFixture<RotationPlan>, selector: string, index = 0): void {
  element(fixture).querySelectorAll<HTMLButtonElement>(selector)[index].click();
  fixture.detectChanges();
}

function change(
  fixture: ComponentFixture<RotationPlan>,
  selector: string,
  value: string,
  index = 0,
): void {
  const field = element(fixture).querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector)[
    index
  ];
  field.value = value;
  field.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function stepLabels(fixture: ComponentFixture<RotationPlan>): (string | undefined)[] {
  return [...element(fixture).querySelectorAll('.step-weeks')].map((label) =>
    label.textContent?.trim(),
  );
}

async function save(fixture: ComponentFixture<RotationPlan>): Promise<void> {
  click(fixture, '.save-plan');
  await fixture.whenStable();
  fixture.detectChanges();
}

function message(fixture: ComponentFixture<RotationPlan>): string | undefined {
  return element(fixture).querySelector('.plan-message')?.textContent?.trim();
}

describe('RotationPlan', () => {
  it('lists the stored steps with the weeks of the cycle each covers', () => {
    const fixture = createCard(new FakeRoutineRotationGateway(PLAN));

    expect(stepLabels(fixture)).toEqual(['Weeks 1–2', 'Week 3']);
  });

  it('shows where this week falls in the cycle and the routine it follows', () => {
    const fixture = createCard(new FakeRoutineRotationGateway(PLAN));

    expect(element(fixture).querySelector('.this-week')?.textContent?.trim()).toBe(
      'This week: week 3 of 3 · Intense',
    );
  });

  it('builds a plan step by step and saves it from the Monday of this week', async () => {
    const gateway = new FakeRoutineRotationGateway();
    const fixture = createCard(gateway);

    click(fixture, '.add-step');
    change(fixture, '.weeks-input', '2');
    click(fixture, '.add-step');
    change(fixture, '.step-routine', 'intense', 1);
    await save(fixture);

    expect(gateway.saved).toEqual([
      {
        startsOn: '2026-11-16',
        steps: [
          { routineId: 'weekdays', weeks: 2 },
          { routineId: 'intense', weeks: 1 },
        ],
      },
    ]);
    expect(message(fixture)).toBe('Rotation saved');
  });

  it('moves a chosen start to the Monday of its week', () => {
    const fixture = createCard(new FakeRoutineRotationGateway(PLAN));

    change(fixture, 'input[type="date"]', '2026-11-12');

    expect(element(fixture).querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe(
      '2026-11-09',
    );
  });

  it('removes a step and keeps Save disabled until something changes', () => {
    const fixture = createCard(new FakeRoutineRotationGateway(PLAN));
    const saveButton = (): HTMLButtonElement =>
      element(fixture).querySelector<HTMLButtonElement>('.save-plan')!;
    const disabledBefore = saveButton().disabled;

    click(fixture, '.remove-step', 1);

    expect([disabledBefore, stepLabels(fixture), saveButton().disabled]).toEqual([
      true,
      ['Weeks 1–2'],
      false,
    ]);
  });

  it('keeps the edits and says so when saving fails', async () => {
    const gateway = new FakeRoutineRotationGateway();
    const fixture = createCard(gateway);
    gateway.failure = new Error('rejected');

    click(fixture, '.add-step');
    await save(fixture);

    expect([stepLabels(fixture), message(fixture)]).toEqual([
      ['Week 1'],
      "Couldn't save the rotation. Fix what the message below says, then try again.",
    ]);
  });

  it('asks for a saved routine before a step can be added', () => {
    const fixture = createCard(new FakeRoutineRotationGateway(), []);

    expect(element(fixture).querySelector<HTMLButtonElement>('.add-step')?.disabled).toBe(true);
  });
});
