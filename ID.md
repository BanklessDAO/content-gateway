# Identity Management

Initially there is no identity object associated to a person.

Once they decide that they want to create a composite identity for themselves they can do so by *register*ing with a known identity provider.

It can be as easy as providing them with a few buttons:

```
      Register
┌───────┐ ┌─────────┐
│Discord│ │Discourse│
└───────┘ └─────────┘
┌───────┐ ┌─────────┐
│  ENS  │ │   ETH   │
└───────┘ └─────────┘
```

When you click on an option there is going to be a workflow (OAUTH with Discord and Metamask with ENS). If it is successful an identity is created for you and stored on the blockchain:

```json
{
    "id": "25c52999-3362-4bb2-a5bb-5cdb8eb2e0ee",
    "identities": [{ "eth": 0x123 }]
}
```

and you'll also get a _JWT_ token that stores your identities in a session. This is useful if you want multiple identities in one session.
Then you can have a full profile:

```json
{
    "id": "25c52999-3362-4bb2-a5bb-5cdb8eb2e0ee",
    "identities": [
        { "eth": 0x123 },
        { "ens": "jwm.eth" },
        { "discord": "montgomery#123" },
        { "discourse": "montgomery" }
    ]
}
```

Identities can be read by anybody, but if you want to edit an identity you have some choices.

If you're feeling kumbaya you can keep it as is (not recommended), **or** you can add `signers` to it:

```json
{
    "id": "25c52999-3362-4bb2-a5bb-5cdb8eb2e0ee",
    "identities": [
        { "eth": 0x123 },
        { "ens": "jwm.eth" },
        { "discord": "montgomery#123" },
        { "discourse": "montgomery" }
    ],
    "signers": [
        { "eth": 0x123 },
        { "discord": "montgomery#123" }
    ]
}
```

The more `signers` you have the more secure it is, but also the more cumbersome.

A signer is not necessarily part of your `identities`, it can be a 3rd party too.

We might also add some restoration mechanism like *BIP39*.
