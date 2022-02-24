import {
    Proposals,
    ProposalsCodec,
    Proposal,
    QUERY
} from "./SnapshotProposalLoader";
import * as E from "fp-ts/Either";
import { createGraphQLClient } from "@banklessdao/util-data";
import { URL } from "./SnapshotProposalLoader";
import { pipe } from "fp-ts/lib/function";
import { createSchemaFromClass } from "@banklessdao/util-schema";

const throwLeft = E.mapLeft((e) => {
    throw e;
});
describe("SnapshotProposalLoader", () => {
    const client = createGraphQLClient(URL);
    describe("codec", () => {
        it("should work on real data", () => {
            expect(E.isRight(ProposalsCodec.decode(realProposals))).toBe(true);
        });
    });
    describe("GraphQL call", () => {
        const vars = {
            limit: 10,
            cursor: 0,
            spaces: ["banklessvault.eth"]
        };
        it("should not fail", async () => {
            const response = await client.query(QUERY, vars, ProposalsCodec)();
            throwLeft(response);
        });
        it("should return something that can be parsed by the codec", async () => {
            const response = await client.query(QUERY, vars, ProposalsCodec)();
            pipe(
                response,
                throwLeft,
                E.chain((r) => ProposalsCodec.decode(r)),
                E.isRight,
                (wasSuccessfullyParsed) =>
                    expect(wasSuccessfullyParsed).toBe(true)
            );
        });
    });
    describe("Schema", () => {
        it("should work on the maximum output of the codec", () => {
            pipe(
                createSchemaFromClass(Proposal),
                throwLeft,
                E.chain((schema) =>
                    schema.validate(maximumProposals.proposals[0])
                ),
                throwLeft
            );
        });
        it("should work on the minimum output of the codec", () => {
            pipe(
                createSchemaFromClass(Proposal),
                throwLeft,
                E.chain((schema) =>
                    schema.validate(minimumProposals.proposals[0])
                ),
                throwLeft
            );
        });
    });
});

// Used for statically testing type
const minimumProposals: Proposals = {
    proposals: [
        {
            id: "1",
            author: "me",
            created: 0,
            strategies: [{ name: "normal" }],
            title: "test proposal",
            choices: [],
            start: 0,
            end: 1,
            snapshot: "0",
            state: "open",

            // Optional members need to be marked undefined for ts
            space: undefined,
            type: undefined,
            body: undefined,
            link: undefined,
            scores: undefined,
            votes: undefined,
        },
    ],
};

// Used for statically testing type
const maximumProposals: Proposals = {
    proposals: [
        {
            id: "1",
            author: "me",
            created: 0,
            strategies: [{ name: "normal" }],
            title: "test proposal",
            choices: [],
            start: 0,
            end: 1,
            snapshot: "0",
            state: "open",

            // Optional members
            space: {
                id: "space",
                name: "a space",
            },
            type: "normal",
            body: "a body",
            link: "link",
            scores: [0, 1, 2],
            votes: 3,
        },
    ],
};

