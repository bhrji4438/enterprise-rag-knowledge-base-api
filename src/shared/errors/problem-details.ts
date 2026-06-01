export class ProblemDetailsError extends Error {
  public readonly status: number;
  public readonly type: string;
  public readonly detail: string | undefined;
  public readonly instance: string | undefined;

  constructor(input: { status: number; title: string; type?: string; detail?: string; instance?: string }) {
    super(input.title);
    this.status = input.status;
    this.type = input.type ?? "about:blank";
    this.detail = input.detail;
    this.instance = input.instance;
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      title: this.message,
      status: this.status,
      detail: this.detail,
      instance: this.instance
    };
  }
}
