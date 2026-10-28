import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  loanCount = () => this.page.getByTestId('loan-count');
  totalPrincipal = () => this.page.getByTestId('total-principal');
  totalInterest = () => this.page.getByTestId('total-interest');
  averageEmi = () => this.page.getByTestId('average-emi');
  barChart = () => this.page.getByTestId('loans-bar-chart');
  loansTable = () => this.page.getByRole('table', { name: 'Loan portfolio' });
  loanRows = () => this.loansTable().locator('tbody').getByRole('row');
}