const realProposals = {
    proposals: [
        {
            id: "QmdoixPMMT76vSt6ewkE87JZJywS1piYsGC3nJJpcrPXKS",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Approve the Bankless DAO Genesis Proposal?",
            choices: ["Yes", "No"],
            created: 1620135533,
            start: 1620154800,
            end: 1620414000,
            snapshot: "12389500",
            state: "closed",
            author: "0xeD7820deFdFFd1ec5Ac922a0DB721308FDaf509C",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmbCCAH3WbAFJS4FAUTvpWGmtgbaeMh1zoKgocdt3ZJmdr",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "What charity should CMS Holdings donate 100k towards? ",
            choices: [
                "Bitcoin Mining Carbon Offset",
                "Coin Center",
                "India Covid Relief",
                "Gitcoin",
            ],
            created: 1620319566,
            start: 1620327600,
            end: 1620673200,
            snapshot: "12381760",
            state: "closed",
            author: "0x25468E86ED8eC296de39FcB798C7f212924443AB",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmYvsZ7AU2XyhpBL8g4QRQbLRX6uU3t5CHNdFQbs5r7ypJ",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Badge Distribution for Second Airdrop",
            choices: [
                "FOR: 2021 Badges Only",
                "FOR: 2020 + 2021 Badges",
                "AGAINST",
            ],
            created: 1620758474,
            start: 1620759600,
            end: 1621018800,
            snapshot: "12414778",
            state: "closed",
            author: "0x35EA12472d6fb21A9dB24B397AA2775D332C14B7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmQX2DQcDTZzCpM6DTVNJutQJwWXtxJDTMpBoFjbnaM9i2",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Reward Season 0 Active Members ",
            choices: ["Approve", "Deny"],
            created: 1623198139,
            start: 1623196800,
            end: 1623456000,
            snapshot: "12597085",
            state: "closed",
            author: "0x35EA12472d6fb21A9dB24B397AA2775D332C14B7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmXrfAHMoRcu5Vy3DsRTfokqLBTEKR6tqKVecLvkgw5NZf",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Bankless DAO Season 1 ",
            choices: [
                "Approve Season 1 Specification",
                "Deny Season 1 Specification",
            ],
            created: 1623981505,
            start: 1623985200,
            end: 1624590000,
            snapshot: "12655510",
            state: "closed",
            author: "0x35EA12472d6fb21A9dB24B397AA2775D332C14B7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmTCfpZirT9mUrJD8rMZKpguiCpDKASFCnGQFpk6eyUk77",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Title: BanklessDAO Season 1 Grants Committee ratification",
            choices: ["Approve", "Deny"],
            created: 1625247750,
            start: 1625202000,
            end: 1625461140,
            snapshot: "12742069",
            state: "closed",
            author: "0x23dB246031fd6F4e81B0814E9C1DC0901a18Da2D",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmWoNKRmdn2hr1vKaoLkmuKWRQ611AiuB22JPpnDPae2m6",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "BED Index Logo Contest",
            choices: [
                "A) @Netsynq #9",
                "B) @Lime_John #1",
                "C) @Netsynq #1",
                "D) @Ianborcic #3",
                "E) @Khubbi8 #2",
            ],
            created: 1626225236,
            start: 1626228000,
            end: 1626382800,
            snapshot: "12822029",
            state: "closed",
            author: "0x35EA12472d6fb21A9dB24B397AA2775D332C14B7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmZLGKBRQTUcdET7aPsnFNJJoY2Z885j3c1813trEsUGck",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Request for funds for Notion’s ongoing subscription ",
            choices: ["Approve", "Deny"],
            created: 1627586860,
            start: 1627621200,
            end: 1627880400,
            snapshot: "12921898",
            state: "closed",
            author: "0x23dB246031fd6F4e81B0814E9C1DC0901a18Da2D",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "Qmdthz7Anz7g2aJJAewNqm3gQnssP5NkS2StNKELvArQkk",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: " Transfer ownership of the treasury multisig wallet from the genesis team to the DAO.",
            choices: ["Yes", "No"],
            created: 1631820397,
            start: 1631854800,
            end: 1632459600,
            snapshot: "13238616",
            state: "closed",
            author: "0x23dB246031fd6F4e81B0814E9C1DC0901a18Da2D",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmSTXHWP7bjaxT9aAuoFNkaCn5Ptx7GajEDDekoBccd5Uf",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Bankless DAO Season 2 ",
            choices: ["Approve Season 2 Spec", "Deny Season 2 Spec"],
            created: 1631835208,
            start: 1631847600,
            end: 1632452400,
            snapshot: "13239761",
            state: "closed",
            author: "0x35EA12472d6fb21A9dB24B397AA2775D332C14B7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmWwN1CeDPLcvCVkDuBiYmaaNcRhfrUzFYhBixF2B3ntJU",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Bankless DAO Season 2 Grants Committee Ratification",
            choices: ["Approve", "Reject"],
            created: 1633039349,
            start: 1633100400,
            end: 1633705200,
            snapshot: "13329545",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmYmHuawgkCZxVMo6EHq5s2WxQrSwTYZeBGRfFkc1xeW5f",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Bankless DAO Treasury Multi-sig Signer Ratification",
            choices: ["Approve", "Deny"],
            created: 1633040133,
            start: 1633100400,
            end: 1633705200,
            snapshot: "13329610",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmcL7qZ4nA3NoTukMVXXZeramGA8QiqQSpdBFAuRRht5T6",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "S1 & S2 Grants Committee Compensation",
            choices: ["Approve", "Deny"],
            created: 1633383801,
            start: 1633383900,
            end: 1633705200,
            snapshot: "13355068",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmVm6jzr7yDRiBmmkvCQ1MFw4jTaiJcME6ZNBp4QuU1DHA",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Retro Rectification Donations",
            choices: ["Approve", "Deny"],
            created: 1633569838,
            start: 1633570200,
            end: 1634175000,
            snapshot: "13368855",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmeUcnL5FTpF2ah2CCph6DZGqJzG19coT9b3ECLAvBxPH2",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Season 2 Project and Guild Funding",
            choices: ["Approve", "Reject"],
            created: 1633571810,
            start: 1633564800,
            end: 1634169600,
            snapshot: "13368913",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmZhncmagTnWXjvX17Kmm1f25D33CPAw6f1UQBo7fzm6UQ",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Balancer Liquidity Mining Program",
            choices: ["Approve", "Reject"],
            created: 1634137634,
            start: 1634140800,
            end: 1634745600,
            snapshot: "13410642",
            state: "closed",
            author: "0xb6ac0341Fcf3FB507A8208D34a97f13779e1393D",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "QmWjyeUFLmvVLg3fYeNWLjPscy6u4JU2tv8A1E1qjfDi2L",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Olympus Pro BANK liquidity bonds",
            choices: ["Launch BANK liquidity bonds", "Do Nothing"],
            created: 1634920746,
            start: 1635159600,
            end: 1635768000,
            snapshot: "13468489",
            state: "closed",
            author: "0x47f882a155209F55D280EB36577c100A74DD32a1",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "0xabccf8394b35e92043a4055f8430f1babd44fdc763849ad0158441073578a62e",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
            ],
            title: "Execute swap with Tokemak for BANK reactor ignition",
            choices: ["For", "Against", "Abstain"],
            created: 1635956294,
            start: 1635966000,
            end: 1636574400,
            snapshot: "13544840",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "Qmd2yvHyaNPYQe8S4abRD64U57dMYAuTZ3oYsu4vkJampG",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
                {
                    name: "balancer",
                },
            ],
            title: "Funding for Season 2 Approved Projects",
            choices: [
                "Get extra funding from Treasury ",
                "Fund projects from S3 allocation",
            ],
            created: 1640961992,
            start: 1640962800,
            end: 1641567600,
            snapshot: "13913644",
            state: "closed",
            author: "0x47f882a155209F55D280EB36577c100A74DD32a1",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "0x2b5159e129cef1e3aa3618f7eb4133712ad2ffb482df59159f90d7c842dc9355",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
                {
                    name: "balancer",
                },
            ],
            title: "BanklessDAO Season 3 Specification",
            choices: ["For", "Needs Revision"],
            created: 1640963877,
            start: 1640966400,
            end: 1641617940,
            snapshot: "13913846",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "0x0eb29303825c37c67ddc5d71b199bbc66c149712918c2a7c9261c7f6a2953d66",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
                {
                    name: "balancer",
                },
            ],
            title: "Firming Up Governance",
            choices: ["For", "Needs Revision"],
            created: 1640964482,
            start: 1641056400,
            end: 1641661200,
            snapshot: "13913870",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "0xeb3b1ff85d227856f9fab7f9af1b662a0013f19d58fb8df862fec2ef5914f82d",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
                {
                    name: "balancer",
                },
            ],
            title: "Season 3 Grants Committee Elections",
            choices: [
                "Icedcool#4947",
                "Kouros#2107",
                "Grendel#3875",
                "LiveTheLifeTV#5415",
                "Soundman#6783",
                "chuck25#4313",
            ],
            created: 1641328380,
            start: 1641326400,
            end: 1641931200,
            snapshot: "13941132",
            state: "closed",
            author: "0xE71eFd5865A42Cb0f23146Dc8E056dBA4E67e9b7",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
        {
            id: "0xe3f54fb37453af90984c4c41256afde75b92b8383acdcb9a7f467574e0cccb8a",
            strategies: [
                {
                    name: "erc20-balance-of",
                },
                {
                    name: "balancer",
                },
            ],
            title: "Season 3 Project and Guild Funding",
            choices: ["For", "Against", "Abstain"],
            created: 1641769714,
            start: 1641790800,
            end: 1642395600,
            snapshot: "13974171",
            state: "closed",
            author: "0xb6ac0341Fcf3FB507A8208D34a97f13779e1393D",
            space: {
                id: "banklessvault.eth",
                name: "Bankless DAO",
            },
        },
    ],
};
