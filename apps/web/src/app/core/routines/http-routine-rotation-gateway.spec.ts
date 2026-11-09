import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpRoutineRotationGateway } from './http-routine-rotation-gateway';
import { RoutineRotation } from './routine-rotation';

const PLAN: RoutineRotation = {
  startsOn: '2026-11-02',
  steps: [{ routineId: 'normal', weeks: 2 }],
};

let httpTesting: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpRoutineRotationGateway],
  });
  httpTesting = TestBed.inject(HttpTestingController);
});

afterEach(() => httpTesting.verify());

describe('HttpRoutineRotationGateway', () => {
  it('reads the rotation from the API', () => {
    let received: RoutineRotation | undefined;

    TestBed.inject(HttpRoutineRotationGateway)
      .get()
      .subscribe((rotation) => (received = rotation));
    httpTesting.expectOne({ method: 'GET', url: '/api/routine-rotation' }).flush(PLAN);

    expect(received).toEqual(PLAN);
  });

  it('replaces the whole rotation with a PUT', () => {
    TestBed.inject(HttpRoutineRotationGateway).save(PLAN).subscribe();
    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/routine-rotation' });
    request.flush(PLAN);

    expect(request.request.body).toEqual(PLAN);
  });
});
