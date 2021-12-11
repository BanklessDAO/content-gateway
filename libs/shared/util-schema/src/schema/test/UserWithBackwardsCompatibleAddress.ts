import {
    Data,
    NonEmptyProperty,
    OptionalArrayRef,
    OptionalProperty,
    OptionalStringArrayOf,
    RequiredObjectRef
} from "..";

class Comment {
    @NonEmptyProperty()
    text: string;
}

class City {
    @NonEmptyProperty()
    name: string;
}

class Address {
    @NonEmptyProperty()
    address: string;
    @RequiredObjectRef(City)
    city: City;
    @OptionalProperty()
    likeIt: boolean;
}

@Data({
    info: {
        namespace: "test",
        name: "User",
        version: "v1",
    },
})
export class User {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name: string;
    @OptionalArrayRef(Comment)
    comments: Comment[];
    @OptionalStringArrayOf()
    skills: string[];
    @RequiredObjectRef(Address)
    address: Address;
    @OptionalProperty()
    favoriteHobby: string;
}
