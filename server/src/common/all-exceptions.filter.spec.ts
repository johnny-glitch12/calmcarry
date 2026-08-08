import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * A CLIENT error must not surface as a 500.
 *
 * A red-team probe hit two cases that were logging + Sentry-firing as 500s, lettting
 * any caller (one unauthenticated) generate error-log/quota noise on demand:
 *  - body-parser's oversized/malformed body (a plain Error with a numeric status)
 *  - Postgres 22P02 from a non-UUID id in the URL
 * Both should be 4xx. resolveStatus is the single decision point, so test it directly.
 */
function makeFilter() {
  // resolveStatus is private and pure; reach it without standing up Nest's DI.
  const filter = Object.create(AllExceptionsFilter.prototype) as AllExceptionsFilter;
  return (e: unknown) => (filter as unknown as { resolveStatus(x: unknown): number }).resolveStatus(e);
}

describe('AllExceptionsFilter.resolveStatus', () => {
  const status = makeFilter();

  it('a genuine HttpException keeps its own status', () => {
    // POSITIVE CONTROL: if this is wrong, every mapping below is suspect.
    expect(status(new NotFoundException())).toBe(HttpStatus.NOT_FOUND);
    expect(status(new BadRequestException())).toBe(HttpStatus.BAD_REQUEST);
  });

  it('THE BUG: an oversized body (body-parser 413) is 413, not 500', () => {
    expect(status({ status: 413, message: 'request entity too large' })).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    // body-parser sometimes uses statusCode instead of status
    expect(status({ statusCode: 413 })).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  });

  it('THE BUG: a malformed-JSON body (body-parser 400) is 400, not 500', () => {
    expect(status({ status: 400, type: 'entity.parse.failed' })).toBe(HttpStatus.BAD_REQUEST);
  });

  it('THE BUG: a non-UUID id (Postgres 22P02) is 400, not 500', () => {
    expect(status({ code: '22P02', message: 'invalid input syntax for type uuid' })).toBe(HttpStatus.BAD_REQUEST);
  });

  it('a genuine unexpected error is still a 500', () => {
    expect(status(new Error('something actually broke'))).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(status({ code: '23505' })).toBe(HttpStatus.INTERNAL_SERVER_ERROR); // some other pg code
    expect(status(null)).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('a nonsense numeric status is not trusted as-is', () => {
    // only 400-599 are accepted from a raw error; anything else falls back to 500
    expect(status({ status: 200 })).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(status({ status: 999 })).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
