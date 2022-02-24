import { createGraphQLClient, GraphQLClient } from "@banklessdao/util-data";
import { notEmpty } from "@banklessdao/util-misc";
import { DEFAULT_CURSOR, ScheduleMode } from "@shared/util-loaders";
import { Data, NonEmptyProperty, RequiredProperty } from "@banklessdao/util-schema";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";
import * as t from "io-ts";
import { withMessage, fromNullable } from "io-ts-types";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const URL = "https://api.thegraph.com/subgraphs/name/ensdomains/ens";

const QUERY: DocumentNode = gql`
    query queryENSDomains($limit: Int, $cursor: String) {
        domains(
            first: $limit
            orderBy: createdAt
            where: { createdAt_gte: $cursor }
        ) {
            id
            name
            labelName
            createdAt
            owner {
                id
            }
        }
    }
`;

const INFO = {
    namespace: "ens",
    name: "Domain",
    version: "V1",
};

// Each Domain consists of an id (ETH address) and a name
// Names for ID#s may change
// we need to check events as wel to see if we have to update some already stored data

@Data({
    info: INFO,
})
class Domain {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    createdAt: string;
    @RequiredProperty()
    labelName: string;
    @RequiredProperty()
    name: string;
    @NonEmptyProperty()
    address: string;
}

// onwer.id is the .eth address
const ENSOwnerCodec = t.strict({
    id: withMessage(t.string, () => "id is required"),
});

const ENSDomainCodec = t.strict({
    id: t.string,
    createdAt: withMessage(t.string, () => "createdAt is required"),
    labelName: withMessage(
        fromNullable(t.string, "null"),
        () => "labelName is required"
    ),
    name: withMessage(fromNullable(t.string, "null"), () => "name is required"),
    owner: withMessage(ENSOwnerCodec, () => "owner is required"),
});

const ENSDomainsCodec = t.strict({
    domains: withMessage(t.array(ENSDomainCodec), () => "domains is required"),
});

type ENSDomains = t.TypeOf<typeof ENSDomainsCodec>;

export class ENSDomainLoader extends GraphQLDataLoaderBase<
    ENSDomains,
    Domain
> {
    public info = INFO;
    protected batchSize = BATCH_SIZE;
    protected type = Domain;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = QUERY;
    protected codec = ENSDomainsCodec;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(ensDomains: ENSDomains): Array<Domain> {
        return ensDomains.domains
            .map((domain) => {
                return {
                    id: domain.id,
                    createdAt: domain.createdAt,
                    name: domain.name,
                    labelName: domain.labelName,
                    address: domain.owner.id,
                };
            })
            .filter(notEmpty);
    }

    protected extractCursor(ensDomains: ENSDomains) {
        const obj = ensDomains.domains;
        if (obj.length === 0) {
            return DEFAULT_CURSOR;
        }
        return ensDomains.domains[ensDomains.domains.length - 1].createdAt;
    }
}

export const createENSDomainLoader: () => ENSDomainLoader = () =>
    new ENSDomainLoader(createGraphQLClient(URL));
