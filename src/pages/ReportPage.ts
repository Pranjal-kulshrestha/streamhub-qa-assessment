import { BasePage } from './BasePage';

export class ReportPage extends BasePage {
  amountInput = () => this.page.getByLabel('Loan amount');
  rateInput = () => this.page.getByLabel('Interest rate');
  tenureInput = () => this.page.getByLabel('Tenure');
  calculateButton = () => this.page.getByRole('button', { name: 'Calculate' });
  formError = () => this.page.getByRole('alert');
  emiResult = () => this.page.getByTestId('emi-result');
  totalInterestResult = () => this.page.getByTestId('total-interest-result');
  totalPaymentResult = () => this.page.getByTestId('total-payment-result');
  pieChart = () => this.page.getByTestId('emi-pie-chart');
  scheduleTable = () => this.page.getByRole('table', { name: 'Yearly repayment schedule' });
  scheduleRows = () => this.scheduleTable().locator('tbody').getByRole('row');

  async calculate(amount: number, rate: number, years: number): Promise<void> {
    await this.amountInput().fill(String(amount));
    await this.rateInput().fill(String(rate));
    await this.tenureInput().fill(String(years));
    await this.calculateButton().click();
  }
}
