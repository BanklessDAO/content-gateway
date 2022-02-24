import { ProgramErrorBase } from "@banklessdao/util-data";

export class MaintenanceJobError extends ProgramErrorBase<"MaintenanceJobError"> {
    public error: Error | undefined;
    constructor(cause: Error | undefined) {
        super({
            _tag: "MaintenanceJobError",
            message: cause?.message ?? "Maintenance Job Failed",
        });
    }
}
