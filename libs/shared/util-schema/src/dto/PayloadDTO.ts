import { Required } from "@tsed/schema";
import { KeyDTO } from "./KeyDTO";

export class PayloadDTO<T> {
    @Required(true)
    key: KeyDTO;
    @Required(true)
    data: T;

    constructor(key: KeyDTO, data: T) {
        this.key = key;
        this.data = data;
    }
}
