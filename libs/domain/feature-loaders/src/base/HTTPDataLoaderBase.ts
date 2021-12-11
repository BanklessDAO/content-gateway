import { get } from "@shared/util-data";
import { DataLoaderBase, LoadContext } from "@shared/util-loaders";

export abstract class HTTPDataLoaderBase<R, T> extends DataLoaderBase<R, T> {
    protected abstract getUrlFor(context: LoadContext): string;

    protected loadRaw(context: LoadContext) {
        return get({
            url: this.getUrlFor(context),
            codec: this.codec,
        });
    }
}
