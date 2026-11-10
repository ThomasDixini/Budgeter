import { Component } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface IncomeShare {
  readonly name: string;
  readonly percent: number;
  readonly color: string;
}

/** Landing section that shows the Finances module next to an illustrative preview of its income split and investments. */
@Component({
  selector: 'app-finances-showcase',
  imports: [TranslatePipe],
  templateUrl: './finances-showcase.html',
  styleUrl: './finances-showcase.css',
})
export class FinancesShowcase {
  protected readonly points: readonly string[] = [
    'What came in and what went out, by account, card and category',
    'Bills to pay and to receive, with a warning for what is late',
    'Investments with average price, current value, return and a comparison with the CDI',
    'The evolution of your net worth, month by month',
  ];
  protected readonly shares: readonly IncomeShare[] = [
    { name: 'Fixed expenses', percent: 50, color: '#9d7bf0' },
    { name: 'Investments', percent: 30, color: '#2f97cc' },
    { name: 'Studies', percent: 10, color: '#14a877' },
    { name: 'Leisure', percent: 5, color: '#d0609a' },
    { name: 'Reserve', percent: 5, color: '#b87f06' },
  ];
}
