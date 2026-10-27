import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpTasksGateway } from './http-tasks-gateway';
import { Task } from './task';

const GYM: Task = { id: 'gym', title: 'Gym', repeat: 'weekly', days: [0, 2] };

let httpTesting: HttpTestingController;
let gateway: HttpTasksGateway;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpTasksGateway],
  });
  httpTesting = TestBed.inject(HttpTestingController);
  gateway = TestBed.inject(HttpTasksGateway);
});

afterEach(() => httpTesting.verify());

describe('HttpTasksGateway', () => {
  it('lists tasks from the API', () => {
    let received: readonly Task[] = [];

    gateway.list().subscribe((tasks) => (received = tasks));
    httpTesting.expectOne({ method: 'GET', url: '/api/tasks' }).flush([GYM]);

    expect(received).toEqual([GYM]);
  });

  it('puts the whole task at its escaped id', () => {
    gateway.save({ ...GYM, id: 'g 1' }).subscribe();

    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/tasks/g%201' });
    expect(request.request.body).toEqual({ ...GYM, id: 'g 1' });
    request.flush(GYM);
  });

  it('deletes a task', () => {
    gateway.delete('gym').subscribe();

    httpTesting.expectOne({ method: 'DELETE', url: '/api/tasks/gym' }).flush(null);
  });

  it('asks which tasks were done on a day', () => {
    let received: readonly string[] = [];

    gateway.completedOn('2026-10-26').subscribe((ids) => (received = ids));
    httpTesting
      .expectOne({ method: 'GET', url: '/api/task-completions?date=2026-10-26' })
      .flush(['gym']);

    expect(received).toEqual(['gym']);
  });

  it('marks and unmarks a day with PUT and DELETE', () => {
    gateway.setDone('gym', '2026-10-26', true).subscribe();
    gateway.setDone('gym', '2026-10-26', false).subscribe();

    httpTesting
      .expectOne({ method: 'PUT', url: '/api/tasks/gym/completions/2026-10-26' })
      .flush(null);
    httpTesting
      .expectOne({ method: 'DELETE', url: '/api/tasks/gym/completions/2026-10-26' })
      .flush(null);
  });
});
