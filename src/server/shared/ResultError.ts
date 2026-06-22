export class ResultError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  public constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "ResultError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
