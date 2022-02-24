export interface ProgramError {
    _tag: string;
    message: string;
    details: Record<string, unknown>;
    cause?: ProgramError;
}
