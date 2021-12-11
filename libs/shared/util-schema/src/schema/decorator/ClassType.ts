/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ClassType<T = any> extends Function {
    new (...args: any[]): T;
}
