

import { DataLoaderBase } from "@shared/util-loaders";
import * as t from "io-ts";

export abstract class CodecDataLoaderBase<R, T> extends DataLoaderBase<R, T> {
    protected abstract codec: t.Type<R>;
}
