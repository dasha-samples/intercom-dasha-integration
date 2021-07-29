export class AxiosExtendedError extends Error {
  readonly reason?: Error;

  public constructor(message: string, reason?: Error) {
    super(message);
    this.reason = reason;
  }
}
