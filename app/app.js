/* Loan EMI Dashboard: plain JavaScript, no build step. */
(function () {
  'use strict';

  // Sample portfolio shown on the dashboard.
  var LOANS = [
    { name: 'Home Loan A', amount: 2500000, rate: 10, years: 10 },
    { name: 'Home Loan B', amount: 5000000, rate: 7.5, years: 15 },
    { name: 'Personal Loan', amount: 1000000, rate: 12, years: 5 }
  ];

  var inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return '₹' + inr.format(n); }

  // Standard reducing-balance EMI: E = P r (1+r)^n / ((1+r)^n - 1), r = rate / 12 / 100, n = years * 12
  function calculate(amount, annualRate, years) {
    var n = years * 12;
    var r = annualRate / 12 / 100;
    var emi = r === 0 ? amount / n : (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    var totalPayment = emi * n;
    return { emi: emi, totalPayment: totalPayment, totalInterest: totalPayment - amount, months: n, monthlyRate: r };
  }

  function schedule(amount, annualRate, years) {
    var c = calculate(amount, annualRate, years);
    var balance = amount;
    var rows = [];
    for (var y = 1; y <= years; y++) {
      var principalPaid = 0;
      var interestPaid = 0;
      for (var m = 0; m < 12; m++) {
        var interest = balance * c.monthlyRate;
        var principal = c.emi - interest;
        balance -= principal;
        principalPaid += principal;
        interestPaid += interest;
      }
      rows.push({ year: y, principalPaid: principalPaid, interestPaid: interestPaid, balance: Math.max(balance, 0) });
    }
    return rows;
  }

  function $(selector) { return document.querySelector(selector); }
  function byTestId(id) { return document.querySelector('[data-testid="' + id + '"]'); }
  function setText(id, text) { byTestId(id).textContent = text; }

  var charts = {};
  function drawChart(key, canvasId, config) {
    // Animation is disabled so tests can read the final state immediately.
    if (charts[key]) { charts[key].destroy(); }
    config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, config.options || {});
    charts[key] = new window.Chart(document.getElementById(canvasId), config);
  }

  // The chart data is also exposed on the canvas, because canvas pixels cannot be read from the DOM.
  function exposeChartData(canvasId, labels, values) {
    var el = document.getElementById(canvasId);
    el.setAttribute('data-labels', JSON.stringify(labels));
    el.setAttribute('data-values', JSON.stringify(values));
  }

  function renderDashboard() {
    var results = LOANS.map(function (l) { return Object.assign({}, l, calculate(l.amount, l.rate, l.years)); });
    var totalPrincipal = results.reduce(function (s, l) { return s + l.amount; }, 0);
    var totalInterest = results.reduce(function (s, l) { return s + l.totalInterest; }, 0);
    var averageEmi = results.reduce(function (s, l) { return s + l.emi; }, 0) / results.length;

    setText('loan-count', String(results.length));
    setText('total-principal', money(totalPrincipal));
    setText('total-interest', money(totalInterest));
    setText('average-emi', money(averageEmi));

    var tbody = $('[data-testid="loans-table"] tbody');
    tbody.innerHTML = '';
    results.forEach(function (l) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + l.name + '</td><td>' + money(l.amount) + '</td><td>' + l.rate + '</td><td>' + l.years + '</td><td>' + money(l.emi) + '</td>';
      tbody.appendChild(tr);
    });

    var labels = results.map(function (l) { return l.name; });
    var values = results.map(function (l) { return Math.round(l.emi * 100) / 100; });
    drawChart('bar', 'loans-bar-chart', {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Monthly EMI (INR)', data: values, backgroundColor: '#1d4ed8' }] },
      options: { plugins: { legend: { display: false } } }
    });
    exposeChartData('loans-bar-chart', labels, values);
  }

  function showError(message) {
    var box = byTestId('form-error');
    box.textContent = message;
    box.hidden = !message;
  }

  function onCalculate(event) {
    event.preventDefault();
    var amount = Number($('#amount').value);
    var rate = Number($('#rate').value);
    var years = Number($('#tenure').value);

    if (!isFinite(amount) || amount <= 0) { return fail('Enter a loan amount greater than 0.'); }
    if (!isFinite(rate) || rate < 0 || rate > 50) { return fail('Enter an interest rate between 0 and 50.'); }
    if (!isFinite(years) || years < 1 || years > 40 || Math.floor(years) !== years) { return fail('Enter a whole number of years between 1 and 40.'); }

    showError('');
    var c = calculate(amount, rate, years);
    $('#results').hidden = false;
    setText('emi-result', money(c.emi));
    setText('total-interest-result', money(c.totalInterest));
    setText('total-payment-result', money(c.totalPayment));

    var labels = ['Principal', 'Interest'];
    var values = [Math.round(amount * 100) / 100, Math.round(c.totalInterest * 100) / 100];
    drawChart('pie', 'emi-pie-chart', {
      type: 'pie',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: ['#1d4ed8', '#f59e0b'] }] }
    });
    exposeChartData('emi-pie-chart', labels, values);

    var tbody = $('[data-testid="schedule-table"] tbody');
    tbody.innerHTML = '';
    schedule(amount, rate, years).forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + row.year + '</td><td>' + money(row.principalPaid) + '</td><td>' + money(row.interestPaid) + '</td><td>' + money(row.balance) + '</td>';
      tbody.appendChild(tr);
    });
  }

  function fail(message) {
    showError(message);
    $('#results').hidden = true;
  }

  function selectTab(name) {
    ['dashboard', 'report'].forEach(function (id) {
      var selected = id === name;
      document.getElementById('tab-' + id).setAttribute('aria-selected', String(selected));
      document.getElementById('view-' + id).hidden = !selected;
    });
    if (name === 'dashboard') { renderDashboard(); }
  }

  document.getElementById('tab-dashboard').addEventListener('click', function () { selectTab('dashboard'); });
  document.getElementById('tab-report').addEventListener('click', function () { selectTab('report'); });
  document.getElementById('emi-form').addEventListener('submit', onCalculate);

  renderDashboard();
})();
