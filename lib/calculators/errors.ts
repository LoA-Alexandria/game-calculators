/**
 * Validation errors carry a stable `code` and its parameters so the interface
 * can show the message in the reader's language.
 *
 * The English `message` is kept exactly as it was and stays the fallback: the
 * calculation tests assert on it, and it is what a caller outside the site
 * (or a thrown-but-unhandled error) still sees.
 */
export type CalculatorErrorCode =
  | "wholeNumbers"
  | "levelRange"
  | "intendedHigher"
  | "targetHigher"
  | "targetNotLower"
  | "negativeLevel"
  | "cityMaxLevel"
  | "unknownCity"
  | "peerRange"
  | "routeCount"
  | "routeDuplicate";

export class CalculatorError extends Error {
  readonly code: CalculatorErrorCode;
  readonly params: Record<string, string | number>;

  constructor(
    code: CalculatorErrorCode,
    message: string,
    params: Record<string, string | number> = {},
  ) {
    super(message);
    this.name = "CalculatorError";
    this.code = code;
    this.params = params;
  }
}

export function isCalculatorError(error: unknown): error is CalculatorError {
  return error instanceof CalculatorError;
}
