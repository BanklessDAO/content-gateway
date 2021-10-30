import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";

class Comment {
    @Required(true)
    text!: string;
}

class City {
    @Required(true)
    name!: string;
}

class Address {
    @Required(true)
    address!: string;
    @Required(true)
    city!: City;
    @Required(false)
    likeIt!: boolean;
}

@AdditionalProperties(false)
export class User {
    @Required(true)
    id!: string;
    @Required(true)
    name?: string;
    @Required(false)
    @CollectionOf(Comment)
    comments!: Comment[];
    @Required(false)
    @CollectionOf(String)
    skills!: string[];
    @Required(true)
    address!: Address;
    @Required(false)
    favoriteHobby!: string;
}
