/** Test data kept apart from steps. The sample loans mirror what the dashboard is expected to show. */
export interface Loan {
  name: string;
  amount: number;
  rate: number;
  years: number;
}

export const sampleLoans: Loan[] = [
  { name: 'Home Loan A', amount: 2500000, rate: 10, years: 10 },
  { name: 'Home Loan B', amount: 5000000, rate: 7.5, years: 15 },
  { name: 'Personal Loan', amount: 1000000, rate: 12, years: 5 },
];

/** Payloads for the POST /posts boundary tests (A3). */
export const postPayloads: Record<string, { body?: unknown; raw?: string }> = {
  valid: { body: { title: 'foo', body: 'bar', userId: 1 } },
  long_title: { body: { title: 'A'.repeat(20000), body: 'bar', userId: 1 } },
  special_characters: { body: { title: '<script>alert(1)</script> é€\u{1F4A5} \'"; DROP TABLE posts;--', body: '\u0000\u0007 \\ / %00', userId: 1 } },
  missing_userid: { body: { title: 'foo', body: 'bar' } },
  missing_title: { body: { body: 'bar', userId: 1 } },
  empty_object: { body: {} },
  wrong_types: { body: { title: 12345, body: ['not', 'a', 'string'], userId: 'abc' } },
  negative_userid: { body: { title: 'foo', body: 'bar', userId: -1 } },
  malformed_json: { raw: '{"title": "foo", "body": ' },
};
