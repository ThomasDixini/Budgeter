import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Bill } from './bills';
import { SAMPLE_SINKING_FUND } from './fake-sinking-funds-gateway';
import { HttpSinkingFundsGateway } from './http-sinking-funds-gateway';
import { SinkingFund, SinkingFundDraft, SinkingFundsOverview } from './sinking-funds';

const DRAFT: SinkingFundDraft = {
  description: 'IPVA',
  categoryId: 'transport',
  amountCents: 120000,
  schedule: { kind: 'fixedDate', month: 1, day: 15 },
};

let httpTesting: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpSinkingFundsGateway],
  });
  httpTesting = TestBed.inject(HttpTestingController);
});

afterEach(() => httpTesting.verify());

describe('HttpSinkingFundsGateway', () => {
  it('lists the funds as of a day', () => {
    const overview: SinkingFundsOverview = {
      funds: [SAMPLE_SINKING_FUND],
      totalMonthlyCents: 10000,
    };
    let received: SinkingFundsOverview | undefined;

    TestBed.inject(HttpSinkingFundsGateway)
      .list('2026-10-05')
      .subscribe((value) => (received = value));
    httpTesting
      .expectOne({ method: 'GET', url: '/api/sinking-funds?today=2026-10-05' })
      .flush(overview);

    expect(received).toEqual(overview);
  });

  it('saves a fund under its encoded id with the day as a parameter', () => {
    let received: SinkingFund | undefined;

    TestBed.inject(HttpSinkingFundsGateway)
      .save('car tax', '2026-10-05', DRAFT)
      .subscribe((value) => (received = value));
    const request = httpTesting.expectOne({
      method: 'PUT',
      url: '/api/sinking-funds/car%20tax?today=2026-10-05',
    });
    request.flush(SAMPLE_SINKING_FUND);

    expect(request.request.body).toEqual(DRAFT);
    expect(received).toEqual(SAMPLE_SINKING_FUND);
  });

  it('deletes a fund', () => {
    TestBed.inject(HttpSinkingFundsGateway).delete('ipva').subscribe();

    httpTesting.expectOne({ method: 'DELETE', url: '/api/sinking-funds/ipva' }).flush(null);
  });

  it('rolls the funds due by a day and answers the bills created', () => {
    const bills: readonly Bill[] = [
      {
        id: 'sf-ipva-20270115',
        kind: 'payable',
        description: 'IPVA',
        categoryId: 'transport',
        amountCents: 120000,
        dueDate: '2027-01-15',
      },
    ];
    let received: readonly Bill[] = [];

    TestBed.inject(HttpSinkingFundsGateway)
      .roll('2027-01-15')
      .subscribe((value) => (received = value));
    const request = httpTesting.expectOne({ method: 'POST', url: '/api/sinking-funds/roll' });
    request.flush(bills);

    expect(request.request.body).toEqual({ today: '2027-01-15' });
    expect(received).toEqual(bills);
  });
});
