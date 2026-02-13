export class UserInputError extends Error {
  readonly status = 400;
  readonly expose = true;

  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}

export const isUserInputError = (error: unknown): error is UserInputError => {
  if (error instanceof UserInputError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<UserInputError>;
  return candidate.status === 400 && typeof candidate.message === "string";
};
