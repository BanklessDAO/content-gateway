import { get } from "@banklessdao/util-data";
import { CodecDataLoaderBase, LoadContext } from "@shared/util-loaders";

export abstract class HTTPDataLoaderBase<R, T> extends CodecDataLoaderBase<R, T> {
    protected abstract getUrlFor(context: LoadContext): string;

    protected loadRaw(context: LoadContext) {
        return get({
            url: this.getUrlFor(context),
            codec: this.codec,
        });
    }
}
