/**
 * Contains metatata about a schema that
 * can be used to uniquelly identify it.
 */
export type SchemaInfo = {
    namespace: string;
    name: string;
    version: string;
};

export const schemaInfoToString = ({ namespace, name, version }: SchemaInfo) =>
    `${namespace}.${name}.${version}`;

export const stringToSchemaInfo = (str: string) => {
    const [namespace, name, version] = str.split(".");
    return { namespace, name, version };
};
