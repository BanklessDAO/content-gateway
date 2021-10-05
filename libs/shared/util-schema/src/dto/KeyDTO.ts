import { Required } from "@tsed/schema";

export class KeyDTO {
    @Required(true)
    namespace: string;
    @Required(true)
    name: string;
    @Required(true)
    version: string;

    constructor(namespace: string, name: string, version: string) {
        this.namespace = namespace;
        this.name = name;
        this.version = version;
    }
}
