import { Required } from "@tsed/schema";
import { KeyDTO } from "./KeyDTO";

export class RegistrationDTO {
    @Required(true)
    key: KeyDTO;
    @Required(true)
    schema: string;

    constructor(key: KeyDTO, schema: string) {
        this.key = key;
        this.schema = schema;
    }
}
