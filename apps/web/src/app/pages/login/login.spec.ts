import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FakeAuthGateway, provideFakeAuthGateway } from '../../core/auth/fake-auth-gateway';
import { APP_HOME_ROUTE, Login } from './login';

let gateway: FakeAuthGateway;

function createLogin(): ComponentFixture<Login> {
  const fixture = TestBed.createComponent(Login);
  fixture.detectChanges();
  return fixture;
}

function element<T extends Element>(fixture: ComponentFixture<Login>, selector: string): T {
  const found = (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  if (found === null) throw new Error(`Expected an element matching ${selector}, found none`);
  return found;
}

function exists(fixture: ComponentFixture<Login>, selector: string): boolean {
  return (fixture.nativeElement as HTMLElement).querySelector(selector) !== null;
}

function type(fixture: ComponentFixture<Login>, name: string, value: string): void {
  const input = element<HTMLInputElement>(fixture, `input[name="${name}"]`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function click(fixture: ComponentFixture<Login>, selector: string): void {
  element<HTMLButtonElement>(fixture, selector).click();
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<Login>): void {
  click(fixture, '.submit');
}

describe('Login', () => {
  beforeEach(() => {
    gateway = new FakeAuthGateway();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideFakeAuthGateway(gateway)],
    });
  });

  it('opens on the sign-in mode', () => {
    const fixture = createLogin();

    expect(element(fixture, '#form-title').textContent).toContain('Sign in to your account');
    expect(exists(fixture, 'input[name="name"]')).toBe(false);
  });

  it('shows no error before the first submit', () => {
    expect(exists(createLogin(), '.error')).toBe(false);
  });

  it('flags the e-mail and password when submitted empty, without calling the gateway', () => {
    const fixture = createLogin();

    submit(fixture);

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.error').length).toBe(2);
    expect(gateway.signIns).toEqual([]);
  });

  it('signs in with what was typed and offers to enter the app', () => {
    const fixture = createLogin();
    type(fixture, 'email', ' ana@mail.com ');
    type(fixture, 'password', 'secret');

    submit(fixture);

    expect(gateway.signIns).toEqual([
      { email: 'ana@mail.com', password: 'secret', remember: true },
    ]);
    expect(element(fixture, '.enter').getAttribute('href')).toBe(APP_HOME_ROUTE);
  });

  it('asks for a name and shows the strength meter when creating an account', () => {
    const fixture = createLogin();

    click(fixture, '.tab:nth-child(2)');

    expect(exists(fixture, 'input[name="name"]')).toBe(true);
    expect(exists(fixture, '.strength')).toBe(true);
  });

  it('creates an account once the fields are valid', () => {
    const fixture = createLogin();
    click(fixture, '.tab:nth-child(2)');
    type(fixture, 'name', 'Ana');
    type(fixture, 'email', 'ana@mail.com');
    type(fixture, 'password', 'Orbit2026!');

    submit(fixture);

    expect(gateway.signUps).toEqual([
      { name: 'Ana', email: 'ana@mail.com', password: 'Orbit2026!' },
    ]);
  });

  it('sends a reset link with only the e-mail and offers a way back', () => {
    const fixture = createLogin();
    click(fixture, '.password-heading .link');
    type(fixture, 'email', 'ana@mail.com');

    submit(fixture);

    expect(gateway.resets).toEqual(['ana@mail.com']);
    expect(exists(fixture, '.done .secondary')).toBe(true);
  });

  it('toggles the password between hidden and shown', () => {
    const fixture = createLogin();

    click(fixture, '.reveal');

    expect(element<HTMLInputElement>(fixture, '#password').type).toBe('text');
  });

  it('signs in through an identity provider', () => {
    const fixture = createLogin();

    click(fixture, '.provider');

    expect(gateway.providers).toEqual(['google']);
  });

  it('says so when the account cannot be reached', () => {
    gateway.failure = new Error('offline');
    const fixture = createLogin();
    type(fixture, 'email', 'ana@mail.com');
    type(fixture, 'password', 'secret');

    submit(fixture);

    expect(element(fixture, '.error').textContent).toContain("Couldn't reach your account");
    expect(exists(fixture, '.done')).toBe(false);
  });
});
